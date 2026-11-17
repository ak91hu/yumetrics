import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { openDatabase } from '../lib/database.mjs';
import { api } from '../lib/api.mjs';
import { processNextJob } from '../lib/jobs.mjs';
import { validateAnalysis, totals } from '../lib/domain.mjs';
import { validBarcode, normalizeOffProduct, barcodeInput, barcodeAnalysis } from '../lib/barcode.mjs';

const jpeg = Buffer.concat([Buffer.from([255, 216, 255, 224]), Buffer.alloc(200)]);
const photo = 'data:image/jpeg;base64,' + jpeg.toString('base64');
const offProduct = { code: '4006381333931', product_name: 'Test drink', product_name_hu: 'Teszt üdítő', brands: 'Brand, Other', quantity: '330 ml', serving_quantity: 330, nutriments: { 'energy-kcal_100g': 42, proteins_100g: 0, carbohydrates_100g: 10.6, fat_100g: 0, sugars_100g: 10.6, salt_100g: .0125 } };

test('GTIN check digits and OFF normalization keep units and unknown values honest', () => {
  assert.equal(validBarcode('4006381333931'), true); assert.equal(validBarcode('4006381333932'), false);
  assert.equal(validBarcode('96385074'), true); assert.equal(validBarcode('12345'), false); assert.equal(validBarcode('036000291452'), true);
  const product = normalizeOffProduct(offProduct, 'hu');
  assert.deepEqual({ name: product.name, brand: product.brand, unit: product.unit, suggested: product.suggestedQuantity }, { name: 'Teszt üdítő', brand: 'Brand', unit: 'ml', suggested: 330 });
  assert.equal(product.per100.calories, 42); assert.equal(product.per100.sodium, 5); assert.equal(product.per100.fiber, null, 'missing fibre is unknown, not zero');
  assert.equal(normalizeOffProduct({ ...offProduct, nutriments: { proteins_100g: 1 } }).per100, null);
  assert.equal(normalizeOffProduct({ ...offProduct, code: '123' }), null);
});

test('the barcode diary entry is label value × quantity and passes the normal validation', () => {
  const input = barcodeInput({ ...normalizeOffProduct(offProduct), quantity: 500 });
  const analysis = validateAnalysis(barcodeAnalysis(input, 'hu'));
  assert.equal(analysis.ingredients[0].quantityUnit, 'ml'); assert.equal(totals(analysis.ingredients).calories, 210);
  assert.equal(analysis.ingredients[0].sourceType, 'user'); assert.match(analysis.assumptions, /Open Food Facts/);
  assert.equal(barcodeInput({ ...input, quantity: 0 }), null); assert.equal(barcodeInput({ ...input, code: '4006381333932' }), null);
  assert.equal(barcodeInput({ ...input, per100: { ...input.per100, fat: null } }), null);
});

test('a barcode upload stores the photo and completes without any AI request; the OFF proxy is limited and stores nothing', async t => {
  const db = openDatabase(':memory:'); t.after(() => db.close());
  const userId = randomUUID(), time = new Date().toISOString();
  await db.prepare('INSERT INTO users(id,google_sub,email,name,created_at,updated_at) VALUES(?,?,?,?,?,?)').bind(userId, userId, 'user@example.test', 'Teszt', time, time).run();
  const env = { CLOUDINARY_CLOUD_NAME: 'test-cloud', CLOUDINARY_API_KEY: 'k', CLOUDINARY_API_SECRET: 's' };
  const calls = [];
  const fetcher = async (url, options) => {
    calls.push(url);
    if (url.endsWith('/upload')) return Response.json({ public_id: options.body.get('public_id'), secure_url: `https://res.cloudinary.com/test-cloud/image/authenticated/v1/${options.body.get('public_id')}.jpg`, width: 100, height: 80 });
    if (url.startsWith('https://res.cloudinary.com/')) return new Response(jpeg, { headers: { 'Content-Type': 'image/jpeg' } });
    if (url.startsWith('https://world.openfoodfacts.org/api/v2/product/4006381333931.json')) { assert.match(options.headers['User-Agent'], /^Yumetrics\//); return Response.json({ product: offProduct }); }
    throw Error('Unexpected ' + url);
  };
  const call = (path, init = {}) => api(new Request('http://localhost' + path, { ...init, headers: { 'content-type': 'application/json', ...(init.headers || {}) } }), { db, env, userId, fetcher });
  const proxied = await (await call('/api/barcode/4006381333931')).json();
  assert.equal(proxied.product.per100.calories, 42);
  assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM food_api_cache").bind().first()).n, 0, 'OFF answers are not cached server-side');
  assert.equal((await call('/api/barcode/4006381333932')).status, 400);
  for (let i = 0; i < 9; i++) assert.equal((await call('/api/barcode/4006381333931')).status, 200);
  assert.equal((await call('/api/barcode/4006381333931')).status, 429);

  const id = randomUUID();
  const body = { id, image: photo, day: '2026-11-17', time: '12:00', type: 'Kisétkezés', barcode: { ...proxied.product, quantity: 330 } };
  assert.equal((await call('/api/analyze', { method: 'POST', body: JSON.stringify({ ...body, id: randomUUID(), barcode: { ...body.barcode, quantity: -1 } }) })).status, 400);
  assert.equal((await call('/api/analyze', { method: 'POST', body: JSON.stringify(body) })).status, 202);
  await processNextJob({ db, env, fetcher });
  const meal = (await (await call('/api/meals/' + id)).json()).meal;
  assert.equal(meal.status, 'draft'); assert.equal(meal.model, 'barcode/open-food-facts');
  assert.equal(meal.analysis.ingredients[0].grams, 330); assert.equal(meal.totals.calories, 138.6);
  assert.ok(meal.photo.url, 'the photo is still stored for the diary');
  assert.ok(!calls.some(url => url.startsWith('https://opencode.ai/') || url.includes('typesafe')), 'no model call on the barcode branch');
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM ai_requests').bind().first()).n, 0);
  assert.equal(JSON.parse((await db.prepare('SELECT usage FROM meals WHERE id=?').bind(id).first()).usage).pipeline.path, 'barcode');
});
