import { foodTokens } from './free-food-data.mjs';

// Food-R1 currently identifies names, not weights. Never spend a GPU call just
// because the portion bounds are wide, a database is offline, or a label is incomplete.
export function uncertainFoodIdentities(raw) {
  if (!raw?.isFood || raw.imageQuality?.level === 'poor' || !Array.isArray(raw.ingredients)) return [];
  return raw.ingredients.flatMap((item, index) => {
    if (!item || item.productLabel || item.visibility !== 'visible') return [];
    const alternatives = Array.isArray(item.alternatives) ? item.alternatives.filter(x => typeof x === 'string' && x.trim()).slice(0, 3) : [];
    return item.identityUncertain === true || raw.confidence === 'low' && alternatives.length > 0 ? [{ index, reason: 'food_identity', name: String(item.name || '').slice(0, 160), query: String(item.lookupQuery || '').slice(0, 180), alternatives }] : [];
  }).slice(0, 12);
}
export function applyRecognitionEvidence(raw, targets, recognition, language = 'hu') {
  const candidates = recognition.candidates || [];
  const review = targets.map(target => {
    const primary = foodTokens(target.query || target.name);
    const supported = candidates.some(candidate => foodTokens(candidate) === primary);
    return { ingredientIndex: target.index, state: supported ? 'corroborated_unverified' : candidates.length ? 'unresolved' : 'unavailable', candidates };
  });
  // Agreement does not verify identity. Never rename/add/remove food, change
  // grams/nutrients or narrow uncertainty using a names-only helper response.
  if (targets.length) {
    raw.confidence = 'low';
    raw.questions = [];
    const note = language === 'en' ? 'Some food identities remain uncertain; the result uses the primary estimate.' : 'Néhány összetevő azonossága bizonytalan; a végeredmény a legvalószínűbb becslésből készült.';
    raw.observations = [...(Array.isArray(raw.observations) ? raw.observations : []).slice(0, 7), note];
  }
  return review;
}
