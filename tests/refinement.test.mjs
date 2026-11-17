import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { openDatabase } from '../lib/database.mjs';
import { validateAnalysis, totals } from '../lib/domain.mjs';
import { FOOD_R1_REVISION } from '../lib/modal-food.mjs';
import { enqueueFoodR1, processNextFoodR1, reconcile, scalePortions, answerRefinement, MAX_ATTEMPTS } from '../lib/refinement.mjs';
import { loadCorrection, personalFactor, portionRatio, learnFromSave } from '../lib/corrections.mjs';

const jpeg = Buffer.concat([Buffer.from([255, 216, 255, 224]), Buffer.alloc(200)]);
const env = { CLOUDINARY_CLOUD_NAME: 'test-cloud', CLOUDINARY_API_KEY: 'k', CLOUDINARY_API_SECRET: 's', MODAL_FOOD_URL: 'https://test-food.modal.run/recognize', MODAL_PROXY_TOKEN_ID: 'wk-test', MODAL_PROXY_TOKEN_SECRET: 'ws-test', MODAL_MONTHLY_BUDGET_USD: '15' };
const item = (name, calories, extra = {}) => ({ name, grams: 200, gramsMin: 150, gramsMax: 250, quantityUnit: 'g', calories, protein: 10, carbs: 10, fat: 5, fiber: 0, sugar: 1, sodium: 100, saturatedFat: 1, weightBasis: 'visual', visibility: 'visible', ...extra });
const analysis = () => validateAnalysis({ name: 'Pörkölt nokedlivel', confidence: 'medium', assumptions: 'Teszt.', dishProfile: 'porkolt', ingredients: [item('Pörkölt', 150), item('Nokedli', 140), item('Üdítő', 40, { quantityUnit: 'ml', grams: 330, gramsMin: 330, gramsMax: 330 })] });
const r1 = total => ({ model: 'zy12123/Food-R1', revision: FOOD_R1_REVISION, mode: 'estimate', truncated: false, input_tokens: 900, output_tokens: 60, compute_seconds: 12, answer: JSON.stringify({ items: [{ name: 'pork stew', grams: 220, kcal: total / 2 }, { name: 'egg noodles', grams: 200, kcal: total / 2 }], total_kcal: total }) });

async function setup(t) {
  const db = openDatabase(':memory:'); t.after(() => db.close());
  const userId = randomUUID(), mealId = randomUUID(), time = new Date().toISOString();
  await db.prepare('INSERT INTO users(id,google_sub,email,name,created_at,updated_at) VALUES(?,?,?,?,?,?)').bind(userId, userId, 'user@example.test', 'Teszt', time, time).run();
  const photo = { publicId: `yumetrics/${mealId}`, type: 'authenticated', url: `https://res.cloudinary.com/test-cloud/image/authenticated/v1/yumetrics/${mealId}.jpg`, width: 10, height: 10 };
  const usage = { pipeline: { path: 'escalated', reasons: ['mixed_dish'], dishKey: 'porkolt' } };
  await db.prepare("INSERT INTO meals(id,user_id,day,time,type,public_id,status,analysis,original_analysis,photo,usage,analysis_context,created_at,updated_at) VALUES(?,?,?,?,?,?,'draft',?,?,?,?,?,?,?)")
    .bind(mealId, userId, '2026-11-17', '12:00', 'Ebéd', photo.publicId, JSON.stringify(analysis()), JSON.stringify(analysis()), JSON.stringify(photo), JSON.stringify(usage), JSON.stringify({ language: 'hu' }), time, time).run();
  const meal = await db.prepare('SELECT * FROM meals WHERE id=?').bind(mealId).first();
  return { db, userId, mealId, meal, usage };
}
const fetcherFor = (modal, calls = []) => async (url, options) => {
  calls.push(url);
  if (url.startsWith('https://res.cloudinary.com/')) return new Response(jpeg, { headers: { 'Content-Type': 'image/jpeg' } });
  if (url === 'https://test-food.modal.run/estimate') { assert.equal(options.headers['Modal-Secret'], 'ws-test'); assert.deepEqual(Object.keys(JSON.parse(options.body)), ['images']); return modal(); }
  throw Error('Unexpected ' + url);
};
const meal = async (db, id) => { const row = await db.prepare('SELECT * FROM meals WHERE id=?').bind(id).first(); return { ...row, analysis: JSON.parse(row.analysis), refinement: JSON.parse(row.refinement || 'null') }; };

test('reconciliation is code: close totals are averaged with a widened band, far ones become a question', () => {
  const fast = analysis();
  assert.equal(totals(fast.ingredients).calories, 712);
  const close = reconcile(fast, 780, .25);
  assert.equal(close.kind, 'average'); assert.equal(close.finalKcal, 746);
  const scaled = scalePortions(fast, close.factor, { widen: true });
  assert.ok(Math.abs(totals(scaled.ingredients).calories - 746) < 1);
  assert.equal(scaled.ingredients[2].grams, 330, 'ml drinks are never rescaled');
  assert.ok(scaled.ingredients[0].gramsMin <= 150 && scaled.ingredients[0].gramsMax >= scaled.ingredients[0].grams);
  assert.equal(reconcile(fast, 1500, .25).kind, 'question');
});

test('an escalated draft is queued, refined by Food-R1 and replaced automatically while unedited', async t => {
  const { db, mealId, meal: row, usage } = await setup(t);
  assert.equal(await enqueueFoodR1(db, row, usage, env), true);
  assert.equal((await meal(db, mealId)).refinement.state, 'pending');
  assert.equal(await enqueueFoodR1(db, row, { pipeline: { path: 'fast' } }, env), false);
  const calls = [];
  assert.equal(await processNextFoodR1({ db, env, fetcher: fetcherFor(() => Response.json(r1(780)), calls) }), true);
  const done = await meal(db, mealId);
  assert.equal(done.refinement.state, 'reconciled'); assert.equal(done.refinement.applied, true); assert.equal(done.refinement.finalKcal, 746);
  assert.ok(Math.abs(totals(done.analysis.ingredients).calories - 746) < 1);
  assert.ok(done.analysis.assumptions.includes('Food-R1'));
  const ledger = await db.prepare("SELECT state,model,cost_usd FROM ai_requests WHERE meal_id=?").bind(mealId).first();
  assert.equal(ledger.state, 'completed'); assert.equal(ledger.model, 'modal/food-r1-8b'); assert.ok(ledger.cost_usd > 0);
  assert.equal(await processNextFoodR1({ db, env, fetcher: fetcherFor(() => { throw Error('no second call'); }) }), false);
});

test('a large disagreement asks the user; the answer rescales the meal and becomes a personal prior', async t => {
  const { db, userId, mealId, meal: row, usage } = await setup(t);
  await enqueueFoodR1(db, row, usage, env);
  await processNextFoodR1({ db, env, fetcher: fetcherFor(() => Response.json(r1(1500))) });
  let current = await meal(db, mealId);
  assert.equal(current.refinement.state, 'question'); assert.equal(current.refinement.fastKcal, 712); assert.equal(current.refinement.foodR1Kcal, 1500);
  assert.equal(totals(current.analysis.ingredients).calories, 712, 'nothing changes before the answer');
  const stored = await db.prepare('SELECT * FROM meals WHERE id=?').bind(mealId).first();
  await assert.rejects(answerRefinement(db, userId, stored, { revision: stored.revision, portionFactor: 3 }), /50 és 200%/);
  await assert.rejects(answerRefinement(db, userId, stored, { revision: stored.revision + 1, portionFactor: 1.5 }), /megváltozott/);
  await answerRefinement(db, userId, stored, { revision: stored.revision, portionFactor: 1.5, preparation: 'pan-fried' });
  current = await meal(db, mealId);
  assert.equal(current.refinement.state, 'answered'); assert.equal(current.analysis.ingredients[0].grams, 300); assert.equal(current.analysis.ingredients[0].weightBasis, 'user');
  assert.equal(current.analysis.ingredients[2].grams, 330);
  const prior = await loadCorrection(db, userId, 'porkolt');
  assert.equal(prior.portion_factor, 1.5); assert.equal(prior.preparation, 'pan-fried'); assert.equal(prior.samples, 1);
  assert.equal(personalFactor(prior), 1, 'one answer is not yet a habit');
  await assert.rejects(answerRefinement(db, userId, await db.prepare('SELECT * FROM meals WHERE id=?').bind(mealId).first(), { revision: current.revision, portionFactor: 1 }), /nincs pontosító kérdés/);
});

test('failures retry with growing delays, alert once, and a missing /estimate endpoint stops without a retry storm', async t => {
  const { db, mealId, meal: row, usage } = await setup(t);
  await enqueueFoodR1(db, row, usage, env);
  await processNextFoodR1({ db, env, fetcher: fetcherFor(() => new Response('busy', { status: 503 })) });
  let job = await db.prepare('SELECT * FROM food_r1_job WHERE meal_id=?').bind(mealId).first();
  assert.equal(job.state, 'queued'); assert.equal(job.attempts, 1); assert.ok(Date.parse(job.next_attempt_at) > Date.now() + 20_000);
  for (let attempt = 2; attempt <= MAX_ATTEMPTS; attempt++) {
    await db.prepare('UPDATE food_r1_job SET next_attempt_at=? WHERE meal_id=?').bind(new Date(0).toISOString(), mealId).run();
    await processNextFoodR1({ db, env, fetcher: fetcherFor(() => new Response('busy', { status: 503 })) });
  }
  job = await db.prepare('SELECT * FROM food_r1_job WHERE meal_id=?').bind(mealId).first();
  assert.equal(job.state, 'failed'); assert.equal((await meal(db, mealId)).refinement.state, 'failed');
  const alerts = await db.prepare("SELECT event FROM app_logs WHERE meal_id=? AND level='error' ORDER BY created_at").bind(mealId).all();
  assert.deepEqual(alerts.results.map(row => row.event), ['food_r1.stuck', 'food_r1.failed']);
  await enqueueFoodR1(db, row, usage, env);
  await processNextFoodR1({ db, env, fetcher: fetcherFor(() => new Response('not found', { status: 404 })) });
  job = await db.prepare('SELECT * FROM food_r1_job WHERE meal_id=?').bind(mealId).first();
  assert.equal(job.state, 'failed'); assert.equal(job.error, 'estimate_endpoint_missing'); assert.equal((await meal(db, mealId)).refinement.state, 'unavailable');
});

test('first saves teach a personal portion factor that is applied only after repeated evidence', async t => {
  const { db, userId } = await setup(t);
  const original = analysis();
  const bigger = { ...original, ingredients: original.ingredients.map(i => i.quantityUnit === 'g' ? { ...i, grams: i.grams * 1.4 } : i) };
  assert.ok(Math.abs(portionRatio(original, bigger) - 1.4) < 1e-9);
  assert.equal(portionRatio(original, { ...bigger, recipe: {} }), null);
  await learnFromSave(db, userId, original, bigger);
  assert.equal(personalFactor(await loadCorrection(db, userId, 'porkolt')), 1);
  await learnFromSave(db, userId, original, bigger);
  assert.equal(personalFactor(await loadCorrection(db, userId, 'porkolt')), 1.4);
  await learnFromSave(db, userId, original, original);
  assert.ok(personalFactor(await loadCorrection(db, userId, 'porkolt')) < 1.4, 'an unchanged save pulls the factor back toward 1');
  assert.equal(await loadCorrection(db, userId, 'generic'), null);
});
