import { check, text, NUTRIENTS } from './domain.mjs';

export function normalizeLabel(value) {
  check(value && typeof value === 'object' && !Array.isArray(value), 'Hibás címkeadatok.');
  const string = (key, limit) => value[key] == null ? null : text(value[key], limit, true) || null;
  const amount = (key, max = 50000) => {
    const number = value[key] ?? null;
    check(number === null || typeof number === 'number' && Number.isFinite(number) && number > 0 && number <= max, 'Hibás szám a címke adatai között.');
    return number;
  };
  const unit = key => { check(value[key] == null || ['g', 'ml'].includes(value[key]), 'A címke mértékegysége g vagy ml lehet.'); return value[key] ?? null; };
  const raw = value.nutrients;
  check(raw && typeof raw === 'object', 'Hiányzó címketápértékek.');
  const nutrients = Object.fromEntries([...NUTRIENTS, 'energyKj', 'saltG'].map(key => {
    const number = raw[key] ?? null;
    check(number === null || typeof number === 'number' && Number.isFinite(number) && number >= 0 && number <= 100000, 'Hibás tápérték a címkén.');
    return [key, number];
  }));
  check(value.carbsIncludeFiber == null || typeof value.carbsIncludeFiber === 'boolean', 'Ismeretlen szénhidrátjelölés.');
  check(value.prepared == null || typeof value.prepared === 'boolean', 'Ismeretlen címkeállapot.');
  const packageCount = amount('packageCount', 50);
  check(packageCount == null || Number.isInteger(packageCount) && packageCount >= 1, 'Hibás csomagdarabszám.');
  const barcode = string('barcode', 40);
  const digits = barcode && /^(\d{8}|\d{12,14})$/.test(barcode) ? [...barcode].map(Number) : null;
  const validBarcode = digits && digits.at(-1) === (10 - digits.slice(0, -1).reverse().reduce((sum, n, i) => sum + n * (i % 2 ? 1 : 3), 0) % 10) % 10;
  check(Array.isArray(value.issues ?? []) && (value.issues ?? []).length <= 8, 'Túl sok címkekorlát.');
  return {
    productName: string('productName', 160), brand: string('brand', 120), barcode, barcodeValid: Boolean(validBarcode),
    netAmount: amount('netAmount'), netUnit: unit('netUnit'), packageCount,
    basisAmount: amount('basisAmount'), basisUnit: unit('basisUnit'), prepared: value.prepared ?? null,
    carbsIncludeFiber: value.carbsIncludeFiber ?? null, nutrients,
    ingredientsText: string('ingredientsText', 4000), allergensText: string('allergensText', 1000),
    issues: (value.issues ?? []).map(issue => text(issue, 500)),
  };
}

export function labelNutrients(label) {
  if (!label || !label.basisAmount || !label.basisUnit || label.prepared == null || label.carbsIncludeFiber == null) return null;
  const n = label.nutrients;
  if ([n.protein, n.carbs, n.fat, n.calories ?? n.energyKj].some(value => value == null) || label.carbsIncludeFiber && n.fiber == null) return null;
  const factor = 100 / label.basisAmount;
  const calories = n.calories ?? n.energyKj / 4.184;
  if (n.calories != null && n.energyKj != null) check(Math.abs(n.calories - n.energyKj / 4.184) <= Math.max(5, n.calories * .04), 'A címke kcal- és kJ-adatai ellentmondanak. Ellenőrizd az olvashatóságot.');
  if (n.sodium != null && n.saltG != null) check(Math.abs(n.sodium - n.saltG * 400) <= Math.max(10, n.sodium * .05), 'A címke só- és nátriumadatai ellentmondanak.');
  const result = { ...n, calories, carbs: n.carbs - (label.carbsIncludeFiber ? n.fiber : 0), sodium: n.sodium ?? (n.saltG == null ? null : n.saltG * 400) };
  check(result.carbs >= 0, 'A címke rosttartalma nem lehet több az azt tartalmazó összes szénhidrátnál.');
  const normalized = Object.fromEntries(NUTRIENTS.map(key => [key, result[key] == null ? null : Math.round(result[key] * factor * 1e6) / 1e6]));
  check((label.basisUnit === 'ml' || normalized.protein + normalized.carbs + normalized.fat + (normalized.fiber ?? 0) <= 105) && (normalized.sugar == null || normalized.sugar <= normalized.carbs + 1) && (normalized.saturatedFat == null || normalized.saturatedFat <= normalized.fat + 1), 'A címke tápértékei ellentmondanak egymásnak.');
  return normalized;
}

export function originalLabels(analysis) {
  return [...(analysis?.ingredients || []), ...(analysis?.recipe?.ingredients || [])].filter(item => item.productLabel).map(item => JSON.stringify(normalizeLabel(item.productLabel)));
}
