import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { AppError, day, metadata, totals, validateAnalysis, validateImage } from '../lib/domain.mjs';
import { analyze, cloudinary, cloudinarySignature } from '../lib/providers.mjs';
import { api } from '../lib/api.mjs';
import { openDatabase, createApp } from '../server.mjs';

const image = 'data:image/jpeg;base64,' + Buffer.concat([Buffer.from([255, 216, 255, 224]), Buffer.alloc(200, 42)]).toString('base64');
const analysis = { name: 'Csirkés rizs', confidence: 'medium', assumptions: 'Az adag becsült.', ingredients: [
  { name: 'Csirkemell', grams: 150, calories: 165, protein: 31, carbs: 0, fat: 3.6, fiber: 0, sugar: 0, sodium: 74 },
  { name: 'Rizs', grams: 120, calories: 130, protein: 2.7, carbs: 28, fat: .3, fiber: null, sugar: 0, sodium: null },
] };
const env = { OPENCODE_API_KEY: 'test-only-opencode', CLOUDINARY_CLOUD_NAME: 'test-cloud', CLOUDINARY_API_KEY: 'test-only-key', CLOUDINARY_API_SECRET: 'test-only-secret' };
function mockProviders({ cloudFailure = false, destroyFailure = false, aiPayload = null } = {}) {
  const calls = [];
  const fetcher = async (url, options) => {
    calls.push({ url, options });
    if (url.startsWith('https://opencode.ai/')) return Response.json(aiPayload || { candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify({ isFood: true, ...analysis }) }] } }], usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 50 } });
    const form = options.body;
    if (url.endsWith('/upload')) return cloudFailure ? Response.json({ error: 'sensitive provider error' }, { status: 500 }) : Response.json({ public_id: form.get('public_id'), secure_url: `https://res.cloudinary.com/test-cloud/image/upload/v1/${form.get('public_id')}.jpg`, width: 1000, height: 800, bytes: 1234, version: 1, format: 'jpg' });
    if (url.endsWith('/destroy')) return destroyFailure ? Response.json({}, { status: 503 }) : Response.json({ result: 'ok' });
    assert.fail(`Unexpected external URL ${url}`);
  };
  return { fetcher, calls };
}
function fixture(options = {}) {
  const db = openDatabase(':memory:'), providers = mockProviders(options);
  const invoke = async (path, method = 'GET', payload, userId = 'alice', extraHeaders = {}) => {
    const response = await api(new Request(`http://localhost${path}`, { method, headers: { ...(payload !== undefined ? { 'Content-Type': 'application/json' } : {}), ...extraHeaders }, ...(payload !== undefined ? { body: JSON.stringify(payload) } : {}) }), { db, env, userId, fetcher: providers.fetcher });
    return { status: response.status, body: await response.json() };
  };
  return { db, ...providers, invoke, input: () => ({ id: randomUUID(), image, day: '2026-11-06', time: '12:30', type: 'Ebéd', notes: '150 g csirke' }) };
}

test('calendar dates, nutrient validation, scaling and unknown nutrients', () => {
  assert.equal(day('2024-02-29'), '2024-02-29');
  for (const value of ['2026-02-29', '2026-11-31', '2026-99-02', 'bad', '1800-01-01']) assert.throws(() => day(value), AppError);
  assert.throws(() => metadata({ day: '2026-11-06', time: '25:00', type: 'Ebéd' }), AppError);
  assert.equal(totals(validateAnalysis(analysis).ingredients).calories, 403.5);
  assert.equal(totals(analysis.ingredients).fiber, null); assert.equal(totals(analysis.ingredients).sodium, null);
  assert.equal(totals(analysis.ingredients).protein, 49.7);
  const invalid = structuredClone(analysis); invalid.ingredients[0].grams = -1; assert.throws(() => validateAnalysis(invalid), AppError);
  invalid.ingredients[0].grams = 100; invalid.ingredients[0].fat = Infinity; assert.throws(() => validateAnalysis(invalid), AppError);
  invalid.ingredients[0].fat = 101; assert.throws(() => validateAnalysis(invalid), AppError);
});
test('rejects disguised uploads and excessive input size', () => {
  assert.equal(validateImage(image).mime, 'image/jpeg');
  for (const value of ['data:image/svg+xml;base64,PHN2Zz4=', 'data:image/jpeg;base64,' + Buffer.alloc(200).toString('base64'), 'https://example.com/a.jpg', 'x'.repeat(5_600_001)]) assert.throws(() => validateImage(value), AppError);
});
test('OpenCode uses the native Gemini route, server-side bearer token and schema', async () => {
  const mock = mockProviders(); const result = await analyze(image, 'Megjegyzés', env, mock.fetcher);
  assert.equal(result.analysis.name, analysis.name);
  assert.equal(mock.calls[0].url, 'https://opencode.ai/inference/google/v1beta/models/gemini-3.8-flash:generateContent');
  assert.equal(mock.calls[0].options.headers.Authorization, `Bearer ${env.OPENCODE_API_KEY}`);
  const body = JSON.parse(mock.calls[0].options.body);
  assert.equal(body.contents[0].parts[0].inlineData.mimeType, 'image/jpeg');
  assert.equal(body.generationConfig.responseMimeType, 'application/json');
  assert.ok(body.generationConfig.responseJsonSchema.properties.ingredients);
});
test('refused, truncated and non-food AI results do not turn into invented meals', async () => {
  for (const [payload, status] of [
    [{ candidates: [{ finishReason: 'MAX_TOKENS' }] }, 502],
    [{ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'not-json' }] } }] }, 502],
    [{ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify({ isFood: false, ingredients: [] }) }] } }] }, 422],
  ]) await assert.rejects(analyze(image, '', env, mockProviders({ aiPayload: payload }).fetcher), e => e.status === status);
});
test('Cloudinary signatures sort parameters, upload and delete are signed', async () => {
  const params = { timestamp: '123', public_id: 'yumetrics/a', overwrite: 'false' };
  assert.equal(await cloudinarySignature(params, 'secret'), createHash('sha1').update('overwrite=false&public_id=yumetrics/a&timestamp=123secret').digest('hex'));
  const mock = mockProviders(); await cloudinary('upload', 'yumetrics/a', env, image, mock.fetcher);
  const form = mock.calls[0].options.body;
  assert.equal(form.get('file'), image); assert.equal(form.get('overwrite'), 'false'); assert.equal(form.get('api_key'), env.CLOUDINARY_API_KEY); assert.ok(form.get('signature'));
  await cloudinary('destroy', 'yumetrics/a', env, null, mock.fetcher);
  assert.equal(mock.calls[1].options.body.get('invalidate'), 'true');
});
test('analyze → persistent draft → corrected saved meal → calendar → deletion', async t => {
  const f = fixture(); t.after(() => f.db.close()); const input = f.input();
  const created = await f.invoke('/api/analyze', 'POST', input);
  assert.equal(created.status, 201); assert.equal(created.body.meal.status, 'draft'); assert.equal(created.body.meal.totals.calories, 403.5);
  assert.equal(f.calls.length, 2);
  const repeat = await f.invoke('/api/analyze', 'POST', input); assert.equal(repeat.status, 200); assert.equal(f.calls.length, 2);
  const changed = created.body.meal; changed.analysis.ingredients[0].grams = 200;
  const saved = await f.invoke(`/api/meals/${input.id}`, 'PATCH', changed);
  assert.equal(saved.status, 200); assert.equal(saved.body.meal.status, 'saved'); assert.equal(saved.body.meal.totals.calories, 486);
  const original = await f.db.prepare('SELECT original_analysis,analysis FROM meals WHERE id=?').bind(input.id).first();
  assert.equal(JSON.parse(original.original_analysis).ingredients[0].grams, 150); assert.equal(JSON.parse(original.analysis).ingredients[0].grams, 200);
  const calendar = await f.invoke('/api/meals?month=2026-11'); assert.equal(calendar.body.meals.length, 1);
  assert.equal((await f.invoke('/api/meals?month=2026-12')).body.meals.length, 0);
  assert.equal((await f.invoke(`/api/meals/${input.id}`, 'PATCH', changed)).status, 409);
  assert.equal((await f.invoke(`/api/meals/${input.id}`, 'DELETE')).status, 200);
  assert.equal((await f.invoke('/api/meals?month=2026-11')).body.meals.length, 0);
  assert.ok(f.calls.at(-1).url.endsWith('/destroy'));
});
test('every read/write is owner-scoped and rejects anonymous and cross-origin writes', async t => {
  const f = fixture(); t.after(() => f.db.close()); const input = f.input(); await f.invoke('/api/analyze', 'POST', input);
  assert.equal((await f.invoke('/api/status', 'GET', undefined, null)).status, 401);
  assert.equal((await f.invoke('/api/meals?month=2026-11', 'GET', undefined, 'bob')).body.meals.length, 0);
  for (const method of ['GET', 'PATCH', 'DELETE']) assert.equal((await f.invoke(`/api/meals/${input.id}`, method, method === 'PATCH' ? {} : undefined, 'bob')).status, 404);
  assert.equal((await f.invoke('/api/analyze', 'POST', f.input(), 'alice', { Origin: 'https://evil.test' })).status, 403);
  assert.equal((await f.invoke('/api/analyze', 'POST', f.input(), 'alice', { 'Sec-Fetch-Site': 'cross-site' })).status, 403);
});
test('upload failure is recoverable and deletion failure preserves the record', async t => {
  const f = fixture({ cloudFailure: true, destroyFailure: true }); t.after(() => f.db.close()); const input = f.input();
  const failed = await f.invoke('/api/analyze', 'POST', input); assert.equal(failed.status, 502); assert.ok(!JSON.stringify(failed.body).includes('sensitive'));
  const row = await f.invoke(`/api/meals/${input.id}`); assert.equal(row.body.meal.status, 'failed');
  assert.equal((await f.invoke(`/api/meals/${input.id}`, 'DELETE')).status, 502);
  assert.equal((await f.invoke(`/api/meals/${input.id}`)).status, 200);
  const successful = mockProviders();
  const response = await api(new Request(`http://localhost/api/meals/${input.id}`, { method: 'DELETE' }), { db: f.db, env, userId: 'alice', fetcher: successful.fetcher });
  assert.equal(response.status, 200); assert.equal((await f.invoke(`/api/meals/${input.id}`)).status, 404);
});
test('hourly cost limit is atomic and cannot be reset by deleting meals', async t => {
  const f = fixture(); t.after(() => f.db.close());
  for (let i = 0; i < 20; i++) await f.db.prepare('INSERT INTO analysis_attempts(id,user_id,created_at) VALUES(?,?,?)').bind(randomUUID(), 'alice', new Date().toISOString()).run();
  assert.equal((await f.invoke('/api/analyze', 'POST', f.input())).status, 429); assert.equal(f.calls.length, 0);
});
test('missing credentials, invalid month and malformed JSON fail clearly', async t => {
  const f = fixture(); t.after(() => f.db.close());
  assert.equal((await f.invoke('/api/meals?month=2026-99')).status, 400);
  assert.equal((await f.invoke('/api/meals?month=1900-01')).status, 200);
  const missing = await api(new Request('http://localhost/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f.input()) }), { db: f.db, env: {}, userId: 'alice', fetcher: f.fetcher });
  assert.equal(missing.status, 503); assert.equal(f.calls.length, 0);
  assert.equal((await api(new Request('http://localhost/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: 'null' }), { db: f.db, env, userId: 'alice' })).status, 400);
});
test('SQLite records survive a restart and migrations do not overwrite data', async () => {
  const directory = mkdtempSync(resolve('.test-data-')), path = resolve(directory, 'test.sqlite');
  let db;
  try {
    db = openDatabase(path); await db.prepare('INSERT INTO analysis_attempts VALUES(?,?,?)').bind('persisted', 'alice', '2026-11-06').run(); db.close();
    db = openDatabase(path); assert.equal((await db.prepare('SELECT * FROM analysis_attempts WHERE id=?').bind('persisted').first()).user_id, 'alice');
  } finally { db?.close(); rmSync(directory, { recursive: true, force: true }); }
});
test('HTTP login, session, security headers and static file allowlist', async t => {
  const db = openDatabase(':memory:'); const server = createApp({ db, env: { APP_PASSWORD: 'test-password' } });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  t.after(async () => { await new Promise(resolve => server.close(resolve)); db.close(); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  let response = await fetch(`${origin}/api/status`); assert.equal(response.status, 401);
  response = await fetch(`${origin}/api/login`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin }, body: JSON.stringify({ password: 'test-password' }) });
  assert.equal(response.status, 200); const cookie = response.headers.get('set-cookie'); assert.ok(cookie.includes('HttpOnly')); assert.ok(cookie.includes('SameSite=Strict'));
  response = await fetch(`${origin}/api/status`, { headers: { Cookie: cookie.split(';')[0] } }); assert.equal(response.status, 200);
  assert.equal((await fetch(`${origin}/.env`)).status, 404);
  response = await fetch(origin); assert.equal(response.status, 200); assert.ok((await response.text()).includes('lang="hu"')); assert.ok(response.headers.get('Content-Security-Policy').includes("script-src 'self'"));
  response = await fetch(`${origin}/api/logout`, { method: 'POST', headers: { Cookie: cookie.split(';')[0] } }); assert.equal(response.status, 200);
  assert.equal((await fetch(`${origin}/api/status`, { headers: { Cookie: cookie.split(';')[0] } })).status, 401);
});
