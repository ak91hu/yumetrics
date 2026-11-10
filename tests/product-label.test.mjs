import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { normalizeLabel, labelNutrients } from '../lib/product-label.mjs';
import { analyze } from '../lib/providers.mjs';
import { validateAnalysis, analysisReport, totals } from '../lib/domain.mjs';
import { openDatabase, openPostgresDatabase } from '../lib/database.mjs';
import { userProfile } from '../lib/profile-stats.mjs';
import { FOOD_REFERENCE } from '../lib/food-reference.mjs';
import { REFERENCE_STATES } from '../lib/hungarian-food.mjs';
import { api } from '../lib/api.mjs';
import { aiPayloadFor, visualInventory, secondImage, productLabelFixture } from './fixtures.mjs';

const image = 'data:image/jpeg;base64,' + Buffer.concat([Buffer.from([255, 216, 255, 224]), Buffer.alloc(200)]).toString('base64');
const estimated = { name: 'Guess', grams: 150, quantityUnit: 'ml', foodState: 'as_sold', calories: 50, protein: 1, carbs: 10, fat: 1, fiber: null, sugar: 8, sodium: null, saturatedFat: null };
async function recognize(label, options = {}) {
  const analysis = { name: 'Test', confidence: 'high', ingredients: [{ ...estimated, ...options.item, productLabel: label }] };
  const inventory = visualInventory(analysis); inventory.imageQuality = { level: 'good', issues: [] };
  Object.assign(inventory.ingredients[0], options.inventory || {});
  let calls = 0, request;
  try {
    const result = await analyze(image, '', { OPENCODE_API_KEY: 'test' }, async (url, args) => {
      calls++; request = JSON.parse(args.body); const payload = aiPayloadFor(analysis, args, inventory);
      if (options.omitNutrients) { const raw = JSON.parse(payload.candidates[0].content.parts[0].text); for (const item of raw.ingredients) item.nutrients = null; payload.candidates[0].content.parts[0].text = JSON.stringify(raw); }
      return Response.json(payload);
    }, { secondImage, context: options.context });
    assert.equal(calls, 1); return { ...result, request };
  } catch (error) { assert.equal(calls, 1, 'No automatic second AI request'); throw error; }
}

test('readable packaged drinks use original label values and ml; full packs are counted once without density guesses', async () => {
  const { analysis, request } = await recognize(productLabelFixture({ packageCount: 2 }), { inventory: { quantityUnit: 'g', grams: 999, referenceKey: 'fdc-171705' } });
  const item = analysis.ingredients[0], report = analysisReport(analysis);
  assert.equal(item.name, 'Test drink'); assert.equal(item.quantityUnit, 'ml'); assert.equal(item.grams, 660);
  assert.equal(item.gramsMin, 660); assert.equal(item.gramsMax, 660); assert.equal(item.weightBasis, 'label');
  assert.equal(item.sourceType, 'label'); assert.equal(item.referenceKey, null);
  assert.equal(item.calories, 42); assert.equal(item.sodium, 5); assert.equal(item.fiber, null);
  assert.equal(item.productLabel.nutrients.saltG, .0125); assert.equal(item.productLabel.barcodeValid, true);
  assert.equal(report.total.calories, 277.2); assert.equal(report.volume, 660); assert.equal(report.weight, null); assert.equal(report.labelCount, 1);
  assert.equal(analysis.confidence, 'high');
  assert.equal(request.contents[0].parts.filter(part => part.inlineData).length, 2);
  for (const phrase of ['Drinks', 'sweets', '1 ml=1 g', 'RI%', 'polyol', 'Total Carbohydrate', 'VISIBLE WHOLE packages']) assert.ok(request.systemInstruction.parts[0].text.includes(phrase));
});

test('readable label nutrients may be omitted from the duplicate item fields', async () => {
  const result = await recognize(productLabelFixture(), { omitNutrients: true });
  const item = result.analysis.ingredients[0];
  assert.equal(item.sourceType, 'label'); assert.equal(item.calories, 42); assert.equal(item.grams, 330);
  assert.deepEqual(item.productLabel.nutrients, normalizeLabel(productLabelFixture()).nutrients);
});

test('portion labels, US total carbs, kJ-only energy and salt are normalized on the server with original precision retained', () => {
  const label = normalizeLabel(productLabelFixture({ basisAmount: 30, basisUnit: 'g', netUnit: 'g',
    carbsIncludeFiber: true, nutrients: { calories: null, energyKj: 334.72, protein: 1.5, carbs: 10, fat: 3, fiber: 3, sugar: 2, saturatedFat: 1, sodium: null, saltG: .015 } }));
  const n = labelNutrients(label);
  assert.equal(n.calories, 266.666667); assert.equal(n.carbs, 23.333333); assert.equal(n.fiber, 10); assert.equal(n.sodium, 20);
  assert.equal(label.nutrients.energyKj, 334.72); assert.equal(label.basisAmount, 30);
  assert.equal(normalizeLabel(productLabelFixture({ barcode: '4006381333932' })).barcodeValid, false);
  for (const changes of [{ basisAmount: null }, { basisUnit: null }, { prepared: null }, { carbsIncludeFiber: null }, { nutrients: { ...label.nutrients, fiber: null } }]) assert.equal(labelNutrients(normalizeLabel({ ...label, ...changes })), null);
});

test('sweets and sugar-free polyols retain printed energy instead of a fabricated recipe or 4/4/9 override', async () => {
  const label = productLabelFixture({ productName: 'Sugar-free sweets', netAmount: 50, netUnit: 'g', basisUnit: 'g', ingredientsText: 'Sweetener: maltitol.',
    nutrients: { calories: 240, energyKj: 1004.16, protein: 0, carbs: 96, fat: 0, fiber: 0, sugar: 0, sodium: 0, saturatedFat: 0, saltG: 0 } });
  const { analysis } = await recognize(label, { item: { quantityUnit: 'g' } });
  assert.equal(analysis.ingredients.length, 1); assert.equal(totals(analysis.ingredients).calories, 120);
  assert.equal(analysis.ingredients[0].sourceType, 'label'); assert.ok(!analysisReport(analysis).warnings.some(warning => warning.includes('jelentősen eltér')));
});

test('decimal pack sizes retain their declared basis and precision after analysis and validation', async () => {
  for (const [netAmount, count, expected] of [[10.1, 3, 30.3], [10.1234, 3, 30.3702]]) {
    const label = productLabelFixture({ netAmount, packageCount: count, netUnit: 'g', basisUnit: 'g' });
    const { analysis } = await recognize(label, { item: { quantityUnit: 'g' } });
    assert.equal(analysis.ingredients[0].grams, expected);
    assert.equal(analysis.ingredients[0].gramsMin, expected); assert.equal(analysis.ingredients[0].gramsMax, expected);
    assert.equal(analysis.ingredients[0].weightBasis, 'label');
    assert.equal(validateAnalysis(analysis).ingredients[0].weightBasis, 'label');
  }
});

test('label consistency tolerances use the normalized basis, including very small servings', () => {
  const base = productLabelFixture({ basisAmount: 1, nutrients: { ...productLabelFixture().nutrients, protein: 0, carbs: 0, fat: 0, sugar: 0, calories: 0, sodium: 0, saltG: 0 } });
  assert.throws(() => labelNutrients(normalizeLabel({ ...base, nutrients: { ...base.nutrients, energyKj: 20 } })), /kcal/);
  assert.throws(() => labelNutrients(normalizeLabel({ ...base, nutrients: { ...base.nutrients, saltG: .02 } })), /nátrium/);
  assert.equal(labelNutrients(normalizeLabel(base)).calories, 0);
});

test('manual corrections remain saveable while a contradictory historical label is retained as evidence', () => {
  const label = productLabelFixture({ basisAmount: 1, nutrients: { ...productLabelFixture().nutrients, calories: 0, energyKj: 20, protein: 0, carbs: 0, fat: 0, sugar: 0 } });
  const corrected = { name: label.productName, grams: 100, quantityUnit: 'ml', foodState: 'as_sold', sourceType: 'user', productLabel: label, calories: 478, protein: 0, carbs: 100, fat: 0, fiber: null, sugar: 0, sodium: null, saturatedFat: 0 };
  const analysis = validateAnalysis({ name: label.productName, confidence: 'medium', ingredients: [corrected] });
  assert.equal(analysis.ingredients[0].sourceType, 'user'); assert.equal(analysis.ingredients[0].calories, 478);
  assert.equal(analysis.ingredients[0].productLabel.nutrients.calories, 0);
  assert.throws(() => validateAnalysis({ ...analysis, ingredients: [{ ...corrected, sourceType: 'label' }] }), /kcal/);
});

test('open packages retain the visible amount; incomplete or mismatched prepared labels never claim label-derived nutrition', async () => {
  const open = await recognize(productLabelFixture({ packageCount: null }));
  assert.equal(open.analysis.ingredients[0].grams, 150); assert.equal(open.analysis.ingredients[0].weightBasis, 'visual'); assert.equal(open.analysis.confidence, 'medium');
  for (const changes of [{ nutrients: { ...productLabelFixture().nutrients, protein: null } }, { prepared: true }, { basisAmount: null }]) {
    const result = await recognize(productLabelFixture(changes));
    assert.equal(result.analysis.ingredients[0].sourceType, 'ai'); assert.equal(result.analysis.ingredients[0].calories, 50);
    assert.ok(result.analysis.ingredients[0].productLabel); assert.equal(result.analysis.confidence, 'medium');
  }
  const water = await recognize(null, { item: { calories: 0, protein: 0, carbs: 0, fat: 0, sugar: 0, sodium: 0 } });
  assert.equal(totals(water.analysis.ingredients).calories, 0); assert.equal(water.analysis.ingredients[0].quantityUnit, 'ml');
});

test('as-sold package weight never replaces the quantity of prepared or reconstituted food', async () => {
  for(const prepared of [true,false,null]){
    const label=productLabelFixture({prepared,netAmount:100,netUnit:'g',basisUnit:'g'});
    const {analysis}=await recognize(label,{item:{grams:300,quantityUnit:'g',foodState:'prepared'}});
    assert.equal(analysis.ingredients[0].grams,300);
    assert.equal(analysis.ingredients[0].weightBasis,'visual');
    assert.equal(analysis.ingredients[0].sourceType,prepared===true?'label':'ai');
    assert.equal(totals(analysis.ingredients).calories,prepared===true?126:150);
    assert.equal(validateAnalysis(analysis).ingredients[0].weightBasis,'visual');
  }
});

test('readable label nutrients remain usable when the printed name is unreadable, without inventing a product identity', async () => {
  const {analysis}=await recognize(productLabelFixture({productName:null}),{omitNutrients:true});
  const item=analysis.ingredients[0];
  assert.equal(item.name,'Guess');assert.equal(item.productLabel.productName,null);
  assert.equal(item.sourceType,'label');assert.equal(item.calories,42);
  assert.equal(totals(analysis.ingredients).calories,138.6);assert.equal(analysis.confidence,'medium');
  assert.ok(analysisReport(analysis).warnings.some(warning=>warning.includes('termék neve nem')));
  assert.equal(validateAnalysis(analysis).ingredients[0].sourceType,'label');
});

test('a prepared-product ml table is not applied to dry powder in g or mistaken for a density conflict',async()=>{
  const label=productLabelFixture({prepared:true,netAmount:100,netUnit:'g',basisUnit:'ml'});
  const {analysis}=await recognize(label,{item:{grams:100,quantityUnit:'g',foodState:'as_sold'}});
  const item=analysis.ingredients[0];
  assert.equal(item.sourceType,'ai');assert.equal(item.quantityUnit,'g');assert.equal(item.grams,100);
  assert.equal(item.calories,50);assert.equal(totals(analysis.ingredients).calories,50);
  assert.equal(item.productLabel.basisUnit,'ml');assert.equal(item.productLabel.prepared,true);
});

test('ambiguous bases, impossible label values and g/ml conflicts fail after exactly one request', async () => {
  await assert.rejects(recognize(productLabelFixture({ packageCount: null }), { item: { quantityUnit: 'g' } }));
  await assert.rejects(recognize(productLabelFixture(), { context: { totalWeightG: 330 } }), /sűrűség/);
  for (const changes of [
    { netUnit: 'oz' }, { packageCount: 1.5 }, { netAmount: -1 }, { netAmount: 0 }, { basisAmount: 0 },
    { nutrients: { ...productLabelFixture().nutrients, energyKj: 9999 } },
    { nutrients: { ...productLabelFixture().nutrients, sodium: 9999 } },
    { nutrients: { ...productLabelFixture().nutrients, sugar: 99 } },
  ]) await assert.rejects(recognize(productLabelFixture(changes)));
});

test('a gram-based reference is rejected for an ml ingredient with a truthful explanation', async () => {
  const key = Object.keys(FOOD_REFERENCE)[0];
  const { analysis } = await recognize(null, { item: { foodState: REFERENCE_STATES[key] }, inventory: { referenceKey: key } });
  assert.equal(analysis.ingredients[0].sourceType, 'ai'); assert.equal(analysis.ingredients[0].referenceKey, null);
  assert.ok(analysis.ingredients[0].portionNote.includes('mértékegysége'));
});

test('mixed food and drink totals keep g/ml separate, and recipe scaling uses measured cooked yield', async () => {
  const { analysis } = await recognize(productLabelFixture());
  const solid = validateAnalysis({ name: 'Cake', confidence: 'medium', ingredients: [{ ...estimated, name: 'Cake', quantityUnit: 'g', grams: 50 }] }).ingredients[0];
  const mixed = validateAnalysis({ name: 'Cake and drink', confidence: 'medium', ingredients: [solid, ...analysis.ingredients] });
  const report = analysisReport(mixed);
  assert.equal(report.weight, 50); assert.equal(report.volume, 330); assert.equal(report.total.calories, 163.6);
  assert.equal(report.energyRange.min, 163.6); assert.equal(report.energyRange.max, 163.6);
  const recipe = validateAnalysis({ ...mixed, recipe: { cookedWeightG: 400, eatenWeightG: 100, lossesAccountedFor: true, ingredients: mixed.ingredients } });
  assert.equal(analysisReport(recipe).weight, 100); assert.equal(analysisReport(recipe).volume, null);
  assert.equal(totals(recipe.ingredients).calories, 40.9);
  assert.deepEqual(validateAnalysis(recipe), recipe, 'Repeated saves do not rescale recipe quantities twice');
});

for (const dialect of ['sqlite', 'postgres']) test(`${dialect}: label snapshots and ml survive save/reload; edits and forged label data cannot retain verified source claims`, { skip: dialect === 'postgres' && !process.env.TEST_DATABASE_URL }, async t => {
  const db = dialect === 'postgres' ? await openPostgresDatabase(process.env.TEST_DATABASE_URL) : openDatabase(':memory:');
  const userId = randomUUID(), id = randomUUID(), now = '2026-11-08T12:00:00Z';
  t.after(async () => { await db.prepare('DELETE FROM meals WHERE user_id=?').bind(userId).run(); await db.prepare('DELETE FROM users WHERE id=?').bind(userId).run(); await db.close(); });
  await db.prepare('INSERT INTO users(id,google_sub,email,name,created_at,updated_at) VALUES(?,?,?,?,?,?)').bind(userId, userId, 'label@example.test', 'Test', now, now).run();
  const { analysis } = await recognize(productLabelFixture());
  await db.prepare('INSERT INTO meals(id,user_id,day,time,type,status,analysis,original_analysis,photo,public_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').bind(id, userId, '2026-11-08', '12:00', 'Kisétkezés', 'draft', JSON.stringify(analysis), JSON.stringify(analysis), '{}', id, now, now).run();
  const call = (method, body) => api(new Request('http://localhost/api/meals/' + id, { method, headers: { 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) }), { db, env: {}, userId });
  let { meal } = await (await call('GET')).json();
  assert.equal((await call('PATCH', meal)).status, 200);
  meal = (await (await call('GET')).json()).meal;
  assert.equal(meal.analysis.ingredients[0].sourceType, 'label'); assert.equal(meal.report.volume, 330); assert.equal(meal.report.weight, null);
  const profile = await userProfile(db, userId, 'Europe/Budapest', new Date(now));
  assert.equal(profile.statistics.periods[7].averagePerMeal.calories, 138.6);
  meal.analysis.ingredients[0].calories = 99;
  let response = await call('PATCH', meal); assert.equal(response.status, 200);
  meal = (await response.json()).meal;
  assert.equal(meal.analysis.ingredients[0].sourceType, 'user'); assert.equal(meal.analysis.ingredients[0].productLabel.nutrients.calories, 42);
  meal.analysis.ingredients[0].productLabel.nutrients.calories = 99;
  meal.analysis.ingredients[0].sourceType = 'label';
  response = await call('PATCH', meal); assert.equal(response.status, 200);
  meal = (await response.json()).meal;
  assert.equal(meal.analysis.ingredients[0].sourceType, 'user'); assert.equal(meal.analysis.ingredients[0].productLabel, undefined);
});
