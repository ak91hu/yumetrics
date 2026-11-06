export const PROMPT_VERSION = 'food-v1';
export const NUTRIENTS = ['calories', 'protein', 'carbs', 'fat', 'fiber', 'sugar', 'sodium'];
export const TYPES = ['Reggeli', 'Ebéd', 'Vacsora', 'Kisétkezés'];
export class AppError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
export function check(condition, message, status = 400) {
  if (!condition) throw new AppError(message, status);
}
export function text(value, max = 160, allowEmpty = false) {
  check(typeof value === 'string' && value.trim().length <= max && (allowEmpty || value.trim().length), 'Hiányzó vagy túl hosszú szöveges mező.');
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
export function validateAnalysis(value) {
  check(value && typeof value === 'object', 'Az elemzés formátuma hibás.');
  check(['low', 'medium', 'high'].includes(value.confidence), 'Hiányzó bizonyossági szint.');
  check(Array.isArray(value.ingredients) && value.ingredients.length > 0 && value.ingredients.length <= 40, '1–40 összetevő adható meg.');
  const ingredients = value.ingredients.map(item => {
    check(item && typeof item === 'object', 'Hibás összetevő.');
    check(typeof item.grams === 'number' && Number.isFinite(item.grams) && item.grams > 0 && item.grams <= 5000, 'Az adag tömege 0 és 5000 g között lehet.');
    const result = { name: text(item.name), grams: item.grams };
    for (const nutrient of NUTRIENTS) {
      const amount = item[nutrient];
      if (['fiber', 'sugar', 'sodium'].includes(nutrient) && amount === null) { result[nutrient] = null; continue; }
      const max = nutrient === 'calories' ? 1000 : nutrient === 'sodium' ? 100000 : 100;
      check(typeof amount === 'number' && Number.isFinite(amount) && amount >= 0 && amount <= max, `Hibás ${nutrient} érték (100 g-ra).`);
      result[nutrient] = amount;
    }
    return result;
  });
  return { name: text(value.name), confidence: value.confidence, assumptions: text(value.assumptions ?? '', 3000, true), ingredients };
}
export function totals(ingredients) {
  return Object.fromEntries(NUTRIENTS.map(key => [key, ingredients.some(item => item[key] === null) ? null : Math.round(ingredients.reduce((sum, item) => sum + item[key] * item.grams / 100, 0) * 10) / 10]));
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
