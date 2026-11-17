import { HUNGARIAN_DISHES } from './hungarian-food.mjs';

// Personal portion prior per canonical dish (architecture plan: user_correction).
// The user's own data: it travels with the account and is deleted with it.
export const MIN_SAMPLES = 2;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const dishKeyOf = key => typeof key === 'string' && key !== 'generic' && Object.hasOwn(HUNGARIAN_DISHES, key) ? key : null;

export function personalFactor(row) {
  if (!row || Number(row.samples) < MIN_SAMPLES || !Number.isFinite(Number(row.portion_factor))) return 1;
  const factor = clamp(Number(row.portion_factor), .5, 2);
  return Math.abs(factor - 1) >= .05 ? Math.round(factor * 100) / 100 : 1;
}
// Visually estimated gram items only: labels, ml drinks, measured totals and recipes say nothing about portion habits.
const visualGrams = analysis => (analysis?.ingredients || []).filter(item => item.quantityUnit !== 'ml' && item.weightBasis !== 'label').reduce((sum, item) => sum + (Number(item.grams) || 0), 0);
export function portionRatio(original, saved) {
  if (!original || !saved || saved.recipe || original.ingredients?.some(item => item.weightBasis === 'measured_total')) return null;
  const before = visualGrams(original), after = visualGrams(saved);
  if (!(before > 0 && after > 0)) return null;
  const ratio = after / before;
  return ratio >= .3 && ratio <= 3 ? ratio : null;
}
export async function loadCorrection(db, userId, dishKey) {
  const key = dishKeyOf(dishKey);
  return key && userId ? db.prepare('SELECT portion_factor,preparation,samples FROM user_correction WHERE user_id=? AND dish_key=?').bind(userId, key).first() : null;
}
// Running average over the latest ~10 confirmations; an unchanged save pulls the factor toward 1.
export async function rememberCorrection(db, userId, dishKey, { ratio = null, preparation } = {}) {
  const key = dishKeyOf(dishKey);
  if (!key || !userId || ratio !== null && !(ratio >= .3 && ratio <= 3)) return null;
  const current = await loadCorrection(db, userId, key);
  const samples = Number(current?.samples ?? 0), weight = Math.min(samples, 9);
  const factor = ratio === null ? current?.portion_factor ?? null : clamp(current?.portion_factor == null ? ratio : (Number(current.portion_factor) * weight + ratio) / (weight + 1), .5, 2);
  const nextPreparation = preparation === undefined ? current?.preparation ?? null : preparation;
  const nextSamples = samples + (ratio === null ? 0 : 1), time = new Date().toISOString();
  await db.prepare('INSERT INTO user_correction(user_id,dish_key,portion_factor,preparation,samples,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(user_id,dish_key) DO UPDATE SET portion_factor=excluded.portion_factor,preparation=excluded.preparation,samples=excluded.samples,updated_at=excluded.updated_at')
    .bind(userId, key, factor, nextPreparation, nextSamples, time).run();
  return { portion_factor: factor, preparation: nextPreparation, samples: nextSamples };
}
export async function learnFromSave(db, userId, original, saved) {
  const ratio = portionRatio(original, saved);
  return ratio === null ? null : rememberCorrection(db, userId, original.dishProfile, { ratio });
}
