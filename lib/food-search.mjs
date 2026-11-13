import { check } from './domain.mjs';
import { FOOD_REFERENCE } from './food-reference.mjs';
import { REFERENCE_STATES } from './hungarian-food.mjs';
import { foodApiClient } from './food-api-cache.mjs';
import { foodTokens, usdaFood, cnfFood, swedishFood, norwegianFood } from './free-food-data.mjs';

const CNF = 'https://food-nutrition.canada.ca/api/canadian-nutrient-file/';
const SLV = 'https://dataportal.livsmedelsverket.se/livsmedel/api/v1/';
const state = description => /\b(raw|uncooked)\b/i.test(description) ? 'raw' : /\b(cooked|boiled|baked|roasted|fried|grilled|steamed|stewed)\b/i.test(description) ? 'prepared' : 'as_sold';
const array = value => Array.isArray(value) ? value.filter(row => row && typeof row === 'object') : [];
const providers = env => new Set(env.FREE_FOOD_APIS === '0' ? [] : (env.FREE_FOOD_SOURCES || 'usda,cnf,slv,matvare,off').split(',').map(s => s.trim()));
const labels = { local: 'USDA · helyi', usda: 'USDA FoodData Central', cnf: 'Health Canada CNF', slv: 'Swedish Food Agency', matvare: 'Norwegian Food Composition Table' };

function candidate(provider, id, description, foodState) {
  if (typeof description !== 'string' || !description.trim() || description.length > 180) return null;
  if (provider === 'local' ? !Object.hasOwn(FOOD_REFERENCE, id) : !(provider === 'matvare' ? /^\d{1,3}\.\d{1,6}$/ : /^\d{1,9}$/).test(String(id))) return null;
  return { provider, id: String(id), description, source: labels[provider], foodState: foodState || state(description), quantityUnit: 'g' };
}
function rank(rows, query) {
  const target = foodTokens(query).split(' ').filter(Boolean);
  if (!target.length) return [];
  return rows.filter(Boolean).map(row => {
    const words = foodTokens(row.description).split(' ');
    const matched = target.filter(word => words.some(w => w === word || word.length >= 4 && w.startsWith(word))).length;
    return { row, score: matched === target.length ? 1 + matched / Math.max(words.length, 1) : 0 };
  }).filter(result => result.score > 0).sort((a, b) => b.score - a.score || a.row.description.localeCompare(b.row.description)).map(result => result.row);
}

// These are choices for a human, not automatic identity matches. No nutrition is
// applied until the user selects a result and the server validates its full record.
export async function searchFoodSources(query, env, fetcher = fetch, db) {
  check(typeof query === 'string' && query.trim().length >= 3 && query.length <= 100, 'A kereséshez 3–100 karakter hosszú ételnevet adj meg.');
  const enabled = providers(env), client = foodApiClient(env, fetcher, db);
  const local = Object.entries(FOOD_REFERENCE).map(([id, food]) => candidate('local', id, food.description, REFERENCE_STATES[id]));
  const localNames = rank(Object.entries(FOOD_REFERENCE).map(([id, food]) => candidate('local', id, food.label, REFERENCE_STATES[id])), query).map(food => candidate('local', food.id, FOOD_REFERENCE[food.id].description, food.foodState));
  const work = [];
  if (enabled.has('usda') && env.USDA_API_KEY) work.push((async () => {
    const data = await client.get('usda', `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${encodeURIComponent(env.USDA_API_KEY)}`, { body: { query: query.trim(), dataType: ['Foundation', 'SR Legacy', 'Survey (FNDDS)'], pageSize: 15 } });
    return array(data?.foods).map(food => candidate('usda', food.fdcId, food.description));
  })());
  if (enabled.has('cnf')) work.push((async () => {
    const data = await client.get('cnf', `${CNF}food/?lang=en&type=json`, { ttl: 7 * 86400_000 });
    return rank(array(data).map(food => candidate('cnf', food.food_code, food.food_description)), query).slice(0, 5);
  })());
  if (enabled.has('slv')) work.push((async () => {
    const data = await client.get('slv', `${SLV}livsmedel?offset=0&limit=5000&sprak=2`, { ttl: 7 * 86400_000 });
    return rank(array(data?.livsmedel).map(food => candidate('slv', food.nummer, food.namn)), query).slice(0, 5);
  })());
  if (enabled.has('matvare')) work.push((async () => {
    const data = await client.get('matvare', 'https://www.matvaretabellen.no/api/en/foods.json', { ttl: 7 * 86400_000 });
    return rank(array(data?.foods).map(food => candidate('matvare', food.foodId, food.foodName)), query).slice(0, 5);
  })());
  const results = await Promise.allSettled(work);
  const all = [...rank(local, query), ...localNames, ...results.flatMap(result => result.status === 'fulfilled' ? result.value.slice(0, 5) : [])].filter(Boolean);
  const seen = new Set();
  const perSource = new Map();
  return { foods: all.filter(food => { const key = food.provider + '/' + food.id, count = perSource.get(food.provider) || 0; if (seen.has(key) || count >= 5) return false; seen.add(key); perSource.set(food.provider, count + 1); return true; }).slice(0, 25), sources: client.stats.sources };
}

export async function resolveFoodSource(provider, id, env, fetcher = fetch, db) {
  check(Object.hasOwn(labels, provider) && typeof id === 'string', 'Ismeretlen adatbázisforrás.');
  if (provider === 'local') {
    check(Object.hasOwn(FOOD_REFERENCE, id), 'Ismeretlen adatbázisforrás.');
    return { key: id, record: FOOD_REFERENCE[id] };
  }
  check(providers(env).has(provider), 'Ez az adatforrás most ki van kapcsolva.', 503);
  check(provider === 'matvare' ? /^\d{1,3}\.\d{1,6}$/.test(id) : /^\d{1,9}$/.test(id), 'Érvénytelen adatbázis-azonosító.');
  const client = foodApiClient(env, fetcher, db); let found = null;
  if (provider === 'usda') {
    check(env.USDA_API_KEY, 'Az USDA-kereséshez szükséges kulcs nincs beállítva.', 503);
    const food = await client.get('usda', `https://api.nal.usda.gov/fdc/v1/food/${id}?api_key=${encodeURIComponent(env.USDA_API_KEY)}`);
    if (String(food?.fdcId) === id) found = usdaFood(food);
  } else if (provider === 'cnf') {
    const foods = await client.get('cnf', `${CNF}food/?lang=en&type=json`, { ttl: 7 * 86400_000 });
    const food = array(foods).find(food => String(food.food_code) === id);
    if (food) {
      const [values, portions] = await Promise.all([client.get('cnf', `${CNF}nutrientamount/?id=${id}&lang=en&type=json`), client.get('cnf', `${CNF}servingsize/?id=${id}&lang=en&type=json`)]);
      found = cnfFood(food, values, portions);
    }
  } else if (provider === 'slv') {
    const page = await client.get('slv', `${SLV}livsmedel?offset=0&limit=5000&sprak=2`, { ttl: 7 * 86400_000 });
    const food = array(page?.livsmedel).find(food => String(food.nummer) === id);
    if (food) found = swedishFood(food, await client.get('slv', `${SLV}livsmedel/${id}/naringsvarden?sprak=2`));
  } else {
    const data = await client.get('matvare', 'https://www.matvaretabellen.no/api/en/foods.json', { ttl: 7 * 86400_000 });
    found = norwegianFood(array(data?.foods).find(food => food.foodId === id));
  }
  check(found && found.record.sourceId === id, 'A kiválasztott adat hiányos vagy most nem érhető el. Válassz másik találatot.', 422);
  if (db) await db.prepare('INSERT INTO food_records(fdc_id,record,retrieved_at) VALUES(?,?,?) ON CONFLICT(fdc_id) DO NOTHING').bind(found.key, JSON.stringify(found.record), new Date().toISOString()).run();
  return found;
}
