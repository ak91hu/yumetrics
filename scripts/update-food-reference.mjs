import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { FOOD_REFERENCE } from '../lib/food-reference.mjs';
import { REFERENCE_STATES } from '../lib/hungarian-food.mjs';
import { foodRecord } from '../lib/food-data.mjs';

// Fixed SR Legacy records: updates are explicit, never silently substituted at runtime.
const foods = [
  [173904, 'Zabpehely, száraz'], [171705, 'Avokádó, nyers'], [172183, 'Tojásfehérje, nyers'],
  [169756, 'Fehér rizs, száraz'], [168878, 'Fehér rizs, főtt'], [171477, 'Csirkemell, bőr nélkül, sütve'],
  [171413, 'Olívaolaj'], [170567, 'Mandula'], [168462, 'Spenót, nyers'], [170457, 'Paradicsom, nyers'],
  [169910, 'Mangó, nyers'], [173418, 'Krémsajt'], [170903, 'Görög joghurt, natúr, csökkentett zsírtartalmú'],
  [172688, 'Teljes kiőrlésű kenyér'], [173424, 'Egész tojás, keményre főtt'], [173944, 'Banán, nyers'],
  [170440, 'Burgonya, héj nélkül főzve, só nélkül'], [172421, 'Lencse, főtt, só nélkül'],
  [169967, 'Brokkoli, főtt, lecsöpögtetve, só nélkül'], [175168, 'Atlanti lazac, tenyésztett, sütve'],
  [167843, 'Sertéslapocka, hús és zsír, nyers', 'Lapocka, nem csülök; bőrös/csontos húsra nem automatikus helyettesítő.'],
  [167844, 'Sertéslapocka, hús és zsír, sütve', 'Sült lapocka, nem pörkölt vagy csülök. A szaftot és köretet külön kezeld.'],
  [171257, 'Tejföl jellegű savanyított tejszín, USDA', 'USDA sour cream; nem igazoltan azonos egy magyar 12%-os vagy 20%-os tejföllel. Pontos termékhez címkeérték kell.'],
  [169761, 'Fehér búzaliszt, általános, száraz', 'A liszt alapanyag, nem kész rántás, panír vagy nokedli.'],
  [171025, 'Napraforgóolaj, kb. 65% linolsav', 'Az ételben maradt olajat számold, ne a sütőedénybe öntött teljes mennyiséget.'],
  [171401, 'Sertészsír'],
  [170000, 'Vöröshagyma, nyers'], [170001, 'Vöröshagyma, főtt, lecsöpögtetve, só nélkül', 'Főtt hagyma, nem olajban pirított.'],
  [169975, 'Fejes káposzta, nyers'], [169976, 'Fejes káposzta, főtt, lecsöpögtetve, só nélkül'],
  [171329, 'Fűszerpaprika, őrölt, USDA-referencia'], [171287, 'Egész tojás, nyers'],
  [170026, 'Burgonya héjjal, nyers', 'A héjat is tartalmazó referencia; a nem elfogyasztott részt ne számold bele.'],
  [169755, 'Tojásos tészta, száraz, nem dúsított'], [168926, 'Tojásos tészta, főtt, hozzáadott só nélkül', 'Nem azonos egy ismeretlen receptű házi nokedlivel.'],
  [170420, 'Zöldborsó, főtt, lecsöpögtetve, só nélkül', 'Önmagában a borsó; a főzelék rántását/habarását és feltétjét nem tartalmazza.'],
  [173744, 'Vörös vesebab, száraz'], [175194, 'Vörös vesebab, főtt, só nélkül'],
  [169279, 'Savanyú káposzta, konzerv, lével', 'Konzerv és levének adata, nem lecsöpögtetett vagy frissen erjesztett káposzta.'],
  [173430, 'Vaj, sótlan'], [169655, 'Kristálycukor'], [173647, 'Ivóvíz, csapvíz, USDA-referencia'],
  [169230, 'Fokhagyma, nyers'], [174928, 'Zsemlemorzsa, száraz, fűszerezetlen', 'Száraz alapanyag, nem kész, olajat felszívott panír.'],
];
let payload;
const localFile = process.argv[2];
if (localFile) {
  const data = JSON.parse(readFileSync(localFile, 'utf8')); payload = Array.isArray(data) ? data : data.SRLegacyFoods;
} else {
  const response = await fetch('https://api.nal.usda.gov/fdc/v1/foods?api_key=DEMO_KEY', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(30_000),
    body: JSON.stringify({ fdcIds: foods.map(([id]) => id), format: 'full' }),
  });
  assert.ok(response.ok, `USDA request failed: ${response.status}`); payload = await response.json();
}
assert.ok(Array.isArray(payload));
assert.equal(new Set(foods.map(([id]) => id)).size, foods.length);
const reference = Object.fromEntries(foods.map(([id, label, matchNotes]) => {
  const key = `fdc-${id}`;
  assert.ok(REFERENCE_STATES[key], `Missing preparation metadata: ${id}`);
  // Published snapshots are immutable: extending the catalogue must not rewrite old diary provenance.
  if (FOOD_REFERENCE[key]) return [key, FOOD_REFERENCE[key]];
  const food = payload.find(item => item.fdcId === id); assert.equal(food?.dataType, 'SR Legacy');
  const { record } = foodRecord(food);
  return [key, { ...record, label, ...(matchNotes ? { matchNotes } : {}), ...(localFile ? { sourceDownload: 'https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_json_2018-04.zip' } : {}) }];
}));
writeFileSync(new URL('../lib/food-reference.mjs', import.meta.url), `// USDA FoodData Central, CC0. Regenerate with node scripts/update-food-reference.mjs.\nexport const FOOD_REFERENCE = ${JSON.stringify(reference, null, 2)};\n`);
console.log(`${foods.length} USDA records saved, with provenance and per-100g nutrient values.`);
