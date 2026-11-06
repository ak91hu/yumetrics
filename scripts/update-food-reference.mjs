import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';

// Fixed SR Legacy records: updates are explicit, never silently substituted at runtime.
const foods = [
  [173904, 'Zabpehely, száraz'], [171705, 'Avokádó, nyers'], [172183, 'Tojásfehérje, nyers'],
  [169756, 'Fehér rizs, száraz'], [168878, 'Fehér rizs, főtt'], [171477, 'Csirkemell, bőr nélkül, sütve'],
  [171413, 'Olívaolaj'], [170567, 'Mandula'], [168462, 'Spenót, nyers'], [170457, 'Paradicsom, nyers'],
  [169910, 'Mangó, nyers'], [173418, 'Krémsajt'], [170903, 'Görög joghurt, natúr, csökkentett zsírtartalmú'],
  [172688, 'Teljes kiőrlésű kenyér'], [173424, 'Egész tojás, keményre főtt'], [173944, 'Banán, nyers'],
  [170440, 'Burgonya, héj nélkül főzve, só nélkül'], [172421, 'Lencse, főtt, só nélkül'],
  [169967, 'Brokkoli, főtt, lecsöpögtetve, só nélkül'], [175168, 'Atlanti lazac, tenyésztett, sütve'],
];
const response = await fetch('https://api.nal.usda.gov/fdc/v1/foods?api_key=DEMO_KEY', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(30_000),
  body: JSON.stringify({ fdcIds: foods.map(([id]) => id), format: 'full' }),
});
assert.ok(response.ok, `USDA request failed: ${response.status}`);
const payload = await response.json(); assert.equal(payload.length, foods.length);
const ids = { calories: 1008, protein: 1003, fat: 1004, fiber: 1079, sugar: 2000, sodium: 1093, saturatedFat: 1258 };
const reference = Object.fromEntries(foods.map(([id, label]) => {
  const food = payload.find(item => item.fdcId === id); assert.equal(food.dataType, 'SR Legacy');
  const amount = nutrientId => food.foodNutrients.find(item => item.nutrient?.id === nutrientId)?.amount ?? null;
  const nutrients = Object.fromEntries(Object.entries(ids).map(([key, nutrientId]) => [key, amount(nutrientId)]));
  assert.ok(['calories', 'protein', 'fat', 'fiber'].every(key => Number.isFinite(nutrients[key])));
  assert.ok(Number.isFinite(amount(1005)));
  // USDA carbohydrate-by-difference includes fibre; our UI consistently shows available carbohydrate.
  nutrients.carbs = Math.round(Math.max(0, amount(1005) - nutrients.fiber) * 1000) / 1000;
  return [`fdc-${id}`, { label, description: food.description, fdcId: id, dataType: food.dataType, publishedAt: food.publicationDate, retrievedAt: new Date().toISOString().slice(0, 10), url: `https://fdc.nal.usda.gov/food-details/${id}/nutrients`, nutrients }];
}));
writeFileSync(new URL('../lib/food-reference.mjs', import.meta.url), `// USDA FoodData Central, CC0. Regenerate with node scripts/update-food-reference.mjs.\nexport const FOOD_REFERENCE = ${JSON.stringify(reference, null, 2)};\n`);
console.log(`${foods.length} USDA records saved, with provenance and per-100g nutrient values.`);
