import { createHash } from 'node:crypto';
import { validateAnalysis } from './domain.mjs';
import { FOOD_REFERENCE } from './food-reference.mjs';
import { REFERENCE_STATES } from './hungarian-food.mjs';
import { normalizeLabel, labelNutrients } from './product-label.mjs';
import { foodApiClient } from './food-api-cache.mjs';

export const EXTERNAL_REFERENCE = /^ext-(usda|cnf|slv|matvare|off)-[a-zA-Z0-9.]{1,30}-[a-f0-9]{16}$/;
const CNF = 'https://food-nutrition.canada.ca/api/canadian-nutrient-file/';
const SLV = 'https://dataportal.livsmedelsverket.se/livsmedel/api/v1/';
const finite = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
const rows = value => Array.isArray(value) ? value.filter(row => row && typeof row === 'object' && !Array.isArray(row)) : [];
const round = number => Math.round(number * 1e6) / 1e6;
const text = value => typeof value === 'string' && value.trim().length <= 180 ? value.trim() : '';
const singular = word => word.endsWith('ies') ? word.slice(0, -3) + 'y' : word.endsWith('s') && !word.endsWith('ss') ? word.slice(0, -1) : word;
export const foodTokens = value => text(value).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\buncooked\b/g, 'raw').match(/[a-z0-9]+/g)?.map(singular).filter(word => !['the', 'of', 'a', 'an'].includes(word)).sort().join(' ') || '';
const stateOf = description => /\b(raw|uncooked)\b/i.test(description) ? 'raw' : /\b(cooked|boiled|baked|roasted|fried|grilled|steamed|stewed)\b/i.test(description) ? 'prepared' : 'as_sold';

// Exact normalized descriptions only. A fuzzy near-match is not an automatic nutrient source.
export function exactFood(rows, query, description) {
  if (!Array.isArray(rows) || !foodTokens(query)) return null;
  const matches = rows.filter(row => row && typeof row === 'object' && foodTokens(description(row)) === foodTokens(query));
  return matches.length === 1 ? matches[0] : null;
}
function record(source, id, description, nutrients, portions = [], extra = {}) {
  if (!/^[a-zA-Z0-9.]{1,30}$/.test(String(id)) || !text(description)) return null;
  try { validateAnalysis({ name: 'Reference', confidence: 'medium', ingredients: [{ name: description, grams: 100, quantityUnit: extra.quantityUnit || 'g', ...nutrients }] }); } catch { return null; }
  const references = {
    usda: ['USDA FoodData Central', 'CC0', `https://fdc.nal.usda.gov/food-details/${id}/nutrients`],
    cnf: ['Canadian Nutrient File, Health Canada (legacy API; version not asserted)', 'Health Canada CNF reuse terms', 'https://food-nutrition.canada.ca/cnf-fce/'],
    slv: ['Swedish Food Agency', 'CC BY 4.0', 'https://www.livsmedelsverket.se/en/food-and-content/naringsamne/livsmedelsdatabasen'],
    matvare: ['Norwegian Food Composition Table', 'CC BY 4.0', 'https://www.matvaretabellen.no/'],
    off: ['Open Food Facts', 'ODbL-1.0', `https://world.openfoodfacts.org/product/${id}`],
  };
  const [attribution, license, url] = references[source];
  const data = { label: description, description, source, sourceId: String(id), attribution, license, url,
    retrievedAt: new Date().toISOString().slice(0, 10), quantityUnit: 'g', foodState: stateOf(description),
    nutrients, portions: portions.filter(p => text(p.description) && finite(p.grams) !== null && p.grams > 0 && p.grams <= 5000).slice(0, 60), ...extra };
  return { key: `ext-${source}-${id}-${createHash('sha256').update(JSON.stringify(data)).digest('hex').slice(0, 16)}`, record: data };
}
const availableCarbs = (total, fiber) => total !== null && fiber !== null && total >= fiber ? round(total - fiber) : null;

export function usdaFood(food) {
  if (!['Foundation', 'SR Legacy', 'Survey (FNDDS)'].includes(food?.dataType) || !Array.isArray(food.foodNutrients)) return null;
  const amount = (id, unit) => {
    const n = food.foodNutrients.find(n => n?.nutrient?.id === id && typeof n.nutrient.unitName === 'string' && n.nutrient.unitName.toLowerCase() === unit);
    return finite(n?.amount);
  };
  const fiber = amount(1079, 'g');
  return record('usda', food.fdcId, food.description, {
    calories: amount(2048, 'kcal') ?? amount(1008, 'kcal') ?? amount(2047, 'kcal'), protein: amount(1003, 'g'),
    carbs: availableCarbs(amount(1005, 'g'), fiber), fat: amount(1004, 'g'), fiber,
    sugar: amount(2000, 'g'), sodium: amount(1093, 'mg'), saturatedFat: amount(1258, 'g'),
  }, rows(food.foodPortions).map(p => ({ description: p.portionDescription || p.modifier || '', grams: finite(p.gramWeight), amount: finite(p.amount) || 1 })), { dataType: food.dataType, publishedAt: food.publicationDate || null });
}
export function cnfFood(food, values, portions = []) {
  if (!food || !Array.isArray(values) || values.some(n => !n || n.food_code !== food.food_code)) return null;
  const amount = id => finite(values.find(n => n?.nutrient_name_id === id)?.nutrient_value);
  const fiber = amount(291);
  return record('cnf', food.food_code, food.food_description, {
    calories: amount(208), protein: amount(203), carbs: availableCarbs(amount(205), fiber), fat: amount(204), fiber,
    sugar: amount(269), sodium: amount(307), saturatedFat: amount(606),
  }, rows(portions).filter(p => p.food_code === food.food_code).map(p => ({ description: p.measure_name, grams: finite(p.conversion_factor_value) === null ? null : round(p.conversion_factor_value * 100), amount: 1 })));
}
export function swedishFood(food, values) {
  if (!food || !Array.isArray(values)) return null;
  const amount = (code, unit) => {
    const n = values.find(n => n?.euroFIRkod === code && typeof n.enhet === 'string' && n.enhet.toLowerCase() === unit && n.viktGram === 100 && n.matrisenhetkod === 'W' && !['BL', 'TR', 'LT', 'GT'].includes(n.vardetypkod));
    return finite(n?.varde);
  };
  return record('slv', food.nummer, food.namn, {
    calories: amount('ENERC', 'kcal'), protein: amount('PROT', 'g'), carbs: amount('CHO', 'g'), fat: amount('FAT', 'g'),
    fiber: amount('FIBT', 'g'), sugar: amount('SUGAR', 'g'), sodium: amount('NA', 'mg'), saturatedFat: amount('FASAT', 'g'),
  }, [], { publishedAt: food.version || null });
}
export function norwegianFood(food) {
  if (!food || !Array.isArray(food.constituents)) return null;
  const amount = (id, unit) => finite(food.constituents.find(n => n?.nutrientId === id && n.unit === unit)?.quantity);
  return record('matvare', food.foodId, food.foodName, {
    calories: food.calories?.unit === 'kcal' ? finite(food.calories.quantity) : null,
    protein: amount('Protein', 'g'), carbs: amount('Karbo', 'g'), fat: amount('Fett', 'g'), fiber: amount('Fiber', 'g'),
    sugar: amount('Mono+Di', 'g'), sodium: amount('Na', 'mg'), saturatedFat: amount('Mettet', 'g'),
  }, rows(food.portions).filter(p => p.unit === 'g').map(p => ({ description: p.portionName, grams: finite(p.quantity), amount: 1 })), { ediblePercent: finite(food.ediblePart?.percent) });
}
export function openFoodFactsProduct(product, label, unit, state) {
  if (!label?.barcodeValid || String(product?.code) !== label.barcode || label.carbsIncludeFiber === null || state !== 'as_sold' || product.data_quality_errors_tags?.length) return null;
  const set = product.nutrition?.aggregated_set;
  if (!set || set.preparation !== 'as_sold' || !['100g', '100ml'].includes(set.per) || set.per !== `100${unit}`) return null;
  const amount = (key, expectedUnit) => {
    const n = set.nutrients?.[key];
    return n?.unit === expectedUnit && !n.modifier && ['packaging', 'manufacturer'].includes(n.source) ? finite(n.value) : null;
  };
  const fiber = amount('fiber', 'g'), totalCarbs = amount('carbohydrates', 'g');
  const sodium = amount('sodium', 'g'), salt = amount('salt', 'g');
  if (sodium !== null && salt !== null && Math.abs(sodium * 1000 - salt * 400) > Math.max(10, sodium * 1000 * .05)) return null;
  const found = record('off', label.barcode, product.product_name, {
    calories: amount('energy-kcal', 'kcal') ?? (amount('energy-kj', 'kJ') === null ? null : round(amount('energy-kj', 'kJ') / 4.184)),
    protein: amount('proteins', 'g'), carbs: label.carbsIncludeFiber ? availableCarbs(totalCarbs, fiber) : totalCarbs,
    fat: amount('fat', 'g'), fiber, sugar: amount('sugars', 'g'), sodium: sodium === null ? salt === null ? null : round(salt * 400) : round(sodium * 1000), saturatedFat: amount('saturated-fat', 'g'),
  }, [], { quantityUnit: unit, foodState: 'as_sold' });
  // A partial visible label can still contradict an older community record.
  if (found && label.basisAmount && label.basisUnit === unit && label.prepared === false) {
    for (const key of ['calories', 'protein', 'carbs', 'fat', 'fiber', 'sugar', 'sodium', 'saturatedFat']) {
      let observed = finite(label.nutrients[key]);
      if (key === 'carbs' && label.carbsIncludeFiber) observed = availableCarbs(observed, finite(label.nutrients.fiber));
      if (observed === null || found.record.nutrients[key] === null) continue;
      observed *= 100 / label.basisAmount;
      const tolerance = key === 'calories' ? 5 : key === 'sodium' ? 10 : .5;
      if (Math.abs(observed - found.record.nutrients[key]) > Math.max(tolerance, observed * .05)) return null;
    }
  }
  return found;
}

function localFood(item) {
  if (item.quantityUnit !== 'g' || item.productLabel) return null;
  const key = Object.keys(FOOD_REFERENCE).find(key => REFERENCE_STATES[key] === item.foodState && [FOOD_REFERENCE[key].description, FOOD_REFERENCE[key].label].some(name => foodTokens(name) === foodTokens(item.lookupQuery || item.name)));
  return key ? { key, record: FOOD_REFERENCE[key] } : null;
}
function matchingState(found, item) { return found && found.record.quantityUnit === item.quantityUnit && found.record.foodState === item.foodState ? found : null; }
const safeQuery = item => text(item.lookupQuery) && /^[\p{L}\p{N} ,.'()/%+-]+$/u.test(item.lookupQuery) ? item.lookupQuery.trim() : '';

export async function enrichFoodData(raw, env, fetcher, { db, context = {} } = {}) {
  const references = { ...FOOD_REFERENCE }, matches = new Map(), evidence = [];
  if (env.FREE_FOOD_APIS === '0') return { references, matches, evidence, usage: { state: 'disabled', requests: 0 } };
  const client = foodApiClient(env, fetcher, db), enabled = new Set((env.FREE_FOOD_SOURCES || 'usda,cnf,slv,matvare,off').split(',').map(s => s.trim()));
  async function lookup(item) {
    const label = item.productLabel ? normalizeLabel(item.productLabel) : null;
    if (label) {
      // An original readable label wins. Never replace it with community data.
      if (labelNutrients(label)) return null;
      if (!enabled.has('off') || !label.barcodeValid) return null;
      const payload = await client.get('off', `https://world.openfoodfacts.org/api/v3.6/product/${label.barcode}.json?fields=code,product_name,nutrition,data_quality_errors_tags`);
      return openFoodFactsProduct(payload?.product, label, item.quantityUnit, item.foodState);
    }
    const local = localFood(item);
    if (local) return local;
    if (item.referenceKey && FOOD_REFERENCE[item.referenceKey] && REFERENCE_STATES[item.referenceKey] === item.foodState && item.quantityUnit === 'g') return null;
    const query = safeQuery(item);
    if (!query || item.quantityUnit !== 'g' || !['raw', 'prepared', 'as_sold'].includes(item.foodState)) return null;
    if (enabled.has('usda') && env.USDA_API_KEY) {
      const root = 'https://api.nal.usda.gov/fdc/v1/';
      const key = `api_key=${encodeURIComponent(env.USDA_API_KEY)}`;
      const result = await client.get('usda', `${root}foods/search?${key}`, { body: { query, dataType: ['Foundation', 'SR Legacy', 'Survey (FNDDS)'], pageSize: 15 } });
      const food = exactFood(result?.foods, query, f => f.description);
      if (Number.isSafeInteger(food?.fdcId)) {
        const detail = await client.get('usda', `${root}food/${food.fdcId}?${key}`);
        const found = detail?.fdcId === food.fdcId && foodTokens(detail.description) === foodTokens(query) ? matchingState(usdaFood(detail), item) : null;
        if (found) return found;
      }
    }
    if (enabled.has('cnf') && client.available()) {
      const foods = await client.get('cnf', `${CNF}food/?lang=en&type=json`, { ttl: 7 * 86400_000 });
      const food = exactFood(foods, query, f => f.food_description);
      if (Number.isSafeInteger(food?.food_code) && stateOf(food.food_description) === item.foodState) {
        const id = food.food_code;
        const values = await client.get('cnf', `${CNF}nutrientamount/?id=${id}&lang=en&type=json`);
        const portions = await client.get('cnf', `${CNF}servingsize/?id=${id}&lang=en&type=json`);
        const found = matchingState(cnfFood(food, values, portions), item);
        if (found) return found;
      }
    }
    if (enabled.has('slv') && client.available()) {
      const page = await client.get('slv', `${SLV}livsmedel?offset=0&limit=5000&sprak=2`, { ttl: 7 * 86400_000 });
      const food = Array.isArray(page?.livsmedel) && page._meta?.totalRecords === page.livsmedel.length ? exactFood(page.livsmedel, query, f => f.namn) : null;
      if (Number.isSafeInteger(food?.nummer) && stateOf(food.namn) === item.foodState) {
        const found = matchingState(swedishFood(food, await client.get('slv', `${SLV}livsmedel/${food.nummer}/naringsvarden?sprak=2`)), item);
        if (found) return found;
      }
    }
    if (enabled.has('matvare') && client.available()) {
      const data = await client.get('matvare', 'https://www.matvaretabellen.no/api/en/foods.json', { ttl: 7 * 86400_000 });
      return matchingState(norwegianFood(exactFood(data?.foods, query, f => f.foodName)), item);
    }
    return null;
  }
  for (const [index, item] of (raw.ingredients || []).entries()) {
    if (index >= 12) { evidence.push({ index, state: 'item_limit' }); continue; }
    const found = await lookup(item);
    if (!found) { evidence.push({ index, state: 'no_verified_match' }); continue; }
    const uncertain = item.identityUncertain === true || item.alternatives?.length > 0;
    // Nutrient composition can be sourced for the primary food hypothesis even
    // when its visual identity is uncertain. This is not identity verification.
    evidence.push({ index, state: uncertain ? 'provisional_identity' : 'matched', source: found.record.source || 'local', key: found.key });
    if (uncertain) raw.confidence = 'low';
    references[found.key] = found.record;
    matches.set(index, found);
    if (db && EXTERNAL_REFERENCE.test(found.key)) {
      const sql = found.record.source === 'off'
        ? 'INSERT INTO off_product_records(record_key,record,retrieved_at) VALUES(?,?,?) ON CONFLICT(record_key) DO NOTHING'
        : 'INSERT INTO food_records(fdc_id,record,retrieved_at) VALUES(?,?,?) ON CONFLICT(fdc_id) DO NOTHING';
      await db.prepare(sql).bind(found.key, JSON.stringify(found.record), new Date().toISOString()).run();
    }
    const portion = portionFromRecord(item.portion, found.record.portions);
    if (portion && !context.totalWeightG && !item.productLabel) {
      const ratio = portion / item.grams;
      if (Number.isFinite(ratio) && ratio > 0 && item.gramsMin >= 0 && item.gramsMax * ratio <= 5000) {
        item.grams = portion; item.gramsMin = Math.min(portion, round(item.gramsMin * ratio)); item.gramsMax = Math.max(portion, round(item.gramsMax * ratio));
        item.portionNote = context.language === 'en' ? 'Visible count converted using a reference portion; actual size remains estimated.' : 'A látható darabszámot adatbázisbeli adaggal váltottuk át; a tényleges méret továbbra is becslés.';
        evidence.at(-1).portionGrams = portion;
      }
    }
  }
  return { references, matches, evidence, usage: { state: 'enabled', ...client.stats, matched: matches.size, evidence } };
}
export function portionFromRecord(portion, portions) {
  if (!portion || portion.visibleCount !== true || !Number.isFinite(portion.count) || portion.count <= 0 || portion.count > 50 || !text(portion.measure) || !Array.isArray(portions)) return null;
  const target = foodTokens(portion.measure);
  const match = portions.filter(p => foodTokens(p.description) === target && finite(p.grams) !== null && p.grams > 0 && finite(p.amount ?? 1) > 0);
  if (match.length !== 1) return null;
  const grams = round(match[0].grams * portion.count / (match[0].amount || 1));
  return grams > 0 && grams <= 5000 ? grams : null;
}
