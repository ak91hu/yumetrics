import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { analyze, ANALYSIS_SCHEMA } from '../lib/providers.mjs';
import { HAIKU_MODEL, mealModelRequest, mealModelResponse, normalizeModelAnalysis } from '../lib/meal-models.mjs';
import { FOOD_R1_REVISION } from '../lib/modal-food.mjs';
import { modelPricing, estimatedCost } from '../lib/telemetry.mjs';
import { readAiResponse } from '../lib/ai-archive.mjs';
import { validateRecognitionReview } from '../lib/recognition-review.mjs';
import { runHybridBenchmark, benchmarkCharge } from '../scripts/benchmark-food-r1-haiku.mjs';
import { aiPayloadFor, multiFoodAnalysis, secondImage } from './fixtures.mjs';

const photo = 'data:image/jpeg;base64,' + Buffer.concat([Buffer.from([255,216,255,224]),Buffer.alloc(200)]).toString('base64');
const env = { OPENCODE_MODEL: HAIKU_MODEL, OPENCODE_API_KEY: 'opencode-test-key', MODAL_FOOD_URL: 'https://test-food.modal.run/recognize', MODAL_PROXY_TOKEN_ID: 'wk-test-secret', MODAL_PROXY_TOKEN_SECRET: 'ws-test-secret' };
const helper = () => Response.json({ model: 'zy12123/Food-R1', revision: FOOD_R1_REVISION, answer: '{"foods":["chicken","imaginary sauce"]}', truncated: false, input_tokens: 100, output_tokens: 20, compute_seconds: 20 });
test('nullable enum schema keeps g/ml/null in separate typed branches', () => {
  const schema = { type: 'object', properties: { unit: { type: ['string', 'null'], enum: ['g', 'ml', null] } } };
  const request = mealModelRequest(HAIKU_MODEL, 'test', schema, [{ text: '{}' }], 1600);
  assert.deepEqual(request.body.output_config.format.schema.properties.unit, { anyOf: [{ type: 'string', enum: ['g', 'ml'] }, { type: 'null', enum: [null] }] });
  assert.deepEqual(schema.properties.unit.type, ['string', 'null']);
});
test('Haiku label transport stays within provider union limits and preserves absent values as unknown', () => {
  const request = mealModelRequest(HAIKU_MODEL, 'test', ANALYSIS_SCHEMA, [{text:'{}'}], 4096);
  const count = item => !item || typeof item !== 'object' ? 0 : (item.anyOf ? 1 : 0) + Object.values(item).reduce((sum, value) => sum + (Array.isArray(value) ? value.reduce((s, child) => s + count(child), 0) : count(value)), 0);
  assert.ok(count(request.body.output_config.format.schema) <= 16);
  const parsed = normalizeModelAnalysis(HAIKU_MODEL, {ingredients:[{productLabel:{textFields:[{key:'productName',value:'Test drink'},{key:'basisUnit',value:'ml'}],numberFields:[{key:'basisAmount',value:100},{key:'calories',value:0}],booleanFields:[],issues:[]}}]});
  assert.equal(parsed.ingredients[0].productLabel.nutrients.calories, 0);
  assert.equal(parsed.ingredients[0].productLabel.nutrients.protein, undefined);
  assert.equal(parsed.ingredients[0].productLabel.prepared, undefined);
  assert.throws(() => normalizeModelAnalysis(HAIKU_MODEL, {ingredients:[{productLabel:{textFields:[],numberFields:[{key:'calories',value:1},{key:'calories',value:2}],booleanFields:[],issues:[]}}]}));
});
function haiku(body, overrides = {}) {
  const parsed = JSON.parse(aiPayloadFor(multiFoodAnalysis()).candidates[0].content.parts[0].text);
  const candidates = JSON.parse(body.messages[0].content.at(-1).text).untrustedRecognitionCandidates;
  if (candidates) parsed.recognitionReview = [{ candidateIndex: 0, verdict: 'supported', ingredientIndex: 0 }, { candidateIndex: 1, verdict: 'rejected', ingredientIndex: null }];
  return { model: HAIKU_MODEL, stop_reason: 'end_turn', content: [{ type: 'thinking', thinking: 'PRIVATE REASONING', signature: 'PRIVATE SIGNATURE' }, { type: 'text', text: JSON.stringify(parsed) }], usage: { input_tokens: 4500, output_tokens: 1200 }, ...overrides };
}

test('native Haiku checks both original photos and audits rejected hints without losing independent foods', async () => {
  const calls = [], responses = [];
  const result = await analyze(photo, '', env, async (url, options) => {
    calls.push(url);
    if (url === env.MODAL_FOOD_URL) return helper();
    assert.equal(url, 'https://opencode.ai/inference/anthropic/v1/messages');
    assert.equal(options.headers['Modal-Secret'], undefined);
    const body = JSON.parse(options.body);
    assert.equal(body.max_tokens, 4096); assert.deepEqual(body.thinking, { type: 'adaptive' });
    assert.equal(body.output_config.effort, 'high');
    assert.equal(body.messages[0].content.filter(part => part.type === 'image').length, 2);
    assert.equal(body.output_config.format.schema.additionalProperties, false);
    return Response.json(haiku(body));
  }, { recognitionBefore: true, secondImage, onResponse: data => responses.push(data) });
  assert.equal(calls.length, 2);
  assert.equal(result.analysis.ingredients.length, 4);
  assert.equal(result.usage.recognition.review[1].verdict, 'rejected');
  assert.equal(result.usage.passes[0].candidatesTokenCount, 1200);
  assert.ok(!JSON.stringify(responses).includes('PRIVATE'));
});

test('truncated/refused/invalid Haiku output is accounted before rejection and never repaired', async () => {
  for (const stop_reason of ['max_tokens', 'refusal', 'end_turn']) {
    let calls = 0, recorded;
    await assert.rejects(analyze(photo, '', { OPENCODE_MODEL: HAIKU_MODEL, OPENCODE_API_KEY: 'test' }, async (_url, options) => {
      calls++; return Response.json(haiku(JSON.parse(options.body), { stop_reason, content: [{ type: 'text', text: 'invalid JSON' }] }));
    }, { onResponse: data => { recorded = data; } }));
    assert.equal(calls, 1); assert.equal(recorded.usage.candidatesTokenCount, 1200);
  }
});

test('helper review requires every unique candidate and valid ingredient references', () => {
  const raw = { ingredients: [{ alternatives: [] }], assumptions: '' };
  for (const review of [[], [{ candidateIndex: 2, verdict: 'supported', ingredientIndex: 0 }], [{ candidateIndex: 0, verdict: 'supported', ingredientIndex: -1 }], [{ candidateIndex: 0, verdict: 'rejected', ingredientIndex: 0 }], [{ candidateIndex: 0, verdict: 'uncertain', ingredientIndex: 0 }]]) {
    assert.throws(() => validateRecognitionReview({ ...raw, recognitionReview: review }, ['chicken']));
  }
  assert.throws(() => validateRecognitionReview({ ...raw, recognitionReview: Array(2).fill({ candidateIndex: 0, verdict: 'supported', ingredientIndex: 0 }) }, ['chicken', 'rice']));
});

test('Anthropic cache accounting includes writes and long context without double charging output', () => {
  const payload = { usage: { input_tokens: 100, output_tokens: 20, cache_read_input_tokens: 200, cache_creation_input_tokens: 300 } };
  const { usage } = mealModelResponse(HAIKU_MODEL, payload);
  assert.equal(usage.promptTokenCount, 600);
  const price = modelPricing(HAIKU_MODEL);
  assert.ok(Math.abs(estimatedCost(usage, price) - .0000595) < 1e-12);
  assert.equal(modelPricing(HAIKU_MODEL, '2026-11-12'), null);
  assert.ok(Math.abs(estimatedCost({ promptTokenCount: 100001, candidatesTokenCount: 0 }, price) - .0500005) < 1e-12);
  assert.equal(mealModelResponse(HAIKU_MODEL, { usage: { input_tokens: 5, output_tokens: -1 } }).usage, null);
});

test('native archive excludes thinking even when output is truncated or JSON is malformed', async () => {
  const parsed = await readAiResponse(Response.json({ content: [{ type: 'thinking', thinking: 'PRIVATE' }, { type: 'text', text: 'public' }], stop_reason: 'max_tokens' }), {}, 'opencode');
  assert.equal(parsed.archive.responseText, 'public'); assert.equal(parsed.archive.responseTruncated, true);
  const malformed = await readAiResponse(new Response('{"content":[{"type":"thinking","thinking":"PRIVATE"}'), {}, 'opencode');
  assert.ok(!malformed.archive.responseText.includes('PRIVATE'));
});

test('paid estimates distinguish credit from gross compute and keep unknown bills unknown', () => {
  assert.equal(benchmarkCharge(.001, .012, .03).creditAppliedUsd, .012);
  assert.ok(benchmarkCharge(.001, .012, .03).estimatedPaidHuf < 1);
  assert.ok(benchmarkCharge(.001, .012, 0).estimatedPaidHuf > 3);
  assert.equal(benchmarkCharge(null, .012, .03).estimatedPaidHuf, null);
});

test('paired benchmark locks image hashes, excludes targets from prompts and stops on unknown billing', async t => {
  const directory = mkdtempSync(resolve('.test-data-haiku-')); t.after(() => rmSync(directory, { recursive: true, force: true }));
  const bytes = Buffer.from(photo.split(',')[1], 'base64'); writeFileSync(join(directory, 'meal.jpg'), bytes);
  const manifest = { source: 'Software fixture, not a real measurement', cases: [{ id: 'test', group: 'generic', image: 'meal.jpg', images: [{ sha256: createHash('sha256').update(bytes).digest('hex') }], expectedFoods: ['SECRET_REFERENCE'], reference: { measured: true, method: 'weighed_components', provenance: 'Software fixture, not a real measurement', edibleWeightG: 300, calories: 999.123, protein: 10, carbs: 20, fat: 5 } }] };
  const path = join(directory, 'cases.json'); writeFileSync(path, JSON.stringify(manifest));
  let calls = 0;
  const fetcher = async (url, options) => {
    calls++; assert.ok(!options.body.includes('SECRET_REFERENCE')); assert.ok(!options.body.includes('999.123'));
    return url === env.MODAL_FOOD_URL ? helper() : Response.json(haiku(JSON.parse(options.body)));
  };
  const report = await runHybridBenchmark(path, { run: true, env, modalCreditUsd: 1, fetcher });
  assert.equal(calls, 3); assert.equal(report.status, 'completed'); assert.equal(report.rows.length, 2); assert.equal(report.mealsWithinTarget, 1);
  calls = 0;
  const stopped = await runHybridBenchmark(path, { run: true, env, modalCreditUsd: 1, fetcher: async (_url, options) => { calls++; return Response.json(haiku(JSON.parse(options.body), { usage: undefined })); } });
  assert.equal(calls, 1); assert.equal(stopped.status, 'stopped'); assert.equal(stopped.unknownBilling, 1);
  writeFileSync(join(directory, 'meal.jpg'), Buffer.from(secondImage.split(',')[1], 'base64'));
  await assert.rejects(runHybridBenchmark(path, { run: true, env, modalCreditUsd: 1, fetcher }), /tesztkép/);
});
