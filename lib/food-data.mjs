import { createHash } from 'node:crypto';
import { check, validateAnalysis } from './domain.mjs';
import { FOOD_REFERENCE } from './food-reference.mjs';

async function usda(path, env, fetcher, body) {
  check(env.USDA_API_KEY, 'Az USDA-adatbázisban való keresés még nincs beállítva. A hozzáférést az alkalmazás üzemeltetője tudja megadni.', 503);
  let response;
  try { response = await fetcher(`https://api.nal.usda.gov/fdc/v1/${path}?api_key=${encodeURIComponent(env.USDA_API_KEY)}`, { method: body ? 'POST' : 'GET', redirect: 'error', headers: body ? { 'Content-Type': 'application/json' } : {}, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(15000) }); }
  catch { check(false, 'Az USDA-adatbázis most nem érhető el.', 502); }
  check(response.ok, 'Az USDA-keresés nem sikerült vagy elérte a szolgáltató korlátját.', 502);
  return response.json();
}
export async function searchFoods(query, env, fetcher = fetch) {
  check(typeof query === 'string' && query.trim().length >= 3 && query.length <= 100, 'A kereséshez 3–100 karakter hosszú ételnevet adj meg.');
  const result = await usda('foods/search', env, fetcher, { query: query.trim(), dataType: ['Foundation', 'SR Legacy'], pageSize: 15, pageNumber: 1 });
  check(Array.isArray(result.foods), 'Az USDA-adatbázis nem adott feldolgozható választ. Próbáld újra később.', 502);
  return result.foods.filter(food => Number.isInteger(food.fdcId) && typeof food.description === 'string').map(food => ({ id: food.fdcId, description: food.description, dataType: food.dataType }));
}
export function foodRecord(food) {
  check(Number.isInteger(food?.fdcId) && ['Foundation', 'SR Legacy'].includes(food.dataType) && typeof food.description === 'string' && Array.isArray(food.foodNutrients), 'A kiválasztott USDA-adat hiányos, vagy ebben a formában nem használható. Válassz másik találatot.', 502);
  const amount = (id, unit) => {
    const entry = food.foodNutrients.find(item => item.nutrient?.id === id);
    return entry && entry.nutrient.unitName?.toLowerCase() === unit && Number.isFinite(entry.amount) ? entry.amount : null;
  };
  const fiber = amount(1079, 'g'), carbohydrate = amount(1005, 'g');
  check(fiber !== null && carbohydrate !== null, 'Ennél az ételnél nincs elegendő adat a szénhidráttartalom kiszámításához. Válassz másik találatot.', 422);
  check(carbohydrate >= fiber, 'A kiválasztott USDA-rekord rosttartalma meghaladja az összes szénhidrátot. Válassz másik találatot.', 422);
  const nutrients = { calories: amount(2048, 'kcal') ?? amount(1008, 'kcal') ?? amount(2047, 'kcal'), protein: amount(1003, 'g'), carbs: Math.round((carbohydrate - fiber) * 1000) / 1000, fat: amount(1004, 'g'), fiber, sugar: amount(2000, 'g'), sodium: amount(1093, 'mg'), saturatedFat: amount(1258, 'g') };
  validateAnalysis({ name: 'USDA', confidence: 'medium', ingredients: [{ name: food.description, grams: 100, ...nutrients }] });
  const record = { label: food.description, description: food.description, fdcId: food.fdcId, dataType: food.dataType, publishedAt: food.publicationDate || null, retrievedAt: new Date().toISOString().slice(0, 10), url: `https://fdc.nal.usda.gov/food-details/${food.fdcId}/nutrients`, nutrients };
  const key = `fdc-${food.fdcId}-${createHash('sha256').update(JSON.stringify(record)).digest('hex').slice(0, 16)}`;
  return { key, record };
}
export async function fetchFood(id, db, env, fetcher = fetch) {
  check(/^\d{1,9}$/.test(id), 'Érvénytelen USDA-azonosító.');
  const cached = await db.prepare('SELECT fdc_id,record FROM food_records WHERE fdc_id LIKE ? AND retrieved_at>? ORDER BY retrieved_at DESC LIMIT 1').bind(`fdc-${id}-%`, new Date(Date.now() - 86400_000).toISOString()).first();
  if (cached) return { key: cached.fdc_id, record: JSON.parse(cached.record) };
  const { key, record } = foodRecord(await usda(`food/${id}`, env, fetcher));
  check(String(record.fdcId) === id, 'Az USDA-adatbázis a kért étel helyett másik étel adatait küldte vissza. Próbáld újra a keresést.', 502);
  await db.prepare('INSERT INTO food_records(fdc_id,record,retrieved_at) VALUES(?,?,?) ON CONFLICT(fdc_id) DO NOTHING').bind(key, JSON.stringify(record), new Date().toISOString()).run();
  return { key, record };
}
export async function analysisReferences(analysis, db) {
  check(Array.isArray(analysis?.ingredients) && analysis.ingredients.length > 0 && analysis.ingredients.length <= 40 && analysis.ingredients.every(item => item && typeof item === 'object'), 'Hiányzó vagy hibás összetevők.');
  const references = { ...FOOD_REFERENCE };
  if (analysis.recipe != null) check(Array.isArray(analysis.recipe?.ingredients) && analysis.recipe.ingredients.length > 0 && analysis.recipe.ingredients.length <= 40 && analysis.recipe.ingredients.every(item => item && typeof item === 'object'), 'A recept összetevőinek adatai hibásak.');
  for (const key of new Set([...analysis.ingredients, ...(analysis.recipe?.ingredients || [])].map(item => item.referenceKey).filter(Boolean))) {
    check(typeof key === 'string', 'Hibás tápértékforrás.');
    if (Object.hasOwn(references, key)) continue;
    check(/^fdc-\d{1,9}-[a-f0-9]{16}$/.test(key), 'Ismeretlen tápértékforrás.');
    const saved = await db.prepare('SELECT record FROM food_records WHERE fdc_id=?').bind(key).first();
    check(saved, 'A tápértékforrás nincs ellenőrizve az adatbázisban.'); references[key] = JSON.parse(saved.record);
  }
  return references;
}
