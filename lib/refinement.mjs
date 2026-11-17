import { randomUUID } from 'node:crypto';
import { AppError, check, validateAnalysis, analysisReport } from './domain.mjs';
import { analysisReferences } from './food-data.mjs';
import { estimateFood, modalConfigured, DEFAULT_MODAL_MONTHLY_BUDGET_USD } from './modal-food.mjs';
import { storedPhotoData, modelImageTransformation } from './photos.mjs';
import { runtimeSettings } from './settings.mjs';
import { startModalRequest, recordAiResponse, recordAiRequestMeta, logEvent } from './telemetry.mjs';
import { imageHashes } from './ai-archive.mjs';
import { rememberCorrection } from './corrections.mjs';
import { PREPARATIONS } from './jev.mjs';
import { calibrated } from './calibration.mjs';
import { translate, localeFor } from './i18n.mjs';

// Escalation (architecture plan, phase 3): Food-R1 always runs for an escalated meal,
// through a durable PostgreSQL/SQLite queue. The fast result is shown meanwhile.
export const DEFAULT_DELTA = .25;
export const MAX_ATTEMPTS = 8, ALERT_AFTER = 4;
const LEASE_MS = 240_000; // longer than one /estimate call (175 s) plus photo download
const now = () => new Date().toISOString();
// Precedence: FOOD_R1_DELTA override > measured calibration > starting value.
export const refinementDelta = env => { const fallback = calibrated('delta', DEFAULT_DELTA), value = Number(env.FOOD_R1_DELTA || fallback); return Number.isFinite(value) && value > 0 && value < 1 ? value : fallback; };
const fixedBasis = new Set(['label', 'measured_total', 'measured_ingredient', 'recipe']);
const scalable = item => item.quantityUnit !== 'ml' && !fixedBasis.has(item.weightBasis);
const energy = items => items.reduce((sum, item) => sum + item.calories * item.grams / 100, 0);
const round = value => Math.max(.001, Math.round(value * 1000) / 1000);
const format = (value, language) => new Intl.NumberFormat(localeFor(language), { maximumFractionDigits: 2 }).format(value);

// Factor for the visually estimated gram items that brings the meal total to target kcal.
export function factorFor(analysis, targetKcal) {
  const free = analysis.ingredients.filter(scalable), fixed = analysis.ingredients.filter(item => !scalable(item));
  const scalableKcal = energy(free);
  if (!(scalableKcal > 0)) return null;
  return Math.min(2, Math.max(.5, (targetKcal - energy(fixed)) / scalableKcal));
}
export function scalePortions(analysis, factor, { widen = false, weightBasis } = {}) {
  return { ...analysis, ingredients: analysis.ingredients.map(item => {
    if (!scalable(item)) return item;
    const grams = Math.min(5000, round(item.grams * factor));
    // widen: the band covers both estimates; otherwise the whole band moves with the answer.
    const gramsMin = widen ? Math.min(item.gramsMin ?? item.grams, grams) : Math.min(grams, round((item.gramsMin ?? item.grams) * factor));
    const gramsMax = Math.min(5000, widen ? Math.max(item.gramsMax ?? item.grams, grams) : Math.max(grams, round((item.gramsMax ?? item.grams) * factor)));
    return { ...item, grams, gramsMin, gramsMax, ...(weightBasis ? { weightBasis } : {}) };
  }) };
}
// Code compares the two independent totals; no model decides the final number.
export function reconcile(analysis, foodR1Kcal, delta) {
  const fastKcal = analysisReport(analysis).total.calories;
  const relativeDifference = Math.abs(foodR1Kcal - fastKcal) / Math.max(foodR1Kcal, fastKcal, 1);
  const base = { fastKcal, foodR1Kcal, relativeDifference: Math.round(relativeDifference * 1000) / 1000, threshold: delta };
  if (relativeDifference > delta) return { ...base, kind: 'question' };
  const finalKcal = Math.round((fastKcal + foodR1Kcal) / 2 * 10) / 10;
  return { ...base, kind: 'average', finalKcal, factor: factorFor(analysis, finalKcal) };
}
const appendNote = (analysis, note) => ({ ...analysis, assumptions: analysis.assumptions.length + note.length + 1 <= 3000 ? `${analysis.assumptions} ${note}`.trim() : analysis.assumptions });

export async function enqueueFoodR1(db, meal, usage, env) {
  if (usage?.pipeline?.path !== 'escalated' || !modalConfigured(env) || !(Number(env.MODAL_MONTHLY_BUDGET_USD ?? DEFAULT_MODAL_MONTHLY_BUDGET_USD) > 0)) return false;
  const time = now();
  await db.prepare("INSERT INTO food_r1_job(meal_id,user_id,image_ref,state,attempts,next_attempt_at,base_revision,created_at,updated_at) VALUES(?,?,?,'queued',0,?,?,?,?) ON CONFLICT(meal_id) DO UPDATE SET state='queued',attempts=0,next_attempt_at=excluded.next_attempt_at,base_revision=excluded.base_revision,error=NULL,result=NULL,lease_token=NULL,lease_until=NULL,updated_at=excluded.updated_at")
    .bind(meal.id, meal.user_id, meal.public_id, time, meal.revision ?? 0, time, time).run();
  await db.prepare('UPDATE meals SET refinement=? WHERE id=?').bind(JSON.stringify({ state: 'pending', reasons: usage.pipeline.reasons, dishKey: usage.pipeline.dishKey ?? null }), meal.id).run();
  return true;
}

async function claim(db) {
  const time = now(), token = randomUUID(), ready = "(state='queued' AND next_attempt_at<=?) OR (state='running' AND lease_until<?)";
  const pick = `SELECT meal_id FROM food_r1_job WHERE ${ready} ORDER BY next_attempt_at LIMIT 1${db.dialect === 'postgres' ? ' FOR UPDATE SKIP LOCKED' : ''}`;
  const job = await db.prepare(`UPDATE food_r1_job SET state='running',lease_token=?,lease_until=?,attempts=attempts+1,updated_at=? WHERE meal_id=(${pick}) AND (${ready}) RETURNING *`)
    .bind(token, new Date(Date.now() + LEASE_MS).toISOString(), time, time, time, time, time).first();
  return job ? { ...job, token } : null;
}
async function finish(db, job, { state, error = null, result = null, nextAttemptAt = null, refinement, attempts }) {
  return db.transaction(async tx => {
    const owned = await tx.prepare(`UPDATE food_r1_job SET state=?,error=?,result=?,next_attempt_at=COALESCE(?,next_attempt_at),attempts=COALESCE(?,attempts),lease_token=NULL,lease_until=NULL,updated_at=? WHERE meal_id=? AND lease_token=? RETURNING meal_id`)
      .bind(state, error, result && JSON.stringify(result), nextAttemptAt, attempts ?? null, now(), job.meal_id, job.lease_token).first();
    if (owned && refinement) await tx.prepare('UPDATE meals SET refinement=? WHERE id=?').bind(JSON.stringify(refinement), job.meal_id).run();
    return Boolean(owned);
  });
}
async function retryLater(db, job, meal, reason, { countAttempt = true } = {}) {
  const attempts = countAttempt ? job.attempts : Math.max(0, job.attempts - 1);
  if (attempts >= MAX_ATTEMPTS) {
    await finish(db, job, { state: 'failed', error: reason, refinement: { ...JSON.parse(meal.refinement || '{}'), state: 'failed' } });
    await logEvent(db, { level: 'error', event: 'food_r1.failed', message: `A Food-R1 pontosítás ${attempts} próbálkozás után sem készült el; a gyors eredmény marad. Ok: ${reason}`, userId: meal.user_id, mealId: meal.id });
    return;
  }
  const delay = countAttempt ? Math.min(6 * 3600_000, 30_000 * 2 ** Math.max(0, attempts - 1)) : 6 * 3600_000;
  await finish(db, job, { state: 'queued', error: reason, nextAttemptAt: new Date(Date.now() + delay).toISOString(), attempts });
  // Alert once when the queue keeps failing, so it can be fixed by hand.
  if (countAttempt && attempts === ALERT_AFTER) await logEvent(db, { level: 'error', event: 'food_r1.stuck', message: `A Food-R1 pontosítás ${attempts} próbálkozás után sem sikerült; kézi ellenőrzés szükséges. Ok: ${reason}`, userId: meal.user_id, mealId: meal.id });
}

export async function processNextFoodR1({ db, env, fetcher = fetch }) {
  const job = await claim(db);
  if (!job) return false;
  const meal = await db.prepare('SELECT * FROM meals WHERE id=?').bind(job.meal_id).first();
  if (!meal?.photo || !meal.original_analysis) { await finish(db, job, { state: 'done', error: 'meal_unavailable' }); return true; }
  let modalRequest = null;
  try {
    const effectiveEnv = await runtimeSettings(db, env);
    if (!modalConfigured(effectiveEnv)) { await finish(db, job, { state: 'failed', error: 'disabled', refinement: { ...JSON.parse(meal.refinement || '{}'), state: 'unavailable' } }); return true; }
    modalRequest = await startModalRequest(db, meal, Number(effectiveEnv.MODAL_MONTHLY_BUDGET_USD ?? DEFAULT_MODAL_MONTHLY_BUDGET_USD));
    if (!modalRequest) {
      await logEvent(db, { level: 'warning', event: 'food_r1.budget', message: 'A Food-R1 belső havi kerete most nem enged hívást; a pontosítás később folytatódik.', userId: meal.user_id, mealId: meal.id });
      await retryLater(db, job, meal, 'budget', { countAttempt: false }); return true;
    }
    const photo = JSON.parse(meal.photo);
    const transformation = modelImageTransformation(effectiveEnv);
    const images = [await storedPhotoData(photo, fetcher, effectiveEnv, { transformation }), ...(photo.additional ? [await storedPhotoData(photo.additional, fetcher, effectiveEnv, { transformation })] : [])];
    await recordAiRequestMeta(db, modalRequest, { provider: 'modal', mode: 'estimate', imageHashes: imageHashes(images) }, effectiveEnv);
    const estimate = await estimateFood(images, effectiveEnv, fetcher, { onModalResponse: data => recordAiResponse(db, modalRequest, data, effectiveEnv) });
    await db.prepare("UPDATE ai_requests SET state=?,finished_at=? WHERE id=? AND state='running'").bind(estimate.state === 'used' ? 'completed' : 'failed', now(), modalRequest.id).run();
    if (estimate.state === 'unsupported') {
      await finish(db, job, { state: 'failed', error: 'estimate_endpoint_missing', refinement: { ...JSON.parse(meal.refinement || '{}'), state: 'unavailable' } });
      await logEvent(db, { level: 'error', event: 'food_r1.unsupported', message: 'A telepített Modal Food-R1 alkalmazásban nincs /estimate végpont. Telepítsd újra: modal deploy scripts/modal_foodr1.py', userId: meal.user_id, mealId: meal.id });
      return true;
    }
    if (estimate.state !== 'used') { await retryLater(db, job, meal, estimate.state + (estimate.httpStatus ? ':' + estimate.httpStatus : '')); return true; }
    await applyEstimate(db, job, meal, estimate, effectiveEnv);
  } catch (error) {
    if (modalRequest) await db.prepare("UPDATE ai_requests SET state='failed',finished_at=? WHERE id=? AND state='running'").bind(now(), modalRequest.id).run().catch(() => {});
    await retryLater(db, job, meal, error instanceof AppError ? error.message.slice(0, 200) : error.code || error.name || 'error').catch(() => console.error('Food-R1 job state could not be saved'));
  }
  return true;
}

async function applyEstimate(db, job, meal, estimate, env) {
  const usage = JSON.parse(meal.usage || '{}'), language = JSON.parse(meal.analysis_context || '{}').language || 'hu';
  const original = JSON.parse(meal.original_analysis), delta = refinementDelta(env);
  const decision = reconcile(original, estimate.totalKcal, delta);
  const refinement = { state: decision.kind === 'average' ? 'reconciled' : 'question', fastKcal: decision.fastKcal, foodR1Kcal: decision.foodR1Kcal, relativeDifference: decision.relativeDifference, threshold: delta, dishKey: usage.pipeline?.dishKey ?? null, foodR1Items: estimate.items.slice(0, 20) };
  let updated = null;
  if (decision.kind === 'average' && decision.factor) {
    const note = translate('Egy második, független becslés (Food-R1) {0} kcal-t adott; a két becslés átlagával pontosítottuk az adagokat, és szélesítettük a becslési sávot.', language).replace('{0}', format(estimate.totalKcal, language));
    const scaled = appendNote(scalePortions(original, decision.factor, { widen: true }), note);
    try { updated = validateAnalysis(scaled, await analysisReferences(scaled, db)); } catch { updated = null; }
    refinement.finalKcal = decision.finalKcal;
  }
  await db.transaction(async tx => {
    const owned = await tx.prepare("UPDATE food_r1_job SET state='done',error=NULL,result=?,lease_token=NULL,lease_until=NULL,updated_at=? WHERE meal_id=? AND lease_token=? RETURNING meal_id").bind(JSON.stringify({ totalKcal: estimate.totalKcal, items: estimate.items, decision: decision.kind }), now(), job.meal_id, job.lease_token).first();
    if (!owned) return;
    // The refined result replaces the fast one only while the user has not edited or saved it.
    const applied = updated ? (await tx.prepare("UPDATE meals SET analysis=?,original_analysis=?,refinement=?,updated_at=? WHERE id=? AND status='draft' AND revision=?").bind(JSON.stringify(updated), JSON.stringify(updated), JSON.stringify({ ...refinement, applied: true }), now(), meal.id, job.base_revision).run()).meta.changes === 1 : false;
    if (!applied) await tx.prepare('UPDATE meals SET refinement=? WHERE id=?').bind(JSON.stringify({ ...refinement, applied: false }), meal.id).run();
    await logEvent(tx, { event: 'food_r1.completed', message: decision.kind === 'average' ? 'A második becslés elkészült; a két eredmény átlaga került az étkezésbe.' : 'A második becslés jelentősen eltér; a felhasználó pontosíthatja az adagot.', userId: meal.user_id, mealId: meal.id });
  });
}

// The user's answer to the question screen: portion factor and preparation, saved as a personal prior.
export async function answerRefinement(db, userId, row, input, refresh) {
  const refinement = row.refinement ? JSON.parse(row.refinement) : null;
  check(refinement?.state === 'question', 'Ehhez az étkezéshez most nincs pontosító kérdés.', 409);
  check(['draft', 'saved'].includes(row.status) && row.analysis, 'Ez a bejegyzés most nem módosítható.', 409);
  check(Number.isInteger(input.revision) && input.revision === row.revision, 'A bejegyzés másik ablakban megváltozott. Töltsd be újra.', 409);
  const factor = Number(input.portionFactor);
  check(Number.isFinite(factor) && factor >= .5 && factor <= 2, 'Az adag 50 és 200% között adható meg.');
  check(input.preparation == null || Object.hasOwn(PREPARATIONS, input.preparation), 'Ismeretlen elkészítési mód.');
  const language = JSON.parse(row.analysis_context || '{}').language || 'hu';
  let analysis = scalePortions(JSON.parse(row.analysis), factor, { weightBasis: 'user' });
  const preparation = input.preparation ? PREPARATIONS[input.preparation][language === 'en' ? 'en' : 'hu'] : null;
  analysis = appendNote(analysis, translate('Az adagot a válaszod alapján {0}-szeresére igazítottuk.', language).replace('{0}', format(factor, language)) + (preparation ? ' ' + translate('Megadott elkészítés: {0}.', language).replace('{0}', preparation) : ''));
  analysis = validateAnalysis(analysis, await analysisReferences(analysis, db));
  const time = now();
  await db.transaction(async tx => {
    const changed = await tx.prepare(`UPDATE meals SET analysis=?,${row.status === 'draft' ? 'original_analysis=?,' : ''}refinement=?,revision=revision+1,updated_at=? WHERE id=? AND user_id=? AND revision=?`)
      .bind(...[JSON.stringify(analysis), ...(row.status === 'draft' ? [JSON.stringify(analysis)] : []), JSON.stringify({ ...refinement, state: 'answered', portionFactor: factor, preparation: input.preparation ?? null }), time, row.id, userId, input.revision]).run();
    check(changed.meta.changes === 1, 'A bejegyzés közben megváltozott.', 409);
    await rememberCorrection(tx, userId, refinement.dishKey, { ratio: factor, preparation: input.preparation ?? undefined });
    if (row.status === 'saved') await refresh?.(tx, analysis);
  });
  return analysis;
}

export function startFoodR1Runner(options) {
  let stopped = false, working = false;
  const tick = async () => {
    if (stopped || working) return;
    working = true;
    try { while (!stopped && await processNextFoodR1(options)) { /* Drain ready jobs. */ } }
    catch (error) { console.error('Food-R1 runner unavailable:', error.code || error.name); }
    finally { working = false; }
  };
  const timer = setInterval(tick, 5000); timer.unref(); tick();
  return { wake: tick, stop() { stopped = true; clearInterval(timer); } };
}
