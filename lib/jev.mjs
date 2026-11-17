import { createHash } from 'node:crypto';
import { HUNGARIAN_DISHES } from './hungarian-food.mjs';
import { calibrated } from './calibration.mjs';

// TypeSafe Jev: closed decisions only (database match, dish, preparation, gates).
// It never estimates grams, generates ingredients or calculates calories.
export const DEFAULT_JEV_MODEL = 'jev-1.14.0';
export const JEV_INPUT_USD_PER_MTOK = 0.042;
export const JEV_ENDPOINT = 'https://api.typesafe.ai/v1/systemone';
export const NONE = 'none of these';
const CACHE_TTL = 30 * 86400_000;
const NOUL_YES = .7, NOUL_NO = .3;
// Q3 options in the documented order; the Hungarian/English labels become the
// item's preparation text. Keys are the option names Jev sees.
export const PREPARATIONS = {
  raw: { hu: 'nyers', en: 'raw', state: 'raw' },
  boiled: { hu: 'főtt', en: 'boiled', state: 'prepared' },
  steamed: { hu: 'párolt', en: 'steamed', state: 'prepared' },
  'oven-baked': { hu: 'sütőben sült', en: 'oven-baked', state: 'prepared' },
  'pan-fried': { hu: 'serpenyőben sült', en: 'pan-fried', state: 'prepared' },
  'breaded and fried': { hu: 'rántott', en: 'breaded and fried', state: 'prepared' },
  grilled: { hu: 'grillezett', en: 'grilled', state: 'prepared' },
};
const DISH_OPTIONS = Object.fromEntries(Object.entries(HUNGARIAN_DISHES).filter(([key]) => key !== 'generic').map(([key, dish]) => [dish.label, key]));

export const jevConfigured = env => typeof env.JEV_API === 'string' && env.JEV_API.trim().length > 0;
// Pin a versioned identifier; aliases such as jev-latest would silently change decisions.
export const jevModel = env => {
  const model = env.JEV_MODEL || DEFAULT_JEV_MODEL;
  return /^jev-\d+\.\d+\.\d+$/.test(model) ? model : null;
};
const threshold = (value, fallback) => {
  const number = Number(value ?? fallback);
  return Number.isFinite(number) && number > 0 && number < 1 ? number : fallback;
};
// Precedence: explicit environment override > measured calibration (lib/jev-calibration.json) > starting value.
export const jevThresholds = env => ({ dish: threshold(env.JEV_DISH_THRESHOLD, calibrated('dish', .6)), item: threshold(env.JEV_ITEM_THRESHOLD, calibrated('item', .6)) });

// Jev is sensitive to option wording: one consistent lower-case form, unique names.
export function normalizeOption(value) {
  return String(value ?? '').normalize('NFC').replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').replace(/\s*,\s*/g, ', ').trim().toLowerCase().slice(0, 120);
}
export function optionMap(candidates) {
  const options = new Map();
  for (const candidate of candidates) {
    const base = normalizeOption(candidate.description);
    if (!base || base === NONE) continue;
    let name = base;
    for (let n = 2; options.has(name); n++) name = `${base} (${n})`;
    options.set(name, candidate);
  }
  return options;
}

const itemFacts = item => ({ name: String(item.name || '').slice(0, 160), englishDescription: String(item.lookupQuery || '').slice(0, 180), state: item.foodState, unit: item.quantityUnit });
export function mealState(raw) {
  return {
    meal: String(raw.name || '').slice(0, 160),
    // The vision model's own dish group is deliberately NOT sent: Q1 must confirm it independently.
    ...(typeof raw.separable === 'boolean' ? { componentsSeparateInImage: raw.separable } : {}),
    ...(raw.sauceOrDressing !== undefined ? { visibleSauceOrDressing: raw.sauceOrDressing } : {}),
    items: (raw.ingredients || []).slice(0, 12).map(item => ({ ...itemFacts(item), visibility: item.visibility, amount: item.grams })),
  };
}

// Q2: one database decision per item; self-contained (item + options) so it is cacheable
// and the calibration run asks exactly the production question.
export function matchQuestion(item, map) {
  return { type: 'choice', usesState: false,
    // The English description is the matching basis; the display name would only split the cache.
    instructions: { task: 'Which nutrient database record is the same food as this item, including the same part/subtype and the same preparation state? Choose "none of these" if no record is the same food in the same state.', item: { description: String(item.lookupQuery || item.name || '').slice(0, 180), state: item.foodState, unit: item.quantityUnit } },
    criteria: { ...Object.fromEntries([...map.keys()].map(name => [name, null])), [NONE]: 'No listed record is the same food in the same preparation state' } };
}
// Builds Q1–Q6. Q2 is self-contained (item + options) so its answer is cacheable
// across meals; the other questions depend on the whole meal.
export function mealQuestions(raw, candidates) {
  const questions = {}, options = {};
  questions.q1 = { type: 'choice', usesState: true,
    instructions: 'Which canonical Hungarian dish group is this meal? Choose "none of these" if no group clearly fits.',
    criteria: { ...Object.fromEntries(Object.keys(DISH_OPTIONS).map(label => [label, null])), [NONE]: 'Another dish, or no group clearly fits' } };
  for (const [index, list] of candidates) {
    const map = optionMap(list);
    if (!map.size) continue;
    options[index] = map;
    questions[`q2_${index}`] = matchQuestion(raw.ingredients[index], map);
  }
  for (const [index, item] of (raw.ingredients || []).slice(0, 12).entries()) {
    if (item.productLabel || item.foodState === 'as_sold' || item.quantityUnit !== 'g') continue;
    questions[`q3_${index}`] = { type: 'choice', usesState: true,
      instructions: { task: 'How was this item of the meal most likely prepared?', item: itemFacts(item) },
      criteria: { ...Object.fromEntries(Object.keys(PREPARATIONS).map(name => [name, null])), [NONE]: 'Another method, or it cannot be determined' } };
  }
  questions.q4 = { type: 'noul', usesState: true, instructions: 'This meal is typically prepared with added cooking fat, oil, lard or butter that is NOT listed among its items.' };
  questions.q5 = { type: 'noul', usesState: true, instructions: 'This meal typically has a sauce, gravy or dressing that is NOT listed among its items.' };
  questions.q6 = { type: 'noul', usesState: true, instructions: 'The listed items are served as separate, visually distinguishable components, not mixed together as in a stew, soup, casserole or mixed salad.' };
  return { questions, options };
}

// Database variants that differ only in salt, draining or enrichment are the same food for
// the identity decision; Jev spreads its probability across them, so the Q2 score is the
// probability mass of the chosen record's variant group (the chosen record itself is kept).
const VARIANT_QUALIFIERS = /\b(?:with(?:out)?(?: added)? salt|drained|(?:un)?enriched|(?:un)?fortified|as ingredient|ns as to [a-z ]+)\b/g;
export const variantKey = name => normalizeOption(name).replace(/ \(\d+\)$/, '').replace(VARIANT_QUALIFIERS, '').replace(/\s*,\s*(?=,|$)/g, '').replace(/,\s*,/g, ',').replace(/\s+/g, ' ').replace(/[ ,]+$/, '').trim();
export function decisionScore(answer, optionNames) {
  if (!answer?.probabilities || answer.choice === NONE) return answer?.confidence ?? 0;
  const group = variantKey(answer.choice);
  const mass = optionNames.filter(name => name !== NONE && variantKey(name) === group).reduce((sum, name) => sum + (answer.probabilities[name] ?? 0), 0);
  return Math.round(Math.min(1, Math.max(mass, 0)) * 1000) / 1000;
}
const finite01 = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
function validAnswer(answer, question) {
  if (!answer || answer.type !== question.type) return null;
  if (question.type === 'choice') {
    if (typeof answer.choice !== 'string' || !Object.hasOwn(question.criteria, answer.choice) || !finite01(answer.confidence)) return null;
    const probabilities = answer.probabilities && typeof answer.probabilities === 'object' && Object.entries(answer.probabilities).every(([name, value]) => Object.hasOwn(question.criteria, name) && finite01(value)) ? answer.probabilities : null;
    return { type: 'choice', choice: answer.choice, confidence: answer.confidence, ...(probabilities ? { probabilities } : {}) };
  }
  if (question.type === 'noul') return finite01(answer.noul) ? { type: 'noul', noul: answer.noul } : null;
  return null;
}
const wire = ({ usesState, ...question }) => question;
const cacheKey = (model, question, state) => `jev:${model}:` + createHash('sha256').update(JSON.stringify([wire(question), question.usesState ? state : null])).digest('hex');

// One request for all uncached questions. Any failure returns a state instead of
// throwing: the analysis continues on the documented fallback branch.
export async function askJev(state, questions, env, fetcher = fetch, { db, now = Date.now } = {}) {
  if (!jevConfigured(env)) return { state: 'disabled' };
  const model = jevModel(env);
  if (!model) return { state: 'misconfigured' };
  const ids = Object.keys(questions), answers = {}, keys = Object.fromEntries(ids.map(id => [id, cacheKey(model, questions[id], state)]));
  let cached = 0;
  if (db) for (const id of ids) {
    try {
      const row = await db.prepare('SELECT value FROM food_api_cache WHERE cache_key=? AND expires_at>?').bind(keys[id], new Date(now()).toISOString()).first();
      const answer = row && validAnswer(JSON.parse(row.value), questions[id]);
      if (answer) { answers[id] = answer; cached++; }
    } catch { /* A broken cache row is asked again. */ }
  }
  const missing = ids.filter(id => !answers[id]);
  const result = { model, cachedAnswers: cached, inputTokens: 0, costUsd: 0, latencyMs: 0 };
  if (!missing.length) return { ...result, state: 'cached', answers };
  const started = Date.now();
  let response, payload;
  try {
    response = await fetcher(JEV_ENDPOINT, {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(Number(env.JEV_TIMEOUT_MS) > 0 ? Number(env.JEV_TIMEOUT_MS) : 8000),
      headers: { Authorization: `Bearer ${env.JEV_API.trim()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, state, questions: Object.fromEntries(missing.map(id => [id, wire(questions[id])])) }),
    });
    const text = await response.text();
    if (text.length > 1_000_000) throw Error('Jev response too large');
    payload = JSON.parse(text);
  } catch { return { ...result, state: 'unavailable', httpStatus: response?.status ?? null, latencyMs: Date.now() - started }; }
  result.latencyMs = Date.now() - started; result.httpStatus = response.status;
  if (!response.ok) return { ...result, state: 'unavailable' };
  const tokens = payload?.usage?.input_tokens;
  if (Number.isSafeInteger(tokens) && tokens >= 0) { result.inputTokens = tokens; result.costUsd = tokens * JEV_INPUT_USD_PER_MTOK / 1e6; }
  if (typeof payload?.model === 'string' && /^jev-[a-z0-9.-]{1,40}$/.test(payload.model)) result.model = payload.model;
  for (const id of missing) {
    const answer = validAnswer(payload?.answers?.[id], questions[id]);
    if (!answer) return { ...result, state: 'invalid' };
    answers[id] = answer;
  }
  if (db) for (const id of missing) {
    // No user identifier or note enters the shared cache; the model is part of the key.
    try { await db.prepare('INSERT INTO food_api_cache(cache_key,value,expires_at) VALUES(?,?,?) ON CONFLICT(cache_key) DO UPDATE SET value=excluded.value,expires_at=excluded.expires_at').bind(keys[id], JSON.stringify(answers[id]), new Date(now() + CACHE_TTL).toISOString()).run(); }
    catch { /* The decision is still valid for this analysis. */ }
  }
  return { ...result, state: 'used', answers };
}

const noul = answer => answer?.noul >= NOUL_YES ? true : answer?.noul <= NOUL_NO ? false : null;
// Interprets the answers in code; multi-factor decisions are combined here, not by Jev.
export function interpretDecisions(raw, built, response, env) {
  const thresholds = jevThresholds(env), answers = response.answers || {};
  const available = ['used', 'cached'].includes(response.state);
  const decisions = { state: response.state, model: response.model ?? null, thresholds, items: new Map(), preparations: new Map(), reasons: [] };
  if (!available) return decisions;
  const q1 = answers.q1;
  const dishKey = q1 && q1.choice !== NONE ? DISH_OPTIONS[q1.choice] : 'generic';
  decisions.dish = { key: dishKey, confidence: q1?.confidence ?? null, confirmed: Boolean(q1 && q1.confidence >= thresholds.dish && dishKey === (raw.dishProfile || 'generic')) };
  if (!decisions.dish.confirmed) decisions.reasons.push('dish_unconfirmed');
  for (const [index, map] of Object.entries(built.options)) {
    const answer = answers[`q2_${index}`];
    if (!answer) continue;
    const none = answer.choice === NONE, score = decisionScore(answer, [...map.keys(), NONE]);
    decisions.items.set(Number(index), { candidate: none ? null : map.get(answer.choice) ?? null, confidence: score, rawConfidence: answer.confidence, accepted: !none && score >= thresholds.item, none });
    if (none) decisions.reasons.push('item_none');
    else if (score < thresholds.item) decisions.reasons.push('item_low_confidence');
  }
  for (const [index, item] of (raw.ingredients || []).entries()) {
    const answer = answers[`q3_${index}`];
    if (!answer || answer.choice === NONE || answer.confidence < thresholds.item) continue;
    const preparation = PREPARATIONS[answer.choice];
    const conflict = ['raw', 'prepared'].includes(item.foodState) && preparation.state !== item.foodState;
    decisions.preparations.set(index, { key: answer.choice, confidence: answer.confidence, conflict });
    if (conflict) decisions.reasons.push('preparation_conflict');
  }
  decisions.hiddenFat = noul(answers.q4); decisions.sauce = noul(answers.q5); decisions.separable = noul(answers.q6);
  decisions.scores = { hiddenFat: answers.q4?.noul ?? null, sauce: answers.q5?.noul ?? null, separable: answers.q6?.noul ?? null };
  if (decisions.separable === false) decisions.reasons.push('mixed_dish');
  else if (decisions.separable === null) decisions.reasons.push('separability_uncertain');
  decisions.reasons = [...new Set(decisions.reasons)];
  return decisions;
}

export const PIPELINE_VERSION = 'jev-decisions-v1';
const FAT_ITEM = /\b(oil|fat|lard|butter|margarine|ghee)\b|olaj|zsír|zsir|vaj\b|margarin|disznózsír/i;
const SAUCE_ITEM = /\b(sauce|gravy|dressing|mayonnaise|ketchup|dip)\b|szósz|mártás|öntet|szaft|majonéz|ketchup|dresszing/i;
const listed = (raw, pattern) => (raw.ingredients || []).some(item => pattern.test(`${item.name || ''} ${item.lookupQuery || ''}`));
export const HIDDEN_FAT_NOTE = 'Az ilyen ételek jellemzően a képen nem látható zsiradékkal készülnek, amely nem szerepel az összetevők között; a tényleges energiatartalom magasabb lehet.';
export const SAUCE_NOTE = 'Az ilyen ételekhez jellemzően szósz vagy öntet is tartozik, amely nem szerepel az összetevők között; ha volt az ételen, add hozzá.';

// Applies the closed decisions in code: preparation text, gate notes and routing.
// It never changes grams or nutrient values.
export function applyDecisions(raw, decisions, language = 'hu', translate = value => value) {
  if (!decisions) return { path: 'fallback', reasons: ['jev_disabled'], notes: [] };
  if (!['used', 'cached'].includes(decisions.state)) return { path: 'fallback', reasons: ['jev_' + decisions.state], notes: [] };
  for (const [index, preparation] of decisions.preparations) {
    if (!preparation.conflict && raw.ingredients[index]) raw.ingredients[index].preparation = PREPARATIONS[preparation.key][language === 'en' ? 'en' : 'hu'];
  }
  const notes = [];
  if (decisions.hiddenFat === true && !listed(raw, FAT_ITEM)) notes.push(translate(HIDDEN_FAT_NOTE, language));
  if (decisions.sauce === true && !listed(raw, SAUCE_ITEM)) notes.push(translate(SAUCE_NOTE, language));
  return { path: decisions.reasons.length ? 'escalated' : 'fast', reasons: decisions.reasons, notes };
}
// Routing only lowers confidence; it never raises a self-assessment.
export function routedConfidence(confidence, route) {
  const order = ['low', 'medium', 'high'];
  // A Jev outage is the documented "uncertain" fallback; an escalation reason
  // (including a raw/prepared disagreement, e.g. a dressed salad) caps at medium.
  const cap = route.reasons.some(reason => ['jev_unavailable', 'jev_invalid', 'jev_misconfigured'].includes(reason)) ? 'low' : route.path === 'escalated' ? 'medium' : 'high';
  return order[Math.min(order.indexOf(confidence), order.indexOf(cap))];
}

export async function decideMeal(raw, candidates, env, fetcher, { db } = {}) {
  const built = mealQuestions(raw, candidates);
  const response = await askJev(mealState(raw), built.questions, env, fetcher, { db });
  const decisions = interpretDecisions(raw, built, response, env);
  decisions.usage = { state: response.state, model: response.model ?? null, questions: Object.keys(built.questions).length, cachedAnswers: response.cachedAnswers ?? 0, inputTokens: response.inputTokens ?? 0, costUsd: response.costUsd ?? 0, latencyMs: response.latencyMs ?? 0, ...(response.httpStatus != null ? { httpStatus: response.httpStatus } : {}) };
  return decisions;
}
