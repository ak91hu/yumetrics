import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { resolve } from 'node:path';
import { AppError, day, metadata, totals, analysisContext, analysisReport, validateAnalysis, validateImage } from '../lib/domain.mjs';
import { FOOD_REFERENCE } from '../lib/food-reference.mjs';
import { HUNGARIAN_DISHES } from '../lib/hungarian-food.mjs';
import { secondImage, aiPayloadFor, visualInventory } from './fixtures.mjs';
import { analyze, cloudinary, cloudinarySignature } from '../lib/providers.mjs';
import { api } from '../lib/api.mjs';
import { openDatabase } from '../server.mjs';
import { processNextJob } from '../lib/jobs.mjs';

const image = 'data:image/jpeg;base64,' + Buffer.concat([Buffer.from([255, 216, 255, 224]), Buffer.alloc(200, 42)]).toString('base64');
const analysis = { name: 'Csirkés rizs', confidence: 'medium', assumptions: 'Az adag becsült.', ingredients: [
  { name: 'Csirkemell', grams: 150, calories: 165, protein: 31, carbs: 0, fat: 3.6, fiber: 0, sugar: 0, sodium: 74 },
  { name: 'Rizs', grams: 120, calories: 130, protein: 2.7, carbs: 28, fat: .3, fiber: null, sugar: 0, sodium: null },
] };
const env = { OPENCODE_API_KEY: 'test-only-opencode', CLOUDINARY_CLOUD_NAME: 'test-cloud', CLOUDINARY_API_KEY: 'test-only-key', CLOUDINARY_API_SECRET: 'test-only-secret' };
function mockProviders({ cloudFailure = false, destroyFailure = false, aiPayload = null, inventory = visualInventory(analysis) } = {}) {
  const calls = [];
  const fetcher = async (url, options) => {
    calls.push({ url, options });
    if (url.startsWith('https://opencode.ai/')) return Response.json(aiPayload || aiPayloadFor(analysis, options, inventory));
    if (url.startsWith('https://res.cloudinary.com/')) return new Response(Buffer.from((url.includes('-angle') ? secondImage : image).split(',')[1], 'base64'), { headers: { 'Content-Type': 'image/jpeg' } });
    const form = options.body;
    if (url.endsWith('/upload')) return cloudFailure === true || cloudFailure === 'angle' && form.get('public_id').endsWith('-angle') ? Response.json({ error: 'sensitive provider error' }, { status: 500 }) : Response.json({ public_id: form.get('public_id'), secure_url: `https://res.cloudinary.com/test-cloud/image/authenticated/v1/${form.get('public_id')}.jpg`, width: 1000, height: 800, bytes: 1234, version: 1, format: 'jpg' });
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
  const process = () => processNextJob({ db, env, fetcher: providers.fetcher });
  const create = async input => { const queued = await invoke('/api/analyze', 'POST', input); assert.equal(queued.status, 202); await process(); const result = await invoke(`/api/meals/${input.id}`); return { ...result, status: queued.status }; };
  return { db, ...providers, invoke, process, create, input: () => ({ id: randomUUID(), image, secondImage, day: '2026-11-06', time: '12:30', type: 'Ebéd', notes: '150 g csirke' }) };
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
  invalid.ingredients[0].fat = 101; assert.throws(() => validateAnalysis(invalid), error => error instanceof AppError && error.message.includes('Zsír:') && error.message.includes('100 g') && !error.message.includes('fat'));
});
test('rejects disguised uploads and excessive input size', () => {
  assert.equal(validateImage(image).mime, 'image/jpeg');
  for (const value of ['data:image/svg+xml;base64,PHN2Zz4=', 'data:image/jpeg;base64,' + Buffer.alloc(200).toString('base64'), 'https://example.com/a.jpg', 'x'.repeat(5_600_001)]) assert.throws(() => validateImage(value), AppError);
});
test('missing, duplicated and invalid second photos fail before storage, rate limits or provider calls', async t => {
  const f = fixture(); t.after(() => f.db.close());
  for (const second of [undefined, null, image, 'not-an-image']) {
    const result = await f.invoke('/api/analyze', 'POST', { ...f.input(), secondImage: second });
    assert.equal(result.status, 400);
    await assert.rejects(analyze(image, '', env, f.fetcher, { secondImage: second }), error => error.status === 400);
  }
  assert.equal(f.calls.length, 0);
  assert.equal((await f.db.prepare('SELECT COUNT(*) AS n FROM meals').bind().first()).n, 0);
  assert.equal((await f.db.prepare('SELECT COUNT(*) AS n FROM analysis_attempts').bind().first()).n, 0);
});
test('pair checks reject mismatched meals, repeated angles, unusable views and incomplete assessments', async () => {
  for (const [field, status] of [['sameMeal', 422], ['differentAngles', 422], ['bothUsable', 422], ['missing', 502]]) {
    const inventory = visualInventory(analysis);
    if (field === 'missing') delete inventory.viewCheck; else { inventory.viewCheck[field] = false; inventory.imageQuality.level = 'poor'; }
    const mock = mockProviders({ inventory });
    await assert.rejects(analyze(image, '', env, mock.fetcher, { secondImage }), error => error.status === status && (field !== 'sameMeal' || error.message.includes('ugyanaz az adag vagy csomagolt termék')));
    assert.equal(mock.calls.length, 1, 'Unacceptable AI results never trigger another request');
  }
});
test('one detailed AI request includes both photos and returns the whole validated analysis', async () => {
  const inventory = visualInventory(analysis), calls = [];
  inventory.ingredients[0].grams = 160; inventory.ingredients[0].gramsMin = 130; inventory.ingredients[0].gramsMax = 200;
  const result = await analyze(image, 'Ismert elkészítés', env, async (url, options) => {
    calls.push(JSON.parse(options.body)); return Response.json(aiPayloadFor(analysis, options, inventory));
  }, { secondImage });
  assert.equal(calls.length, 1);
  assert.equal(result.analysis.ingredients[0].grams, 160);
  assert.equal(result.analysis.ingredients[0].calories, analysis.ingredients[0].calories);
  assert.deepEqual(result.analysis.viewCheck, inventory.viewCheck);
  assert.deepEqual(result.usage.passes.map(pass => pass.stage), ['meal_analysis']);
  const call = calls[0], prompt = call.systemInstruction.parts[0].text;
  assert.deepEqual(call.contents[0].parts.filter(part => part.inlineData).map(part => part.inlineData.data), [image, secondImage].map(value => value.split(',')[1]));
  assert.deepEqual(call.contents[0].parts.slice(1).map(part => part.text || part.inlineData.mimeType), ['IMAGE 1', 'image/jpeg', 'IMAGE 2', 'image/jpeg']);
  assert.equal(JSON.parse(call.contents[0].parts.find(part => part.text).text).notes, 'Ismert elkészítés');
  for (const section of ['KÉPPÁR-ELLENŐRZÉS', 'ADAGELLENŐRZÉS', 'TÁPÉRTÉKEK UGYANEBBEN A VÁLASZBAN', 'VÉGSŐ ELLENŐRZÉS UGYANEBBEN A KÉRÉSBEN', '1 g só = 400 mg nátrium']) assert.ok(prompt.includes(section));
  assert.ok(prompt.length < 15000, 'Keep the shared prompt below the previous 15,784-character request');
  assert.ok(prompt.includes('kompakt JSON'));
  assert.ok(prompt.includes('a helytakarékosság miatt ne kerekíts vagy hagyj ki adatot'));
  for (const food of Object.values(FOOD_REFERENCE)) for (const fact of [food.label, food.description, food.matchNotes].filter(Boolean)) assert.ok(prompt.includes(fact), 'All food identities and substitution cautions reach the model');
  for (const dish of Object.values(HUNGARIAN_DISHES)) for (const fact of [dish.label, dish.hint, ...dish.questions]) assert.ok(prompt.includes(fact), 'Hungarian preparation guidance remains complete');
  assert.equal(call.generationConfig.maxOutputTokens, 10000);
  assert.equal(Object.hasOwn(call.generationConfig, 'thinkingConfig'), false, 'Do not change the existing model reasoning setting');
  for (const key of ['calories', 'protein', 'carbs', 'fat', 'fiber', 'sugar', 'sodium', 'saturatedFat']) assert.ok(call.generationConfig.responseJsonSchema.properties.ingredients.items.required.includes(key));
});
test('compact requests retain a shared language-independent prefix and all billed usage metadata', async () => {
  const calls = [], usageMetadata = { promptTokenCount: 9000, candidatesTokenCount: 2000, thoughtsTokenCount: 1500, cachedContentTokenCount: 5000, cost: .0325, opencode: { billing_source: 'balance', tokens: { input: 4000, output: 3500, reasoning: 1500, cache_read: 5000 } } };
  const fetcher = async (url, options) => {
    calls.push(JSON.parse(options.body));
    return Response.json({ ...aiPayloadFor(analysis, options), usageMetadata });
  };
  for (const language of ['hu', 'en']) {
    const result = await analyze(image, 'User-provided data', env, fetcher, { secondImage, context: { language } });
    assert.deepEqual(result.usage.passes, [{ stage: 'meal_analysis', ...usageMetadata }]);
    assert.equal(result.analysis.ingredients[0].grams, analysis.ingredients[0].grams);
    assert.equal(result.analysis.ingredients[0].calories, analysis.ingredients[0].calories);
  }
  assert.equal(calls.length, 2, 'Exactly one request for each analysis');
  assert.ok(calls[1].systemInstruction.parts[0].text.startsWith(calls[0].systemInstruction.parts[0].text));
  assert.deepEqual(calls[0].generationConfig, calls[1].generationConfig);
});
test('a missing AI nutrient is rejected after one request, without a fallback request', async () => {
  let calls = 0;
  await assert.rejects(analyze(image, '', env, async (url, options) => {
    calls++; const payload = aiPayloadFor(analysis, options), raw = JSON.parse(payload.candidates[0].content.parts[0].text);
    delete raw.ingredients[0].protein; payload.candidates[0].content.parts[0].text = JSON.stringify(raw);
    return Response.json(payload);
  }, { secondImage }), error => error.status === 502);
  assert.equal(calls, 1);
});
test('AI nutrients with impossible composition are rejected; uncertain measured portions cannot claim high confidence', async () => {
  for (const invalid of [{ protein: 60, carbs: 60 }, { sugar: 50 }, { saturatedFat: 50 }]) {
    await assert.rejects(analyze(image, '', env, async (url, options) => Response.json(aiPayloadFor({ ...analysis, ingredients: analysis.ingredients.map(item => ({ ...item, ...invalid })) }, options)), { secondImage }), error => error.status === 502);
  }
  const inventory = visualInventory(analysis); inventory.confidence = 'high';
  const result = await analyze(image, '', env, mockProviders({ inventory }).fetcher, { secondImage, context: { totalWeightG: 400 } });
  assert.equal(result.analysis.confidence, 'medium');
});
test('legacy single-photo records stay readable and retry requests explain the required new pair', async t => {
  const f = fixture(); t.after(() => f.db.close()); const input = f.input();
  const result = await f.create(input), single = { ...result.body.meal.photo }; delete single.additional;
  await f.db.prepare("UPDATE meals SET photo=?,status='failed' WHERE id=?").bind(JSON.stringify(single), input.id).run();
  await f.db.prepare("UPDATE analysis_jobs SET state='failed' WHERE meal_id=?").bind(input.id).run();
  const count = (await f.db.prepare('SELECT COUNT(*) AS n FROM analysis_attempts').bind().first()).n;
  const retry = await f.invoke(`/api/meals/${input.id}/retry`, 'POST');
  assert.equal(retry.status, 422); assert.ok(retry.body.error.includes('két, eltérő szögből'));
  assert.equal((await f.db.prepare('SELECT COUNT(*) AS n FROM analysis_attempts').bind().first()).n, count);
  assert.equal((await f.invoke(`/api/meals/${input.id}`)).status, 200);
});
test('OpenCode uses the native Gemini route, server-side bearer token and schema', async () => {
  const mock = mockProviders(); const result = await analyze(image, 'Megjegyzés', env, mock.fetcher, { secondImage });
  assert.equal(result.analysis.name, analysis.name);
  assert.equal(mock.calls[0].url, 'https://opencode.ai/inference/google/v1beta/models/gemini-4-argon:generateContent');
  assert.equal(mock.calls[0].options.headers.Authorization, `Bearer ${env.OPENCODE_API_KEY}`);
  const body = JSON.parse(mock.calls[0].options.body);
  assert.equal(body.contents[0].parts.find(part => part.inlineData).inlineData.mimeType, 'image/jpeg');
  assert.equal(body.generationConfig.responseMimeType, 'application/json');
  assert.equal(Object.hasOwn(body.generationConfig, 'temperature'), false, 'Gemini 4 does not support sampling parameters');
  assert.ok(body.generationConfig.responseJsonSchema.properties.ingredients);
  assert.equal(JSON.stringify(body.generationConfig.responseJsonSchema).includes('maxItems'), false, 'Gateway rejects maxItems; server validation bounds arrays');
});
test('refused, truncated and non-food AI results do not turn into invented meals', async () => {
  for (const [payload, status] of [
    [{ candidates: [{ finishReason: 'MAX_TOKENS' }] }, 502],
    [{ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'not-json' }] } }] }, 502],
    [{ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify({ isFood: false, ingredients: [] }) }] } }] }, 422],
  ]) await assert.rejects(analyze(image, '', env, mockProviders({ aiPayload: payload }).fetcher, { secondImage }), e => e.status === status);
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

test('reference-backed nutrients come from the fixed USDA records, not the model', async () => {
  const inventory = visualInventory(analysis);
  inventory.ingredients[0].referenceKey = 'fdc-171477';
  inventory.ingredients[1].referenceKey = 'fdc-168878';
  const mock = mockProviders({ inventory });
  const result = await analyze(image, '', env, mock.fetcher, { secondImage });
  assert.equal(mock.calls.length, 1, 'Grounded ingredients also use exactly one AI request');
  assert.deepEqual(Object.fromEntries(Object.keys(FOOD_REFERENCE['fdc-171477'].nutrients).map(key => [key, result.analysis.ingredients[0][key]])), FOOD_REFERENCE['fdc-171477'].nutrients);
  assert.equal(result.analysis.ingredients[0].sourceType, 'reference');
  assert.equal(result.analysis.ingredients[0].sourceConfirmed, false, 'AI pairing is not user confirmation');
  assert.equal(result.analysis.reportVersion, 2);
  assert.equal(analysisReport(result.analysis).referenceCount, 2);
  assert.equal(result.usage.passes.length, 1);
});
test('the full measured portion is applied once; two views do not double the food', async () => {
  const mock = mockProviders();
  const result = await analyze(image, '', env, mock.fetcher, { secondImage, context: { totalWeightG: 500, plateDiameterCm: 26 } });
  assert.equal(analysisReport(result.analysis).weight, 500);
  assert.equal(JSON.parse(mock.calls[0].options.body).contents[0].parts.filter(p => p.inlineData).length, 2);
  assert.equal(mock.calls.length, 1);
  assert.equal(result.usage.passes.length, 1);
  assert.ok(result.analysis.ingredients.every(item => item.gramsMin <= item.grams && item.gramsMax >= item.grams && item.weightBasis === 'measured_total'));
  assert.ok(analysisReport(result.analysis).energyRange.min < analysisReport(result.analysis).total.calories);
  assert.equal(result.analysis.portionScope, 'full_image');
});
test('poor images, invented reference IDs and invalid portion ranges are rejected early', async () => {
  const badQuality = visualInventory(analysis); badQuality.imageQuality.level = 'poor';
  const poor = mockProviders({ inventory: badQuality });
  await assert.rejects(analyze(image, '', env, poor.fetcher, { secondImage }), e => e.status === 422); assert.equal(poor.calls.length, 1);
  const invented = visualInventory(analysis); invented.ingredients[0].referenceKey = 'fdc-FAKE';
  await assert.rejects(analyze(image, '', env, mockProviders({ inventory: invented }).fetcher, { secondImage }), e => e.status === 502);
  const range = visualInventory(analysis); range.ingredients[0].gramsMin = 200;
  await assert.rejects(analyze(image, '', env, mockProviders({ inventory: range }).fetcher, { secondImage }), e => e.status === 502);
  for (const context of [{ consumedPercent: 0 }, { consumedPercent: 101 }, { totalWeightG: -10 }, { plateDiameterCm: '26' }]) assert.throws(() => analysisContext(context), AppError);
});
test('database provenance is removed when a value is edited; impossible macro relationships are flagged', () => {
  const reference = FOOD_REFERENCE['fdc-171705'];
  const ingredient = { name: 'Avokádó', grams: 100, ...reference.nutrients, referenceKey: 'fdc-171705', sourceType: 'reference', sourceConfirmed: true };
  const valid = validateAnalysis({ ...analysis, ingredients: [ingredient] });
  assert.equal(valid.ingredients[0].sourceType, 'reference');
  ingredient.protein += 1;
  const changed = validateAnalysis({ ...analysis, ingredients: [ingredient] });
  assert.equal(changed.ingredients[0].sourceType, 'user'); assert.equal(changed.ingredients[0].referenceKey, null); assert.equal(changed.ingredients[0].sourceConfirmed, false);
  const inconsistent = structuredClone(changed); inconsistent.ingredients[0].calories = 0; inconsistent.ingredients[0].sugar = 100; inconsistent.ingredients[0].saturatedFat = 100;
  assert.equal(analysisReport(inconsistent).warnings.filter(w => !w.startsWith('Van AI')).length, 3);
  const mass = { ...changed, ingredients: [{ ...changed.ingredients[0], protein: 60, carbs: 60, fat: 0, fiber: 0, calories: 480, sugar: 0, saturatedFat: 0 }] };
  assert.equal(analysisReport(mass).warnings.filter(w => !w.startsWith('Van AI')).length, 1, 'Impossible mass composition is flagged even when energy matches');
  assert.equal(analysisReport({ ...analysis, ingredients: [{ ...analysis.ingredients[0], saturatedFat: null }] }).unknown.includes('saturatedFat'), true);
});
test('both Cloudinary views are tracked, saved and deleted; old analysis records still load', async t => {
  const f = fixture(); t.after(() => f.db.close()); const input = { ...f.input(), secondImage, context: { portionScope: 'full_image' } };
  const created = await f.create(input); assert.equal(created.status, 202);
  assert.equal(created.body.meal.context.additionalView, true);
  assert.ok(created.body.meal.photo.additional.url.endsWith('/photo/additional'));
  assert.equal((await f.invoke(`/api/meals/${input.id}`, 'PATCH', created.body.meal)).status, 200);
  assert.equal((await f.invoke(`/api/meals/${input.id}`, 'DELETE')).status, 202); await f.process();
  const destroyed = f.calls.filter(call => call.url.endsWith('/destroy')).map(call => call.options.body.get('public_id'));
  assert.deepEqual(destroyed, [`yumetrics/${input.id}`, `yumetrics/${input.id}-angle`]);
  const legacyInput = f.input(); await f.invoke('/api/analyze', 'POST', legacyInput);
  await f.db.prepare('UPDATE meals SET analysis=? WHERE id=?').bind(JSON.stringify(analysis), legacyInput.id).run();
  const legacy = await f.invoke(`/api/meals/${legacyInput.id}`);
  assert.equal(legacy.status, 200); assert.equal(legacy.body.meal.totals.saturatedFat, null); assert.equal(legacy.body.meal.report.referenceCount, 0);
});
test('analyze → persistent draft → corrected saved meal → calendar → deletion', async t => {
  const f = fixture(); t.after(() => f.db.close()); const input = f.input();
  const created = await f.create(input);
  assert.equal(created.status, 202); assert.equal(created.body.meal.status, 'draft'); assert.equal(created.body.meal.totals.calories, 403.5);
  assert.equal(f.calls.length, 5);
  const repeat = await f.invoke('/api/analyze', 'POST', input); assert.equal(repeat.status, 200); assert.equal(f.calls.length, 5);
  assert.equal(f.calls.filter(call => call.url.startsWith('https://opencode.ai/')).length, 1, 'Resubmitting the same addition does not send another AI request');
  const changed = created.body.meal; Object.assign(changed.analysis.ingredients[0], { grams: 200, gramsMin: 200, gramsMax: 200, weightBasis: 'user' });
  const saved = await f.invoke(`/api/meals/${input.id}`, 'PATCH', changed);
  assert.equal(saved.status, 200); assert.equal(saved.body.meal.status, 'saved'); assert.equal(saved.body.meal.totals.calories, 486);
  const original = await f.db.prepare('SELECT original_analysis,analysis FROM meals WHERE id=?').bind(input.id).first();
  assert.equal(JSON.parse(original.original_analysis).ingredients[0].grams, 150); assert.equal(JSON.parse(original.analysis).ingredients[0].grams, 200);
  const calendar = await f.invoke('/api/meals?month=2026-11'); assert.equal(calendar.body.meals.length, 1);
  assert.equal((await f.invoke('/api/meals?month=2026-12')).body.meals.length, 0);
  assert.equal((await f.invoke(`/api/meals/${input.id}`, 'PATCH', changed)).status, 409);
  assert.equal((await f.invoke(`/api/meals/${input.id}`, 'DELETE')).status, 202); await f.process();
  assert.equal((await f.invoke('/api/meals?month=2026-11')).body.meals.length, 0);
  assert.ok(f.calls.at(-1).url.endsWith('/destroy'));
});
test('an expired in-flight analysis never sends another AI request automatically or commits a stale response', async t => {
  const f = fixture(); t.after(() => f.db.close()); const input = f.input();
  assert.equal((await f.invoke('/api/analyze', 'POST', input)).status, 202);
  let release, signal, calls = 0;
  const paused = new Promise(resolve => { release = resolve; }), started = new Promise(resolve => { signal = resolve; });
  const running = processNextJob({ db: f.db, env, fetcher: async (url, options) => {
    if (url.startsWith('https://opencode.ai/')) { calls++; signal(); await paused; }
    return f.fetcher(url, options);
  } });
  try {
    await started;
    await f.db.prepare('UPDATE analysis_jobs SET lease_until=? WHERE meal_id=?').bind('2000-01-01T00:00:00.000Z', input.id).run();
    assert.equal(await f.process(), false);
    assert.equal(calls, 1);
  } finally { release(); await running; }
  const failed = (await f.invoke(`/api/meals/${input.id}`)).body.meal;
  assert.equal(failed.status, 'failed'); assert.equal(failed.analysis, null);
  assert.equal((await f.db.prepare('SELECT attempts FROM analysis_jobs WHERE meal_id=?').bind(input.id).first()).attempts, 1);
  assert.equal((await f.invoke(`/api/meals/${input.id}/retry`, 'POST')).status, 202);
  await f.process();
  assert.equal((await f.invoke(`/api/meals/${input.id}`)).body.meal.status, 'draft');
  assert.equal(f.calls.filter(call => call.url.startsWith('https://opencode.ai/')).length, 2, 'Only an explicit user retry permits another AI request');
});
test('all nutrient sources reject contradictory masses and subnutrients before saving', () => {
  for (const sourceType of ['user', 'ai', 'reference']) {
    for (const changes of [{ protein: 90, fat: 90 }, { carbs: 0, sugar: 20 }, { fat: 0, saturatedFat: 20 }]) {
      assert.throws(() => validateAnalysis({ ...analysis, ingredients: [{ ...analysis.ingredients[0], sourceType, ...changes }] }), AppError);
    }
  }
  assert.equal(validateAnalysis({ ...analysis, ingredients: [{ ...analysis.ingredients[0], quantityUnit: 'ml', protein: 90, fat: 90 }] }).ingredients[0].quantityUnit, 'ml', 'A volume must not be treated as an equal mass');
});

test('losing the job lease while fetching a photo prevents a paid AI request', async t => {
  for (const expiredOnly of [false, true]) {
    const f = fixture(); t.after(() => f.db.close()); const input = f.input();
    assert.equal((await f.invoke('/api/analyze', 'POST', input)).status, 202);
    let release, signal, calls = 0;
    const paused = new Promise(resolve => { release = resolve; }), started = new Promise(resolve => { signal = resolve; });
    const running = processNextJob({ db: f.db, env, fetcher: async (url, options) => {
      if (url.startsWith('https://res.cloudinary.com/')) { signal(); await paused; }
      if (url.startsWith('https://opencode.ai/')) calls++;
      return f.fetcher(url, options);
    } });
    try {
      await started;
      await f.db.prepare('UPDATE analysis_jobs SET lease_until=? WHERE meal_id=?').bind('2000-01-01T00:00:00.000Z', input.id).run();
      if (!expiredOnly) assert.equal(await f.process(), false);
    } finally { release(); await running; }
    assert.equal(calls, 0, 'An expired or revoked lease must not start a billed request');
    assert.equal((await f.db.prepare('SELECT COUNT(*) AS n FROM ai_requests WHERE meal_id=?').bind(input.id).first()).n, 0);
    assert.equal((await f.invoke(`/api/meals/${input.id}`)).body.meal.analysis, null);
  }
});

test('every read/write is owner-scoped and rejects anonymous and cross-origin writes', async t => {
  const f = fixture(); t.after(() => f.db.close()); const input = f.input(); await f.create(input);
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
  assert.equal((await f.invoke(`/api/meals/${input.id}`, 'DELETE')).status, 202); await f.process();
  assert.equal((await f.invoke(`/api/meals/${input.id}`)).body.meal.job.state, 'failed');
  assert.equal((await f.invoke(`/api/meals/${input.id}`)).status, 200);
  const successful = mockProviders();
  const response = await api(new Request(`http://localhost/api/meals/${input.id}`, { method: 'DELETE' }), { db: f.db, env, userId: 'alice', fetcher: successful.fetcher });
  assert.equal(response.status, 202); await processNextJob({db:f.db, env, fetcher:successful.fetcher}); assert.equal((await f.invoke(`/api/meals/${input.id}`)).status, 404);
});
test('hourly cost limit is atomic and cannot be reset by deleting meals', async t => {
  const f = fixture(); t.after(() => f.db.close());
  for (let i = 0; i < 20; i++) await f.db.prepare('INSERT INTO analysis_attempts(id,user_id,created_at) VALUES(?,?,?)').bind(randomUUID(), 'alice', new Date().toISOString()).run();
  assert.equal((await f.invoke('/api/analyze', 'POST', f.input())).status, 429); assert.equal(f.calls.length, 0);
});
test('failed second-view upload leaves both IDs recoverable for cleanup', async t => {
  const f = fixture({ cloudFailure: 'angle' }); t.after(() => f.db.close()); const input = { ...f.input(), secondImage };
  assert.equal((await f.invoke('/api/analyze', 'POST', input)).status, 502);
  const failed = await f.invoke(`/api/meals/${input.id}`);
  assert.equal(failed.body.meal.status, 'failed'); assert.equal(failed.body.meal.context.additionalView, true); assert.ok(failed.body.meal.photo.additional.pending); assert.ok(!failed.body.meal.photo.pending);
  assert.equal((await f.invoke(`/api/meals/${input.id}`, 'DELETE')).status, 202); await f.process();
  assert.deepEqual(f.calls.filter(call => call.url.endsWith('/destroy')).map(call => call.options.body.get('public_id')), [`yumetrics/${input.id}`, `yumetrics/${input.id}-angle`]);
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
test('v1 SQLite database upgrades without rewriting saved meals', async () => {
  const directory = mkdtempSync(resolve('.test-data-')), path = resolve(directory, 'legacy.sqlite');
  let database;
  try {
    const old = new DatabaseSync(path);
    old.exec(readFileSync(new URL('../drizzle/0000_initial.sql', import.meta.url), 'utf8'));
    old.exec(readFileSync(new URL('../drizzle/0001_timezone.sql', import.meta.url), 'utf8'));
    old.exec("CREATE TABLE schema_migrations(name TEXT PRIMARY KEY); INSERT INTO schema_migrations VALUES('0000_initial'),('0001_timezone');");
    old.prepare("INSERT INTO meals(id,user_id,day,time,type,public_id,created_at,updated_at,status,analysis,original_analysis) VALUES(?,?,?,?,?,?,?,?,?,?,?)").run('legacy', 'alice', '2026-11-06', '12:00', 'Ebéd', 'yumetrics/legacy', '2026-11-06', '2026-11-06', 'saved', JSON.stringify(analysis), JSON.stringify(analysis));
    old.close();
    database = openDatabase(path);
    const row = await database.prepare('SELECT * FROM meals WHERE id=?').bind('legacy').first();
    assert.equal(row.analysis, JSON.stringify(analysis)); assert.equal(row.original_analysis, JSON.stringify(analysis)); assert.equal(row.analysis_context, null); assert.equal(row.status, 'saved');
  } finally { database?.close(); rmSync(directory, { recursive: true, force: true }); }
});
