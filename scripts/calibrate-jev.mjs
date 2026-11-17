// Calibrates the Jev thresholds on reference data and checks that the Jev decisions are correct.
//   θ_item (Q2): weighed Nutrition5k ingredients; a choice is correct when the chosen record's
//                energy density matches the weighed ingredient (±max(20 kcal, 20%) per 100 g).
//   θ_dish (Q1): labelled Hungarian dish set (calibration/hungarian-dishes.json); Q3/Q4/Q6 accuracy too.
//   δ (Food-R1): paired fast / Food-R1 / weighed totals (--delta-pairs file); otherwise "pending".
// Each threshold is chosen on the calibration split; a locked ~30% holdout split is only reported.
// Usage: node scripts/calibrate-jev.mjs [--q2-limit 160] [--target 0.9] [--write]
// Needs JEV_API and USDA_API_KEY in the environment. Costs: Jev input tokens only (cents).
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { candidateSearch } from '../lib/free-food-data.mjs';
import { askJev, mealQuestions, mealState, matchQuestion, optionMap, NONE, jevModel, decisionScore } from '../lib/jev.mjs';
import { chooseThreshold, thresholdStats as at, chooseDelta } from '../lib/calibration.mjs';
import { HUNGARIAN_DISHES } from '../lib/hungarian-food.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((arg, i, all) => arg.startsWith('--') ? [arg.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true] : null).filter(Boolean));
const env = process.env, TARGET = Number(args.target ?? .9), IDENTITY_TARGET = Number(args['identity-target'] ?? .95), Q2_LIMIT = Number(args['q2-limit'] ?? 160);
const NUTRITION5K = args.nutrition5k || 'work/nutrition5k-haiku-v2/source/dish_metadata_cafe1.csv';
if (!args.from && (!env.JEV_API || !jevModel(env))) throw Error('JEV_API (and a pinned JEV_MODEL) is required.');
const hash = text => createHash('sha256').update(text).digest();
const holdout = text => hash('holdout:' + text)[0] < 77; // ~30%, fixed forever by name

// ---------- Q2 on weighed Nutrition5k ingredients ----------
const AS_SOLD = /\b(oil|sauce|dressing|cheese|bread|tortilla|yogurt|milk|juice|wine|beer|butter|ketchup|mustard|vinegar|honey|sugar|syrup|salt|olives?|pickles?|jam|chips|crackers?|cereal|granola|nuts?|almonds?|walnuts?|pecans?|seeds?|hummus|salsa|mayonnaise|guacamole|croutons?|parmesan|feta|mozzarella|cream|chocolate|soy)\b/i;
const RAW = /\b(lettuce|cucumbers?|tomato(es)?|carrots?|spinach|apples?|berries|strawberries|blueberries|raspberries|grapes?|melon|cantaloupe|honeydew|watermelon|oranges?|bananas?|avocado|onions?|peppers?|celery|kale|arugula|cabbage|sprouts|cilantro|parsley|basil|radish(es)?|pineapple|mango|kiwi|greens|jalapenos?|scallions?|herbs|mint|lemon|lime)\b/i;
function nutrition5kIngredients(csv) {
  const totals = new Map();
  for (const line of csv.split(/\r?\n/)) {
    const cells = line.split(',');
    for (let i = 6; i + 6 < cells.length + 1; i += 7) {
      const name = cells[i + 1]?.trim(), grams = Number(cells[i + 2]), kcal = Number(cells[i + 3]);
      if (!name || !/^[a-z][a-z \-']{1,60}$/i.test(name) || !(grams > 0) || !(kcal >= 0)) continue;
      const entry = totals.get(name) || { name, grams: 0, kcal: 0, count: 0 };
      entry.grams += grams; entry.kcal += kcal; entry.count++; totals.set(name, entry);
    }
  }
  return [...totals.values()].filter(entry => entry.count >= 3 && entry.grams >= 50)
    .map(entry => ({ name: entry.name, kcal100: Math.round(entry.kcal / entry.grams * 1000) / 10, count: entry.count }));
}
const asItem = ingredient => {
  const foodState = AS_SOLD.test(ingredient.name) ? 'as_sold' : RAW.test(ingredient.name) ? 'raw' : 'prepared';
  return { name: ingredient.name, lookupQuery: foodState === 'prepared' ? `${ingredient.name}, cooked` : foodState === 'raw' ? `${ingredient.name}, raw` : ingredient.name, foodState, quantityUnit: 'g', grams: 100, visibility: 'visible' };
};
const energyMatches = (kcal, truth) => Number.isFinite(kcal) && Math.abs(kcal - truth) <= Math.max(20, truth * .2);

async function measureItems() {
  const all = nutrition5kIngredients(readFileSync(NUTRITION5K, 'utf8')).sort((a, b) => Buffer.compare(hash(a.name), hash(b.name))).slice(0, Q2_LIMIT);
  const rows = [], batch = [];
  async function flush() {
    if (!batch.length) return;
    const questions = Object.fromEntries(batch.map((entry, i) => [`q2_${i}`, matchQuestion(entry.item, entry.map)]));
    const response = await askJev({ task: 'Nutrient database matching for single food items' }, questions, env, fetch);
    if (!['used'].includes(response.state)) throw Error('Jev request failed: ' + response.state + ' ' + (response.httpStatus ?? ''));
    for (const [i, entry] of batch.entries()) {
      const answer = response.answers[`q2_${i}`], none = answer.choice === NONE, candidate = none ? null : entry.map.get(answer.choice);
      const found = candidate ? await entry.search.resolveChoice(candidate, entry.list, entry.item) : null;
      const first = await entry.search.resolveCandidate(entry.list[0], entry.item).catch(() => null);
      rows.push({ name: entry.ingredient.name, truth: entry.ingredient.kcal100, state: entry.item.foodState, holdout: holdout(entry.ingredient.name), options: entry.map.size,
        choice: answer.choice, confidence: decisionScore(answer, [...entry.map.keys(), NONE]), rawConfidence: answer.confidence, accepted: !none && Boolean(found), unresolved: !none && !found, kcal: found?.record.nutrients.calories ?? null,
        correct: Boolean(found) && energyMatches(found.record.nutrients.calories, entry.ingredient.kcal100),
        firstHit: { description: entry.list[0].description, correct: Boolean(first) && energyMatches(first.record.nutrients.calories, entry.ingredient.kcal100) } });
    }
    batch.length = 0;
  }
  let noCandidates = 0;
  for (const ingredient of all) {
    const item = asItem(ingredient), search = candidateSearch(env, fetch, null), list = await search.candidatesFor(item);
    if (!list.length) { noCandidates++; continue; }
    batch.push({ ingredient, item, search, list, map: optionMap(list) });
    if (batch.length === 10) await flush();
  }
  await flush();
  return { rows, noCandidates };
}

// ---------- Q1/Q3/Q4/Q6 on the labelled Hungarian dish set ----------
const GROUP_BY_LABEL = Object.fromEntries(Object.entries(HUNGARIAN_DISHES).map(([key, dish]) => [dish.label, key]));
const noul = value => value >= .7 ? true : value <= .3 ? false : null;
async function measureDishes() {
  const set = JSON.parse(readFileSync('calibration/hungarian-dishes.json', 'utf8')).dishes, rows = [];
  for (const dish of set) {
    const raw = { name: dish.name, ingredients: dish.items.map(([name, lookupQuery, foodState, grams]) => ({ name, lookupQuery, foodState, grams, quantityUnit: 'g', visibility: 'visible' })) };
    const built = mealQuestions(raw, new Map());
    // Exactly the production meal state and questions (no Q2 here: no candidates).
    const response = await askJev(mealState(raw), built.questions, env, fetch);
    if (response.state !== 'used') throw Error('Jev request failed: ' + response.state);
    const a = response.answers, predicted = a.q1.choice === NONE ? 'generic' : GROUP_BY_LABEL[a.q1.choice];
    rows.push({ name: dish.name, expected: dish.group, predicted, confidence: a.q1.confidence, accepted: true, correct: predicted === dish.group, holdout: holdout(dish.name),
      prep0: dish.prep0 && a.q3_0 ? { expected: dish.prep0, predicted: a.q3_0.choice, confidence: a.q3_0.confidence } : null,
      hiddenFat: dish.hiddenFat === null ? null : { expected: dish.hiddenFat, score: a.q4.noul, predicted: noul(a.q4.noul) },
      separable: dish.separable === null ? null : { expected: dish.separable, score: a.q6.noul, predicted: noul(a.q6.noul) },
      inputTokens: response.inputTokens });
  }

  return rows;
}

// ---------- evaluation (no API calls; also re-runnable with --from details.json) ----------
const ratio = (part, whole) => whole ? Math.round(part / whole * 1000) / 1000 : null;
const split = rows => ({ calibration: rows.filter(row => !row.holdout), locked: rows.filter(row => row.holdout) });
function evaluateItems(rows, noCandidates, review) {
  const labels = review?.labels || {}, key = row => `${row.name} => ${row.choice}`;
  const accepted = rows.filter(row => row.accepted), labelled = accepted.filter(row => typeof labels[key(row)] === 'boolean');
  // Identity (the plan's "right database record") when the accepted decisions are reviewed; otherwise the measured energy agreement.
  const useIdentity = accepted.length > 0 && labelled.length / accepted.length >= .8;
  const scored = useIdentity ? rows.map(row => ({ ...row, energyCorrect: row.correct, correct: labels[key(row)] === true })) : rows.map(row => ({ ...row, energyCorrect: row.correct }));
  const target = useIdentity ? IDENTITY_TARGET : TARGET, { calibration, locked } = split(scored);
  const chosen = chooseThreshold(calibration, target, 20);
  const energyAt = (list, threshold) => { const kept = list.filter(row => row.accepted && row.confidence >= threshold); return ratio(kept.filter(row => row.energyCorrect).length, kept.length); };
  const raw = list => list.map(row => ({ ...row, confidence: row.rawConfidence }));
  const rawChosen = chooseThreshold(raw(calibration), target, 20);
  const firstHit = list => ratio(list.filter(row => row.firstHit.correct).length, list.length);
  return {
    criterion: useIdentity ? 'identity (reviewed)' : 'energy density ±max(20 kcal, 20%)', target, review: useIdentity ? { reviewedBy: review.reviewedBy, reviewedAt: review.reviewedAt, labelled: labelled.length, accepted: accepted.length, identityPrecisionAll: ratio(labelled.filter(row => labels[key(row)]).length, labelled.length) } : null,
    chosen, sizes: { calibration: calibration.length, holdout: locked.length }, noCandidates,
    calibration: chosen.threshold === null ? null : { ...at(calibration, chosen.threshold), energyAgreement: energyAt(calibration, chosen.threshold) },
    holdout: chosen.threshold === null ? null : { ...at(locked, chosen.threshold), energyAgreement: energyAt(locked, chosen.threshold) },
    energyCurve: chooseThreshold(rows.map(row => ({ ...row })), TARGET, 20).curve,
    rawConfidence: { threshold: rawChosen.threshold, holdout: rawChosen.threshold === null ? null : at(raw(locked), rawChosen.threshold) },
    baselines: { firstHitEnergyAgreementCalibration: firstHit(calibration), firstHitEnergyAgreementHoldout: firstHit(locked), jevEnergyAgreementAllAccepted: ratio(accepted.filter(row => row.correct).length, accepted.length), noneRate: ratio(rows.filter(row => row.choice === NONE).length, rows.length), unresolved: rows.filter(row => row.unresolved).length },
  };
}
function evaluateDishes(rows) {
  const { calibration, locked } = split(rows), chosen = chooseThreshold(calibration, TARGET, 15);
  const accuracy = key => { const scored = rows.map(row => row[key]).filter(Boolean), decided = scored.filter(row => row.predicted !== null); return { scored: scored.length, decided: decided.length, correct: decided.filter(row => row.predicted === row.expected).length, accuracy: ratio(decided.filter(row => row.predicted === row.expected).length, decided.length) }; };
  return { chosen, sizes: { calibration: calibration.length, holdout: locked.length }, calibration: chosen.threshold === null ? null : at(calibration, chosen.threshold), holdout: chosen.threshold === null ? null : at(locked, chosen.threshold),
    q1Accuracy: ratio(rows.filter(row => row.correct).length, rows.length), errors: rows.filter(row => !row.correct).map(({ name, expected, predicted, confidence }) => ({ name, expected, predicted, confidence })),
    q3: accuracy('prep0'), q4: accuracy('hiddenFat'), q6: accuracy('separable') };
}

const startedAt = new Date().toISOString(), source = args.from ? JSON.parse(readFileSync(args.from, 'utf8')) : null;
if (!source) console.error('Q1/Q3/Q4/Q6 on the labelled Hungarian dish set…');
const dishRows = source?.dishRows ?? await measureDishes();
if (!source) console.error(`Q2 on weighed Nutrition5k ingredients (limit ${Q2_LIMIT})…`);
const measured = source ? { rows: source.itemRows, noCandidates: source.item.noCandidates } : await measureItems();
const review = existsSync('calibration/q2-identity-review.json') ? JSON.parse(readFileSync('calibration/q2-identity-review.json', 'utf8')) : null;
const items = evaluateItems(measured.rows, measured.noCandidates, review), dishes = evaluateDishes(dishRows);
const deltaPairs = args['delta-pairs'] && existsSync(args['delta-pairs']) ? JSON.parse(readFileSync(args['delta-pairs'], 'utf8')) : [];
const delta = deltaPairs.length ? chooseDelta(deltaPairs) : { status: 'pending', reason: 'Nincs párosított gyors + Food-R1 becslés lemért tányérokon (a Modal /estimate végpont még nincs telepítve).' };
const entry = (part, minAccepted) => part.chosen.threshold !== null && part.holdout?.precision !== null
  ? { status: 'calibrated', value: part.chosen.threshold, minAccepted, calibrationSplit: part.calibration, holdoutSplit: part.holdout }
  : { status: 'target_not_reached', minAccepted, curve: part.chosen.curve };
const result = {
  generatedAt: source?.generatedAt ?? startedAt, evaluatedAt: startedAt, jevModel: source?.jevModel ?? jevModel(env),
  item: { ...entry(items, 20), criterion: items.criterion, target: items.target, review: items.review, dataset: 'Nutrition5k cafe1 (weighed, CC BY 4.0); production candidate retrieval + Q2', sizes: items.sizes, noCandidates: items.noCandidates, baselines: items.baselines, curve: items.chosen.curve, energyCurve: items.energyCurve, rawConfidenceComparison: items.rawConfidence },
  dish: { ...entry(dishes, 15), criterion: 'labelled dish group', target: TARGET, dataset: 'calibration/hungarian-dishes.json', sizes: dishes.sizes, q1Accuracy: dishes.q1Accuracy, errors: dishes.errors, curve: dishes.chosen.curve },
  delta, checks: { q3Preparation: dishes.q3, q4HiddenFat: dishes.q4, q6Separable: dishes.q6 },
};
writeFileSync(args.out || 'outputs/jev-calibration-details.json', JSON.stringify({ ...result, item: { ...result.item, noCandidates: measured.noCandidates }, itemRows: measured.rows, dishRows }, null, 2));
if (args.write) writeFileSync('lib/jev-calibration.json', JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));