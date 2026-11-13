import test from 'node:test';
import assert from 'node:assert/strict';
import { analyze } from '../lib/providers.mjs';
import { totals, analysisReport } from '../lib/domain.mjs';
import { aiPayloadFor, visualInventory } from './fixtures.mjs';

const photo = 'data:image/jpeg;base64,' + Buffer.concat([Buffer.from([255,216,255,224]), Buffer.alloc(200)]).toString('base64');
const cake = {
  name: 'Kakaós piskótatekercs krémmel és lekvárral', confidence: 'high', dishProfile: 'edesseg',
  assumptions: 'A krém és a lekvár aránya nem mérhető; a tápérték becslés.',
  ingredients: [{ name: 'Kakaós piskótatekercs', grams: 80, quantityUnit: 'g', foodState: 'prepared',
    calories: 350, protein: 5, carbs: 45, fat: 17, fiber: null, sugar: null, sodium: null, saturatedFat: null }],
};
const env = { OPENCODE_API_KEY: 'fixture', FREE_FOOD_SOURCES: 'cnf' };

function payload() {
  const inventory = visualInventory(cake);
  inventory.imageQuality = { level: 'good', issues: [] };
  Object.assign(inventory.ingredients[0], {
    lookupQuery: 'chocolate swiss roll cake with cream filling', identityUncertain: false, portion: null,
  });
  return aiPayloadFor(cake, null, inventory);
}

for (const mode of ['no compatible match', 'database unavailable']) {
  test(`cake without a reference still yields an explicitly estimated result when ${mode}`, async () => {
    let gemini = 0, free = 0;
    const result = await analyze(photo, '', env, async (url, options) => {
      if (url.startsWith('https://opencode.ai/')) {
        gemini++;
        const request = JSON.parse(options.body), config = request.generationConfig;
        const schema = config.responseJsonSchema.properties.ingredients.items.properties.nutrients;
        assert.equal(schema.type, 'object', 'The structured-output contract must forbid nutrients:null');
        for (const key of ['calories', 'protein', 'carbs', 'fat']) assert.equal(schema.properties[key].type, 'number');
        assert.deepEqual(schema.properties.fiber.type, ['number', 'null']);
        assert.match(request.systemInstruction.parts[0].text, /ALWAYS return a nutrients object for EVERY ingredient/);
        assert.doesNotMatch(request.systemInstruction.parts[0].text, /nutrients=null; server supplies/);
        assert.equal(config.maxOutputTokens, 1600);
        return Response.json(payload());
      }
      free++;
      assert.equal(new URL(url).hostname, 'food-nutrition.canada.ca');
      if (mode === 'database unavailable') throw Error('offline');
      // A vaguely related cake must not become a verified nutrition source.
      return Response.json([{ food_code: 123, food_description: 'Cake, plain, commercially prepared' }]);
    });
    const item = result.analysis.ingredients[0];
    assert.equal(gemini, 1); assert.ok(free <= 1);
    assert.equal(result.usage.passes.length, 1); assert.equal(result.usage.recognition.state, 'not_needed');
    assert.equal(result.usage.foodData.matched, 0);
    assert.equal(item.sourceType, 'ai'); assert.equal(item.referenceKey, null); assert.notEqual(item.sourceConfirmed, true);
    assert.equal(item.grams, 80); assert.equal(item.calories, 350); assert.equal(totals(result.analysis.ingredients).calories, 280);
    assert.equal(item.fiber, null); assert.equal(item.sodium, null);
    assert.equal(result.analysis.confidence, 'medium'); assert.deepEqual(result.analysis.questions, []);
    assert.ok(analysisReport(result.analysis).warnings.some(message => message.includes('becsült tápérték')));
  });
}

test('a gateway response violating the fallback contract still fails without zeros or a paid repair request', async () => {
  for (const invalid of [null, { ...cake.ingredients[0], calories: -1 }, { ...cake.ingredients[0], protein: 90 }]) {
    let calls = 0;
    await assert.rejects(() => analyze(photo, '', { ...env, FREE_FOOD_APIS: '0' }, async url => {
      calls++; assert.ok(url.startsWith('https://opencode.ai/'));
      const response = payload(), raw = JSON.parse(response.candidates[0].content.parts[0].text);
      raw.ingredients[0].nutrients = invalid;
      response.candidates[0].content.parts[0].text = JSON.stringify(raw);
      return Response.json(response);
    }), /tápértékadatokat nem sikerült ellenőrizni/);
    assert.equal(calls, 1);
  }
});
