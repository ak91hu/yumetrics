import { readFileSync } from 'node:fs';

// Measured thresholds written by scripts/calibrate-jev.mjs. Only a value whose status is
// "calibrated" (enough reference cases, target precision reached) replaces the starting value.
let file = null;
try { file = JSON.parse(readFileSync(new URL('./jev-calibration.json', import.meta.url), 'utf8')); } catch { file = null; }
export const calibration = () => file;
const GRID = Array.from({ length: 14 }, (_, i) => Math.round((.3 + i * .05) * 100) / 100);
const ratio = (part, whole) => whole ? Math.round(part / whole * 1000) / 1000 : null;
// rows: { accepted, confidence, correct }. Precision = correct share of accepted decisions at ≥ threshold.
export function thresholdStats(rows, threshold) {
  const accepted = rows.filter(row => row.accepted && row.confidence >= threshold);
  return { n: rows.length, accepted: accepted.length, precision: ratio(accepted.filter(row => row.correct).length, accepted.length), coverage: ratio(accepted.length, rows.length) ?? 0 };
}
// θ: the smallest threshold whose precision reaches the target with enough accepted decisions.
export function chooseThreshold(rows, target, minAccepted) {
  const curve = GRID.map(threshold => ({ threshold, ...thresholdStats(rows, threshold) }));
  return { curve, threshold: curve.find(point => point.accepted >= minAccepted && point.precision >= target)?.threshold ?? null };
}
// δ from pairs {fastKcal, foodR1Kcal, truthKcal}: the smallest δ that keeps the question screen
// at most maxQuestionRate, where averaging the two estimates is not worse than the fast one.
export function chooseDelta(pairs, maxQuestionRate = .3, minPairs = 20) {
  if (pairs.length < minPairs) return { status: 'insufficient', n: pairs.length, reason: `Legalább ${minPairs} lemért tányér kell, amelyhez gyors és Food-R1 becslés is van.` };
  const mean = list => list.length ? list.reduce((sum, value) => sum + value, 0) / list.length : null;
  const curve = Array.from({ length: 12 }, (_, i) => Math.round((.05 + i * .05) * 100) / 100).map(delta => {
    const agree = pairs.filter(p => Math.abs(p.foodR1Kcal - p.fastKcal) / Math.max(p.foodR1Kcal, p.fastKcal, 1) <= delta);
    return { delta, questionRate: ratio(pairs.length - agree.length, pairs.length), averagedMae: mean(agree.map(p => Math.abs((p.fastKcal + p.foodR1Kcal) / 2 - p.truthKcal))), fastMae: mean(agree.map(p => Math.abs(p.fastKcal - p.truthKcal))) };
  });
  const hit = curve.find(point => point.questionRate <= maxQuestionRate && point.averagedMae !== null && point.averagedMae <= point.fastMae);
  return hit ? { status: 'calibrated', value: hit.delta, n: pairs.length, curve } : { status: 'target_not_reached', n: pairs.length, curve };
}
export function calibrated(key, fallback) {
  const entry = file?.[key];
  return entry?.status === 'calibrated' && typeof entry.value === 'number' && entry.value > 0 && entry.value < 1 ? entry.value : fallback;
}
