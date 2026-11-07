import { FOOD_REFERENCE } from './food-reference.mjs';
import { HUNGARIAN_DISHES, FOOD_STATES } from './hungarian-food.mjs';
export const PROMPT_VERSION = 'food-v5-full-image-portion';
export const NUTRIENTS = ['calories', 'protein', 'carbs', 'fat', 'fiber', 'sugar', 'sodium', 'saturatedFat'];
export const OPTIONAL_NUTRIENTS = ['fiber', 'sugar', 'sodium', 'saturatedFat'];
const nutrientLabels = { calories: 'Energia', protein: 'Fehérje', carbs: 'Szénhidrát', fat: 'Zsír', fiber: 'Rost', sugar: 'Cukor', sodium: 'Nátrium', saturatedFat: 'Telített zsírsavak' };
export const TYPES = ['Reggeli', 'Ebéd', 'Vacsora', 'Kisétkezés'];
export class AppError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
export function check(condition, message, status = 400) {
  if (!condition) throw new AppError(message, status);
}
export function text(value, max = 160, allowEmpty = false) {
  check(typeof value === 'string' && value.trim().length <= max && (allowEmpty || value.trim().length), `A szöveg hiányzik, vagy hosszabb a megengedett ${max} karakternél.`);
  return value.trim();
}
export function day(value) {
  check(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number(value.slice(0, 4)) >= 1900 && Number(value.slice(0, 4)) <= 2100, 'Érvénytelen dátum.');
  const parsed = new Date(`${value}T12:00:00Z`);
  check(Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value, 'Érvénytelen dátum.');
  return value;
}
export function metadata(value) {
  check(value && typeof value === 'object', 'Hiányzó étkezési adatok.');
  check(/^([01]\d|2[0-3]):[0-5]\d$/.test(value.time), 'Érvénytelen időpont.');
  check(TYPES.includes(value.type), 'Érvénytelen étkezéstípus.');
  const timezone = text(value.timezone ?? 'Europe/Budapest', 100);
  try { new Intl.DateTimeFormat('hu', { timeZone: timezone }); } catch { throw new AppError('Érvénytelen időzóna.'); }
  return { day: day(value.day), time: value.time, type: value.type, notes: text(value.notes ?? '', 2000, true), timezone };
}
export function validateAnalysis(value, references = FOOD_REFERENCE) {
  check(value && typeof value === 'object', 'Az elemzés formátuma hibás.');
  check(['low', 'medium', 'high'].includes(value.confidence), 'Hiányzó bizonyossági szint.');
  check(Array.isArray(value.ingredients) && value.ingredients.length > 0 && value.ingredients.length <= 40, '1–40 összetevő adható meg.');
  const ingredients = value.ingredients.map(item => {
    check(item && typeof item === 'object', 'Hibás összetevő.');
    if (value.reportVersion === 2) {
      check(['visible', 'inferred'].includes(item.visibility), 'Hiányzó vagy hibás képi bizonyíték.');
      check(Number.isFinite(item.gramsMin) && Number.isFinite(item.gramsMax), 'Hiányzó adagtartomány.');
    }
    check(typeof item.grams === 'number' && Number.isFinite(item.grams) && item.grams > 0 && item.grams <= 5000, 'Az összetevő tömege legyen nagyobb nullánál, és legfeljebb 5000 g lehet.');
    const result = { name: text(item.name), grams: item.grams };
    for (const nutrient of NUTRIENTS) {
      const amount = nutrient === 'saturatedFat' ? item[nutrient] ?? null : item[nutrient];
      if (OPTIONAL_NUTRIENTS.includes(nutrient) && amount === null) { result[nutrient] = null; continue; }
      const max = nutrient === 'calories' ? 1000 : nutrient === 'sodium' ? 100000 : 100;
      const unit = nutrient === 'calories' ? 'kcal' : nutrient === 'sodium' ? 'mg' : 'g';
      check(typeof amount === 'number' && Number.isFinite(amount) && amount >= 0 && amount <= max, `${nutrientLabels[nutrient]}: 100 g ételre vonatkozó, 0 és ${max} ${unit} közötti értéket adj meg.`);
      result[nutrient] = amount;
    }
    const min = item.gramsMin ?? item.grams, max = item.gramsMax ?? item.grams;
    check(Number.isFinite(min) && Number.isFinite(max) && min >= 0 && min <= item.grams && max >= item.grams && max <= 5000, 'Az adagtartomány nem foglalja magába a becsült tömeget.');
    check(item.referenceKey == null || typeof item.referenceKey === 'string' && item.referenceKey.length <= 100, 'Hibás tápértékforrás.');
    const ref = Object.hasOwn(references, item.referenceKey) ? references[item.referenceKey] : null;
    const matches = ref && NUTRIENTS.every(key => result[key] === ref.nutrients[key]);
    Object.assign(result, {
      gramsMin: min, gramsMax: max, preparation: text(item.preparation ?? 'Nincs pontosítva', 240),
      visibility: item.visibility === 'inferred' ? 'inferred' : 'visible',
      portionNote: text(item.portionNote ?? '', 600, true),
      alternatives: stringList(item.alternatives ?? [], 3),
      sourceType: item.sourceType === 'reference' && matches ? 'reference' : item.sourceType === 'user' || item.sourceType === 'reference' ? 'user' : 'ai',
      referenceKey: matches && item.sourceType === 'reference' ? item.referenceKey : null,
      referenceRecord: matches && item.sourceType === 'reference' ? ref : null,
      sourceConfirmed: matches && item.sourceType === 'reference' && item.sourceConfirmed === true,
      weightBasis: ['measured_total', 'measured_ingredient', 'user'].includes(item.weightBasis) ? item.weightBasis : 'visual',
      foodState: FOOD_STATES.includes(item.foodState) ? item.foodState : 'unknown',
    });
    return result;
  });
  const result = { name: text(value.name), confidence: value.confidence, assumptions: text(value.assumptions ?? '', 3000, true), ingredients };
  if (value.portionScope != null) { check(value.portionScope === 'full_image', 'A teljes képen látható adag számít.'); result.portionScope = 'full_image'; }
  if (value.dishProfile != null) { check(typeof value.dishProfile === 'string' && Object.hasOwn(HUNGARIAN_DISHES, value.dishProfile), 'Ismeretlen magyar ételcsoport.'); result.dishProfile = value.dishProfile; }
  if (value.reportVersion === 2) {
    check(['good', 'limited', 'poor'].includes(value.imageQuality?.level), 'Hiányzó képminőség-értékelés.');
    Object.assign(result, { reportVersion: 2, summary: text(value.summary, 1000), observations: stringList(value.observations, 8), questions: stringList(value.questions, 5), imageQuality: { level: value.imageQuality.level, issues: stringList(value.imageQuality.issues, 8) } });
  }
  if (value.recipe != null) {
    const recipe = value.recipe;
    check(recipe && typeof recipe === 'object' && recipe.lossesAccountedFor === true, 'Jelöld be, hogy csak az ételben maradt alapanyagokat adtad meg, és az esetleges veszteséget levontad.');
    check(Number.isFinite(recipe.cookedWeightG) && recipe.cookedWeightG > 0 && recipe.cookedWeightG <= 50000, 'Az egész elkészült étel tömege legyen nagyobb nullánál, és legfeljebb 50 000 g lehet.');
    check(Number.isFinite(recipe.eatenWeightG) && recipe.eatenWeightG > 0 && recipe.eatenWeightG <= Math.min(5000, recipe.cookedWeightG), 'A képen látható teljes adag nem lehet több a teljes kész receptnél vagy 5000 g-nál.');
    const batch = validateAnalysis({ name: result.name, confidence: 'low', ingredients: recipe.ingredients }, references).ingredients;
    const batchTotals = totals(batch);
    check(batchTotals.protein + batchTotals.carbs + batchTotals.fat + (batchTotals.fiber ?? 0) <= recipe.cookedWeightG * 1.05, 'A megadott tápanyagok össztömege nagyobb, mint az elkészült ételé. Ellenőrizd az étel tömegét és a 100 g-ra megadott adatokat.');
    result.recipe = { cookedWeightG: recipe.cookedWeightG, eatenWeightG: recipe.eatenWeightG, lossesAccountedFor: true, ingredients: batch };
    const fraction = recipe.eatenWeightG / recipe.cookedWeightG;
    result.ingredients = batch.map(item => ({ ...item, grams: item.grams * fraction, gramsMin: item.grams * fraction, gramsMax: item.grams * fraction, weightBasis: 'recipe', visibility: 'visible', alternatives: [], portionNote: 'A receptből az adagra jutó alapanyag mennyisége. A kész adag tömegét külön mutatjuk.' }));
  }
  return result;
}
export function totals(ingredients) {
  return Object.fromEntries(NUTRIENTS.map(key => [key, ingredients.some(item => item[key] == null) ? null : Math.round(ingredients.reduce((sum, item) => sum + item[key] * item.grams / 100, 0) * 10) / 10]));
}
export function stringList(value, max = 8) {
  check(Array.isArray(value) && value.length <= max, 'Túl sok vagy hibás elem az elemzésben.');
  return value.map(item => text(item, 500));
}
export function analysisContext(value = {}) {
  check(value && typeof value === 'object' && !Array.isArray(value), 'Hibás adagadatok.');
  check(value.language == null || ['hu', 'en'].includes(value.language), 'Nem támogatott nyelv.');
  check(value.portionScope == null || value.portionScope === 'full_image', 'Mindig a képen látható teljes ehető mennyiséggel számolunk.');
  check(value.consumedPercent == null || value.consumedPercent === 100, 'Mindig a képen látható teljes ehető mennyiséggel számolunk; részadag nem adható meg.');
  const numeric = (key, min, max, fallback) => {
    const amount = value[key] ?? fallback;
    const label = { totalWeightG: 'Az egész étel tömege', inedibleWeightG: 'A csont és más nem ehető rész tömege', plateDiameterCm: 'A tányér átmérője' }[key];
    check(amount === null || typeof amount === 'number' && Number.isFinite(amount) && amount >= min && amount <= max, `${label}: ${min} és ${max} ${key === 'plateDiameterCm' ? 'cm' : 'g'} közötti értéket adj meg.`);
    return amount;
  };
  const result = { language: value.language ?? 'hu', portionScope: 'full_image', totalWeightG: numeric('totalWeightG', 1, 5000, null), inedibleWeightG: numeric('inedibleWeightG', 0, 4999, 0), plateDiameterCm: numeric('plateDiameterCm', 5, 60, null) };
  if (value.dishProfile != null) { check(typeof value.dishProfile === 'string' && Object.hasOwn(HUNGARIAN_DISHES, value.dishProfile), 'Ismeretlen magyar ételcsoport.'); result.dishProfile = value.dishProfile; }
  if (value.preparationNotes != null) result.preparationNotes = text(value.preparationNotes, 1200, true);
  check(!result.inedibleWeightG || result.totalWeightG && result.inedibleWeightG < result.totalWeightG, 'Add meg az egész étel tömegét is. Ennek nagyobbnak kell lennie a csont és más nem ehető részek együttes tömegénél.');
  return result;
}
export function analysisReport(analysis) {
  const ingredients = analysis.ingredients, total = totals(ingredients), round = n => Math.round(n * 10) / 10;
  const warnings = [];
  if (analysis.recipe) warnings.push('A megadott, ételben maradt alapanyagokból számolunk. A főzés közbeni tápanyagveszteséget nem mértük; vitamintartalmat nem határozunk meg.');
  if (ingredients.some(item => item.weightBasis === 'measured_total')) warnings.push('Az étel teljes tömege mért adat, de az összetevők aránya még becslés. Az olaj és a zsíros részek mennyisége jelentősen befolyásolhatja a kalóriatartalmat.');
  if (ingredients.some(item => item.sourceType === 'ai')) warnings.push('Van AI által becsült tápérték. A pontosabb számításhoz válassz megfelelő adatbázisforrást, vagy írd be a termék címkéjén szereplő értékeket.');
  for (const item of ingredients) {
    const macroEnergy = 4 * (item.protein + item.carbs) + 9 * item.fat + 2 * (item.fiber ?? 0);
    if (Math.abs(macroEnergy - item.calories) > Math.max(40, item.calories * .3)) warnings.push(`${item.name}: a megadott kalóriatartalom jelentősen eltér a tápanyagokból számított értéktől. Ellenőrizd a 100 g-ra megadott adatokat.`);
    if (item.protein + item.carbs + item.fat + (item.fiber ?? 0) > 105) warnings.push(`${item.name}: a fő tápanyagok összege meghaladja a 100 g-os alapot; ellenőrizd az egységet és az adagot.`);
    if (item.sugar !== null && item.sugar > item.carbs + .5) warnings.push(`${item.name}: a cukor több a szénhidrátnál; pontosítás szükséges.`);
    if (item.saturatedFat != null && item.saturatedFat > item.fat + .1) warnings.push(`${item.name}: a telített zsír több az összes zsírnál; pontosítás szükséges.`);
  }
  const fixedTotal = !analysis.recipe && ingredients.every(item => item.weightBasis === 'measured_total');
  const energyAt = upper => {
    const boundary = fixedTotal || !upper ? 'gramsMin' : 'gramsMax';
    let energy = ingredients.reduce((sum, item) => sum + item.calories * (item[boundary] ?? item.grams) / 100, 0);
    if (!fixedTotal) return energy;
    // Fill the known total mass within each component's bounds; only the composition can vary.
    let remaining = ingredients.reduce((sum, item) => sum + item.grams - (item.gramsMin ?? item.grams), 0);
    const ordered = [...ingredients].sort((a,b) => upper ? b.calories-a.calories : a.calories-b.calories);
    for (const item of ordered) {
      const extra = Math.min(Math.max(0, remaining), (item.gramsMax ?? item.grams) - (item.gramsMin ?? item.grams));
      energy += extra * item.calories / 100; remaining -= extra;
    }
    return energy;
  };
  const basis = analysis.recipe ? 'recipe' : ingredients.every(item => item.weightBasis === 'measured_ingredient') ? 'measured_ingredients' : fixedTotal ? 'measured_total' : ingredients.some(item => ['user','measured_total','measured_ingredient'].includes(item.weightBasis)) ? 'edited' : 'visual';
  return { total, basis, weight: analysis.recipe ? analysis.recipe.eatenWeightG : round(ingredients.reduce((sum, item) => sum + item.grams, 0)), energyRange: { min: round(energyAt(false)), max: round(energyAt(true)), kind: analysis.recipe ? 'recipe' : fixedTotal ? 'fixed_total' : 'independent_portions' }, referenceCount: ingredients.filter(item => item.sourceType === 'reference').length, confirmedCount: ingredients.filter(item => item.sourceConfirmed).length, unknown: OPTIONAL_NUTRIENTS.filter(key => total[key] === null), warnings, salt: total.sodium === null ? null : Math.round(total.sodium * 2.5 / 1000 * 100) / 100 };
}
export function validateImage(value) {
  check(typeof value === 'string' && value.length < 5_600_000, 'A kép legfeljebb 4 MB lehet.', 413);
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  check(match && match[2].length % 4 === 0, 'JPEG, PNG vagy WebP kép szükséges.');
  let bytes;
  try { bytes = Uint8Array.from(atob(match[2].slice(0, 64)), c => c.charCodeAt(0)); }
  catch { throw new AppError('Hibás képkódolás.'); }
  const mime = match[1];
  const valid = mime === 'image/jpeg' ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
    : mime === 'image/png' ? [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v)
    : String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
  check(valid && match[2].length > 100, 'A fájl nem érvényes kép.');
  return { mime, data: match[2] };
}
export function validId(value) {
  check(typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value), 'Érvénytelen azonosító.');
  return value;
}
