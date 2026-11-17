// Barcode branch (architecture plan): Open Food Facts label values × quantity, no AI.
// Shared by the browser (served as /barcode.mjs) and the server; no Node-only imports.
export const OFF_FIELDS = 'code,product_name,product_name_hu,product_name_en,brands,nutriments,nutrition_data_per,serving_quantity,serving_quantity_unit,quantity,product_quantity,product_quantity_unit';
export const offProductUrl = code => `https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=${OFF_FIELDS}`;

// GTIN-8/12/13/14 with a valid check digit.
export function validBarcode(value) {
  const code = String(value ?? '').trim();
  if (!/^(\d{8}|\d{12,14})$/.test(code)) return false;
  const digits = [...code].map(Number), check = digits.pop();
  const sum = digits.reverse().reduce((total, digit, index) => total + digit * (index % 2 === 0 ? 3 : 1), 0);
  return (10 - sum % 10) % 10 === check;
}
const text = (value, max = 160) => typeof value === 'string' && value.trim() ? value.trim().replace(/\s+/g, ' ').slice(0, max) : null;
const amount = (value, max) => { const number = typeof value === 'string' ? Number(value.replace(',', '.')) : value; return typeof number === 'number' && Number.isFinite(number) && number >= 0 && number <= max ? Math.round(number * 1e6) / 1e6 : null; };

// OFF v2 product -> per-100 g/ml values. Missing optional values stay null, never zero.
export function normalizeOffProduct(product, language = 'hu') {
  if (!product || !validBarcode(product.code)) return null;
  const n = product.nutriments || {};
  const volume = /^(ml|cl|l)$/i.test(product.product_quantity_unit || '') || /\b\d+(?:[.,]\d+)?\s?(ml|cl|l)\b/i.test(product.quantity || '') || product.nutrition_data_per === '100ml';
  const kcal = amount(n['energy-kcal_100g'], 1000) ?? (amount(n['energy-kj_100g'], 4200) === null ? null : Math.round(amount(n['energy-kj_100g'], 4200) / 4.184 * 10) / 10);
  const sodium = amount(n.sodium_100g, 100) ?? (amount(n.salt_100g, 100) === null ? null : amount(n.salt_100g, 100) * 400 / 1000);
  // OFF follows EU labelling: carbohydrates exclude fibre.
  const per100 = { calories: kcal, protein: amount(n.proteins_100g, 100), carbs: amount(n.carbohydrates_100g, 100), fat: amount(n.fat_100g, 100), fiber: amount(n.fiber_100g, 100), sugar: amount(n.sugars_100g, 100), sodium: sodium === null ? null : Math.round(sodium * 1000 * 10) / 10, saturatedFat: amount(n['saturated-fat_100g'], 100) };
  const complete = ['calories', 'protein', 'carbs', 'fat'].every(key => per100[key] !== null);
  const serving = amount(product.serving_quantity, 5000);
  const packageAmount = amount(product.product_quantity, 5000);
  return {
    code: String(product.code), name: text(product[`product_name_${language}`]) || text(product.product_name) || null, brand: text(product.brands?.split?.(',')[0]),
    unit: volume ? 'ml' : 'g', per100: complete ? per100 : null,
    suggestedQuantity: serving && serving > 0 ? serving : packageAmount && packageAmount > 0 ? packageAmount : null,
  };
}

// Server-side validation of what the browser sends; the numbers still pass validateAnalysis.
export function barcodeInput(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const quantity = amount(value.quantity, 5000);
  if (!validBarcode(value.code) || !['g', 'ml'].includes(value.unit) || !(quantity > 0) || !value.per100 || typeof value.per100 !== 'object') return null;
  const per100 = Object.fromEntries(['calories', 'protein', 'carbs', 'fat', 'fiber', 'sugar', 'sodium', 'saturatedFat'].map(key => [key, value.per100[key] == null ? null : amount(value.per100[key], key === 'sodium' ? 100000 : 1000)]));
  if (['calories', 'protein', 'carbs', 'fat'].some(key => per100[key] === null)) return null;
  return { code: String(value.code), name: text(value.name), brand: text(value.brand), unit: value.unit, quantity, per100 };
}

const LABELS = {
  hu: { product: 'Vonalkódos termék', source: code => `Open Food Facts (ODbL) · vonalkód: ${code}`, note: code => `A tápértékek az Open Food Facts közösségi adatbázisból származnak (vonalkód: ${code}, ODbL), a mennyiséget te adtad meg. A közösségi adat eltérhet a csomagoláson lévőtől; ellenőrizd.` },
  en: { product: 'Barcoded product', source: code => `Open Food Facts (ODbL) · barcode: ${code}`, note: code => `Nutrient values come from the Open Food Facts community database (barcode: ${code}, ODbL); you entered the quantity. Community data may differ from the package; please check it.` },
};
// The diary entry; the OFF record itself is not stored as a reference database row.
export function barcodeAnalysis(input, language = 'hu') {
  const words = LABELS[language === 'en' ? 'en' : 'hu'];
  const name = [input.brand, input.name].filter(Boolean).join(' ').slice(0, 160) || words.product;
  return {
    reportVersion: 2, name, summary: name, confidence: 'medium', assumptions: words.note(input.code), observations: [], questions: [], portionScope: 'full_image',
    imageQuality: { level: 'good', issues: [] }, dishProfile: 'generic',
    ingredients: [{ name, grams: input.quantity, gramsMin: input.quantity, gramsMax: input.quantity, quantityUnit: input.unit, ...input.per100, sourceType: 'user', weightBasis: 'user', visibility: 'visible', foodState: 'as_sold', preparation: words.source(input.code).slice(0, 240), alternatives: [], portionNote: '' }],
  };
}
