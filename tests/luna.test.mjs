import test from 'node:test';
import assert from 'node:assert/strict';
import { analyze, DEFAULT_MODEL, DEFAULT_MAX_OUTPUT_TOKENS } from '../lib/providers.mjs';
import { LUNA_MODEL, mealModelResponse } from '../lib/meal-models.mjs';
import { estimatedCost, modelPricing } from '../lib/telemetry.mjs';
import { aiPayloadFor, multiFoodAnalysis, secondImage } from './fixtures.mjs';

const photo = 'data:image/jpeg;base64,' + Buffer.concat([Buffer.from([255, 216, 255, 224]), Buffer.alloc(200)]).toString('base64');
const env = { OPENCODE_API_KEY: 'test-key', FREE_FOOD_APIS: '0' };
const parsedMeal = (change = raw => raw) => change(JSON.parse(aiPayloadFor(multiFoodAnalysis()).candidates[0].content.parts[0].text));
const usage = { input_tokens: 5813, output_tokens: 915, input_tokens_details: { cached_tokens: 0, cache_write_tokens: 5810 }, output_tokens_details: { reasoning_tokens: 161 }, cost: 0.00118405 };
const lunaPayload = (parsed, status = 'completed') => ({ model: 'gpt-6-luna', status, incomplete_details: status === 'completed' ? null : { reason: 'max_output_tokens' },
  output: [{ type: 'reasoning', summary: [] }, { type: 'message', content: [{ type: 'output_text', text: status === 'completed' ? JSON.stringify(parsed) : '{"isFood":' }] }], usage });

test('GPT-6 Luna is the default and is called through the OpenCode Responses route with a strict schema', async () => {
  assert.equal(DEFAULT_MODEL, LUNA_MODEL); assert.equal(DEFAULT_MAX_OUTPUT_TOKENS, 3000);
  const calls = [];
  const result = await analyze(photo, 'Saját megjegyzés', env, async (url, options) => {
    calls.push({ url, options, body: JSON.parse(options.body) });
    return Response.json(lunaPayload(parsedMeal()));
  }, { secondImage });
  assert.equal(calls.length, 1);
  const [{ url, options, body }] = calls;
  assert.equal(url, 'https://opencode.ai/inference/openai/v1/responses');
  assert.equal(options.headers.Authorization, 'Bearer test-key');
  assert.equal(body.model, 'gpt-6-luna'); assert.equal(body.max_output_tokens, 3000); assert.deepEqual(body.reasoning, { effort: 'low' }); assert.equal(body.store, false);
  assert.equal(body.tools, undefined, 'the vision model gets no tools');
  const content = body.input[0].content;
  assert.deepEqual(content.filter(part => part.type === 'input_image').map(part => part.image_url), [photo, secondImage]);
  assert.equal(JSON.parse(content.at(-1).text).notes, 'Saját megjegyzés', 'notes travel as data after the images');
  const format = body.text.format;
  assert.equal(format.type, 'json_schema'); assert.equal(format.strict, true);
  assert.equal(format.schema.additionalProperties, false);
  assert.deepEqual(format.schema.required.sort(), Object.keys(format.schema.properties).sort());
  assert.ok(format.schema.properties.separable && format.schema.properties.sauceOrDressing);
  assert.equal(result.model, 'gpt-6-luna'); assert.equal(result.analysis.ingredients.length, 4);
  assert.deepEqual(result.usage.passes, [{ stage: 'meal_analysis', promptTokenCount: 5813, candidatesTokenCount: 754, thoughtsTokenCount: 161, cachedContentTokenCount: 0, cacheCreationTokenCount: 5810, cost: 0.00118405 }]);
});

test('Luna pricing reproduces the provider-reported cost, cache writes included', () => {
  const decoded = mealModelResponse(LUNA_MODEL, lunaPayload(parsedMeal()));
  assert.ok(Math.abs(estimatedCost(decoded.usage, modelPricing(LUNA_MODEL, '2026-11-17')) - 0.00118405) < 1e-12);
  assert.equal(mealModelResponse(LUNA_MODEL, lunaPayload(null, 'incomplete')).complete, false);
});

test('a malformed or incomplete Luna answer gets exactly one retry and the ledger bills both attempts', async () => {
  let calls = 0; const recorded = [];
  const result = await analyze(photo, '', env, async () => (++calls === 1 ? Response.json(lunaPayload(null, 'incomplete')) : Response.json(lunaPayload(parsedMeal()))), { onResponse: data => recorded.push(data.usage) });
  assert.equal(calls, 2); assert.equal(result.analysis.ingredients.length, 4);
  assert.deepEqual(result.usage.passes.map(pass => pass.stage), ['meal_analysis', 'meal_analysis_retry']);
  assert.equal(recorded.at(-1).promptTokenCount, 2 * 5813); assert.ok(Math.abs(recorded.at(-1).cost - 2 * 0.00118405) < 1e-12);
  let failing = 0;
  await assert.rejects(analyze(photo, '', env, async () => { failing++; return Response.json(lunaPayload(null, 'incomplete')); }), /hiányos vagy hibás/);
  assert.equal(failing, 2, 'never a third paid attempt');
});

test('an implausible item amount is retried once; a repeated in-limit answer is accepted', async () => {
  let calls = 0;
  const heavy = parsedMeal(raw => { raw.ingredients[1].grams = 2000; raw.ingredients[1].gramsMax = 2400; return raw; });
  const result = await analyze(photo, '', env, async () => { calls++; return Response.json(lunaPayload(heavy)); });
  assert.equal(calls, 2); assert.equal(result.analysis.ingredients[1].grams, 2000);
});

test('a non-food photo asks for a new photo immediately, without a retry', async () => {
  let calls = 0;
  await assert.rejects(analyze(photo, '', env, async () => { calls++; return Response.json(lunaPayload(parsedMeal(raw => ({ ...raw, isFood: false })))); }), /Nem sikerült ételt/);
  assert.equal(calls, 1);
});
