import test from 'node:test';
import assert from 'node:assert/strict';
import { analyze } from '../lib/providers.mjs';
import { openDatabase } from '../lib/database.mjs';
import { JEV_ENDPOINT, NONE, normalizeOption, optionMap, routedConfidence, HIDDEN_FAT_NOTE } from '../lib/jev.mjs';
import { plausibleEnergy, tokenOverlap } from '../lib/free-food-data.mjs';
import { aiPayloadFor, visualInventory } from './fixtures.mjs';

const photo = 'data:image/jpeg;base64,' + Buffer.concat([Buffer.from([255, 216, 255, 224]), Buffer.alloc(200)]).toString('base64');
const env = { OPENCODE_MODEL: 'gemini-3.5-flash-lite', OPENCODE_API_KEY: 'test', JEV_API: 'test-jev', USDA_API_KEY: 'test-usda', FREE_FOOD_SOURCES: 'usda' };
const meal = {
  name: 'Sertéspörkölt nokedlivel', confidence: 'high', assumptions: 'Tesztadat.', dishProfile: 'porkolt',
  ingredients: [
    { name: 'Sertéspörkölt hús', grams: 180, quantityUnit: 'g', calories: 210, protein: 25, carbs: 2, fat: 11, fiber: 0, sugar: 1, sodium: 300, saturatedFat: 4 },
    { name: 'Nokedli', grams: 200, quantityUnit: 'g', calories: 140, protein: 4.5, carbs: 25, fat: 2, fiber: 1, sugar: 0.5, sodium: 10, saturatedFat: 0.5 },
  ],
};
function visionPayload() {
  const inventory = visualInventory(meal);
  inventory.imageQuality = { level: 'good', issues: [] };
  inventory.ingredients[0].lookupQuery = 'pork stew meat, braised';
  inventory.ingredients[1].lookupQuery = 'egg noodles, cooked';
  for (const item of inventory.ingredients) item.identityUncertain = false;
  return aiPayloadFor(meal, null, inventory);
}
const usdaDetail = (fdcId, description, calories) => ({ fdcId, description, dataType: 'SR Legacy', foodNutrients: Object.entries({ 1008: ['kcal', calories], 1003: ['g', 26], 1005: ['g', 1], 1004: ['g', 10], 1079: ['g', 0], 1093: ['mg', 80], 1258: ['g', 3.5] }).map(([id, [unitName, amount]]) => ({ nutrient: { id: Number(id), unitName }, amount })) });
const SEARCH = {
  'pork stew meat, braised': [{ fdcId: 1001, description: 'Pork, fresh, shoulder, blade, separable lean only, cooked, braised', dataType: 'SR Legacy' }, { fdcId: 1002, description: 'Pork, cured, ham, whole, cooked, roasted', dataType: 'SR Legacy' }],
  'egg noodles, cooked': [{ fdcId: 2001, description: 'Noodles, egg, cooked, enriched, with added salt', dataType: 'SR Legacy' }],
};
const DETAIL = { 1001: usdaDetail(1001, SEARCH['pork stew meat, braised'][0].description, 199), 1002: usdaDetail(1002, SEARCH['pork stew meat, braised'][1].description, 600), 2001: usdaDetail(2001, SEARCH['egg noodles, cooked'][0].description, 138) };

// pick(question id, criteria) -> option name; status != 200 simulates an outage.
function harness({ pick = {}, status = 200, noul = { q4: .9, q5: .1, q6: .85 } } = {}) {
  const calls = { jev: [], gemini: 0, usda: 0 };
  const fetcher = async (url, options) => {
    if (url === JEV_ENDPOINT) {
      assert.equal(options.headers.Authorization, 'Bearer test-jev');
      const body = JSON.parse(options.body); calls.jev.push(body);
      if (status !== 200) return new Response('{"detail":"overloaded"}', { status });
      const answers = Object.fromEntries(Object.entries(body.questions).map(([id, question]) => {
        if (question.type === 'noul') return [id, { type: 'noul', noul: noul[id] ?? .5 }];
        const options = Object.keys(question.criteria);
        const choice = pick[id]?.(options) ?? (id === 'q1' ? 'Pörkölt vagy paprikás körettel' : id.startsWith('q3') ? 'boiled' : options.find(o => /blade|noodles, egg, cooked/.test(o)) ?? NONE);
        return [id, { type: 'choice', choice, confidence: .9, probabilities: { [choice]: .9 } }];
      }));
      return Response.json({ model: 'jev-1.14.0', answers, usage: { input_tokens: 1000, output_tokens: 40 } });
    }
    if (url.includes(':generateContent')) { calls.gemini++; return Response.json(visionPayload()); }
    if (url.startsWith('https://api.nal.usda.gov/')) {
      calls.usda++;
      if (url.includes('foods/search')) return Response.json({ foods: SEARCH[JSON.parse(options.body).query] || [] });
      return Response.json(DETAIL[url.match(/food\/(\d+)/)[1]]);
    }
    throw Error('Unexpected endpoint ' + url);
  };
  return { calls, fetcher };
}

test('one Jev request decides Q1–Q6; the chosen near-match record is used and the meal stays on the fast path', async () => {
  const { calls, fetcher } = harness();
  const result = await analyze(photo, 'SECRET_NOTE', env, fetcher);
  assert.equal(calls.gemini, 1); assert.equal(calls.jev.length, 1);
  const body = calls.jev[0];
  assert.equal(body.model, 'jev-1.14.0');
  assert.ok(!JSON.stringify(body).includes('SECRET_NOTE') && !JSON.stringify(body).includes('data:image'), 'Jev receives text facts only, no notes or images');
  assert.deepEqual(Object.keys(body.questions).sort(), ['q1', 'q2_0', 'q2_1', 'q3_0', 'q3_1', 'q4', 'q5', 'q6']);
  assert.ok(Object.hasOwn(body.questions.q2_0.criteria, NONE), '"none of these" is always offered');
  assert.ok(!Object.values(body.questions).some(question => 'usesState' in question));
  const [pork, noodles] = result.analysis.ingredients;
  assert.match(pork.referenceKey, /^ext-usda-1001-/); assert.equal(pork.sourceType, 'reference'); assert.equal(pork.calories, 199);
  assert.match(noodles.referenceKey, /^ext-usda-2001-/);
  assert.equal(pork.preparation, 'főtt');
  assert.ok(result.analysis.assumptions.includes(HIDDEN_FAT_NOTE));
  assert.deepEqual(result.usage.foodData.evidence.map(row => row.method), ['jev', 'jev']);
  const pipeline = result.usage.pipeline;
  assert.equal(pipeline.path, 'fast'); assert.deepEqual(pipeline.reasons, []);
  assert.deepEqual(pipeline.modelVersions, { vision: 'gemini-3.5-flash-lite', jev: 'jev-1.14.0', foodR1: null });
  assert.ok(pipeline.kcal.low <= pipeline.kcal.mid && pipeline.kcal.mid <= pipeline.kcal.high);
  assert.equal(result.usage.foodData.jev.inputTokens, 1000); assert.ok(Math.abs(result.usage.foodData.jev.costUsd - 0.000042) < 1e-12);
});

test('"none of these" keeps the AI estimate and escalates; a doubtful mixed dish never stays high confidence', async () => {
  const { fetcher } = harness({ pick: { q2_0: () => NONE }, noul: { q4: .1, q5: .1, q6: .1 } });
  const result = await analyze(photo, '', env, fetcher);
  assert.equal(result.analysis.ingredients[0].sourceType, 'ai'); assert.equal(result.analysis.ingredients[0].calories, 210);
  assert.equal(result.usage.foodData.evidence[0].decision, 'none');
  assert.equal(result.usage.pipeline.path, 'escalated');
  assert.deepEqual(result.usage.pipeline.reasons.sort(), ['item_none', 'mixed_dish']);
  assert.notEqual(result.analysis.confidence, 'high');
  assert.ok(!result.analysis.assumptions.includes(HIDDEN_FAT_NOTE));
});

test('a selected record with an implausible energy density is rejected', async () => {
  const { fetcher } = harness({ pick: { q2_0: options => options.find(o => o.includes('ham')) } });
  const result = await analyze(photo, '', env, fetcher);
  assert.equal(result.analysis.ingredients[0].sourceType, 'ai');
  assert.equal(result.usage.foodData.evidence[0].rejected, 'energy_mismatch');
  assert.equal(plausibleEnergy({ record: { nutrients: { calories: 600 } } }, { nutrients: { calories: 210 } }), false);
  assert.equal(plausibleEnergy({ record: { nutrients: { calories: 199 } } }, { nutrients: { calories: 210 } }), true);
});

test('a Jev outage falls back to the first search hit and marks the result uncertain', async () => {
  const { calls, fetcher } = harness({ status: 529 });
  const result = await analyze(photo, '', env, fetcher);
  assert.equal(calls.jev.length, 1, 'no automatic retry inside one analysis');
  assert.equal(result.usage.pipeline.path, 'fallback'); assert.deepEqual(result.usage.pipeline.reasons, ['jev_unavailable']);
  assert.ok(result.usage.foodData.evidence.every(row => row.method === 'first_hit' && row.state === 'provisional_identity'));
  assert.equal(result.analysis.confidence, 'low');
  assert.equal(result.analysis.ingredients[0].preparation, 'Elkészítve', 'no Jev preparation without an answer');
});

test('decisions are cached per question in the shared cache, keyed by the pinned model', async t => {
  const db = openDatabase(':memory:'); t.after(() => db.close());
  const first = harness();
  await analyze(photo, '', env, first.fetcher, { db });
  const second = harness();
  const result = await analyze(photo, '', env, second.fetcher, { db });
  assert.equal(second.calls.jev.length, 0); assert.equal(second.calls.usda, 0);
  assert.equal(result.usage.foodData.jev.state, 'cached'); assert.equal(result.usage.pipeline.path, 'fast');
  const keys = await db.prepare("SELECT cache_key FROM food_api_cache WHERE cache_key LIKE 'jev:%'").bind().all();
  assert.equal(keys.results.length, 8); assert.ok(keys.results.every(row => row.cache_key.startsWith('jev:jev-1.14.0:')));
  const third = harness();
  await analyze(photo, '', { ...env, JEV_MODEL: 'jev-1.13.0' }, third.fetcher, { db });
  assert.equal(third.calls.jev.length, 1, 'a model change invalidates old decisions');
});

test('without a Jev key or with an alias model nothing is sent to TypeSafe and the confidence is not reduced', async () => {
  for (const changes of [{ JEV_API: '' }, { JEV_MODEL: 'jev-latest' }]) {
    const { calls, fetcher } = harness();
    const result = await analyze(photo, '', { ...env, ...changes }, fetcher);
    assert.equal(calls.jev.length, 0); assert.equal(result.usage.pipeline.path, 'fallback');
    // No key: the previous behaviour, unchanged. A configured key with an alias is the uncertain fallback.
    assert.equal(result.analysis.confidence, 'JEV_API' in changes ? 'medium' : 'low');
  }
});

test('option names are normalized and unique; routing only lowers confidence', () => {
  assert.equal(normalizeOption('  Pork ,  fresh,shoulder\n'), 'pork, fresh, shoulder');
  assert.deepEqual([...optionMap([{ description: 'Rice, cooked' }, { description: 'rice ,cooked' }, { description: NONE }]).keys()], ['rice, cooked', 'rice, cooked (2)']);
  assert.equal(routedConfidence('high', { path: 'escalated', reasons: ['mixed_dish'] }), 'medium');
  assert.equal(routedConfidence('low', { path: 'fast', reasons: [] }), 'low');
  assert.equal(routedConfidence('high', { path: 'escalated', reasons: ['preparation_conflict'] }), 'medium');
  assert.equal(routedConfidence('high', { path: 'fallback', reasons: ['jev_unavailable'] }), 'low');
  assert.ok(tokenOverlap('egg noodles, cooked', 'Noodles, egg, cooked, enriched') > 0);
  assert.equal(tokenOverlap('cooked', 'Rice, cooked'), 0, 'generic words alone never shortlist a record');
});

test('Q2 uses the probability mass of the chosen record variant group; salt/draining variants are one food', async () => {
  const { variantKey, decisionScore, interpretDecisions, mealQuestions } = await import('../lib/jev.mjs');
  assert.equal(variantKey('Asparagus, cooked, boiled, drained, without salt'), variantKey('asparagus, cooked, boiled, drained, with salt'));
  assert.notEqual(variantKey('cheese, goat, soft type'), variantKey('cheese, goat, hard type'));
  const names = ['a, raw, with salt', 'a, raw, without salt', 'b, raw', NONE];
  assert.equal(decisionScore({ choice: names[0], confidence: .35, probabilities: { [names[0]]: .4, [names[1]]: .45, [names[2]]: .1, [NONE]: .05 } }, names), .85);
  assert.equal(decisionScore({ choice: names[0], confidence: .35 }, names), .35, 'without probabilities the confidence is used');
  const raw = { name: 'X', dishProfile: 'generic', ingredients: [{ name: 'A', lookupQuery: 'a', foodState: 'raw', quantityUnit: 'g', grams: 100 }] };
  const built = mealQuestions(raw, new Map([[0, [{ source: 'usda', id: 1, description: 'A, raw, with salt' }, { source: 'usda', id: 2, description: 'A, raw, without salt' }]]]));
  const decisions = interpretDecisions(raw, built, { state: 'used', answers: { q1: { choice: NONE, confidence: .9 }, q2_0: { choice: 'a, raw, with salt', confidence: .4, probabilities: { 'a, raw, with salt': .45, 'a, raw, without salt': .45, [NONE]: .1 } }, q4: { noul: .1 }, q5: { noul: .1 }, q6: { noul: .9 } } }, { JEV_ITEM_THRESHOLD: '.6' });
  const item = decisions.items.get(0);
  assert.equal(item.accepted, true); assert.equal(item.confidence, .9); assert.equal(item.rawConfidence, .4); assert.equal(item.candidate.id, 1);
});
test('USDA candidates must share a non-generic word: a search hit matching only "cooked" is never an option', async () => {
  const { candidateSearch } = await import('../lib/free-food-data.mjs');
  const search = candidateSearch({ USDA_API_KEY: 'k', FREE_FOOD_SOURCES: 'usda' }, async () => Response.json({ foods: [{ fdcId: 1, description: 'Dove, cooked, NS as to cooking method', dataType: 'Survey (FNDDS)' }, { fdcId: 2, description: 'Chives, cooked', dataType: 'Survey (FNDDS)' }] }), null);
  const list = await search.candidatesFor({ name: 'Snidling', lookupQuery: 'chive, cooked', foodState: 'prepared', quantityUnit: 'g' });
  assert.deepEqual(list.filter(c => c.source === 'usda').map(c => c.id), [2]);
});