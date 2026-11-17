import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseThreshold, thresholdStats, chooseDelta, calibrated, calibration } from '../lib/calibration.mjs';
import { jevThresholds } from '../lib/jev.mjs';
import { refinementDelta } from '../lib/refinement.mjs';

const rows = [...Array(30)].map((_, i) => ({ accepted: true, confidence: i / 30, correct: i >= 10 }));

test('θ is the smallest threshold whose precision reaches the target with enough accepted decisions', () => {
  assert.deepEqual(thresholdStats(rows, .5), { n: 30, accepted: 15, precision: 1, coverage: .5 });
  assert.equal(chooseThreshold(rows, .9, 10).threshold, .3, '20 of 21 accepted are correct at 0.3');
  assert.equal(chooseThreshold(rows, .99, 10).threshold, .35);
  assert.equal(chooseThreshold(rows, .9, 25).threshold, null, 'too few accepted decisions above the target');
  assert.equal(chooseThreshold(rows.map(row => ({ ...row, accepted: false })), .5, 1).threshold, null, 'none / unresolved choices are never counted as accepted');
});

test('δ keeps the question screen rare and averaging no worse than the fast estimate; small sets stay uncalibrated', () => {
  assert.equal(chooseDelta([{ fastKcal: 500, foodR1Kcal: 520, truthKcal: 515 }]).status, 'insufficient');
  const pairs = [...Array(20)].map((_, i) => ({ fastKcal: 500, foodR1Kcal: 500 * (1 + i / 50), truthKcal: 500 * (1 + i / 100) }));
  const result = chooseDelta(pairs, .3);
  assert.equal(result.status, 'calibrated'); assert.ok(result.value >= .25 && result.value <= .35);
  const point = result.curve.find(p => p.delta === result.value);
  assert.ok(point.questionRate <= .3 && point.averagedMae <= point.fastMae);
});

test('precedence: explicit environment value > measured calibration > starting value', () => {
  const file = calibration();
  const expected = (key, fallback) => file?.[key]?.status === 'calibrated' ? file[key].value : fallback;
  assert.deepEqual(jevThresholds({}), { dish: expected('dish', .6), item: expected('item', .6) });
  assert.deepEqual(jevThresholds({ JEV_DISH_THRESHOLD: '.8', JEV_ITEM_THRESHOLD: '.7' }), { dish: .8, item: .7 });
  assert.equal(refinementDelta({}), expected('delta', .25));
  assert.equal(refinementDelta({ FOOD_R1_DELTA: '.4' }), .4);
  assert.equal(refinementDelta({ FOOD_R1_DELTA: '' }), expected('delta', .25), 'an empty override keeps the measured value');
  assert.deepEqual(jevThresholds({ JEV_DISH_THRESHOLD: '', JEV_ITEM_THRESHOLD: '' }), jevThresholds({}));
  assert.equal(calibrated('missing', .5), .5);
});
