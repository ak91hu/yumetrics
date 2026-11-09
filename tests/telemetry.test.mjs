import {test} from 'node:test';
import assert from 'node:assert/strict';
import {modelPricing,usageTotals,estimatedCost} from '../lib/telemetry.mjs';
import {dailySeries,lineChart,distributionChart} from '../public/admin-charts.mjs';

test('AI cost includes uncached input, discounted cached input, response and thinking; dated prices stay separate',()=>{
  const usage={promptTokenCount:1000000,cachedContentTokenCount:400000,candidatesTokenCount:200000,thoughtsTokenCount:100000};
  const november=modelPricing('gemini-4-argon','2026-11-30T23:59:59Z'),december=modelPricing('gemini-4-argon','2026-12-01T00:00:00Z');
  assert.ok(Math.abs(estimatedCost(usage,november)-4.24)<1e-12);
  assert.ok(Math.abs(estimatedCost({passes:[usage,usage]},november)-8.48)<1e-12);
  assert.ok(Math.abs(estimatedCost(usage,december)-8.48)<1e-12);
  assert.equal(november.input,2);assert.equal(december.input,4);
  assert.equal(modelPricing('unverified-model'),null);assert.equal(modelPricing('gemini-4-argon','2026-01-01'),null);
  for(const bad of [null,{}, {passes:[]}, {promptTokenCount:3}, {...usage,candidatesTokenCount:-1},{...usage,promptTokenCount:'1000'},{...usage,cachedContentTokenCount:1000001},{...usage,thoughtsTokenCount:Infinity}])assert.equal(estimatedCost(bad,november),null);
  assert.equal(estimatedCost(usage,null),null);
  assert.equal(estimatedCost({promptTokenCount:0,candidatesTokenCount:0},november),0);
  assert.deepEqual(usageTotals({promptTokenCount:5,candidatesTokenCount:3}),{input:5,output:3,cached:0,thoughts:0});
});
test('daily graphs retain empty days, missing costs, exact date boundaries and accessible escaped labels',()=>{
  const series=dailySeries([{day:'2026-11-08',cost:null},{day:'2026-11-09',cost:.003}], 'cost',3,'2026-11-09');
  assert.deepEqual(series,[{day:'2026-11-07',value:0},{day:'2026-11-08',value:null},{day:'2026-11-09',value:.003}]);
  const html=lineChart('cost','<unsafe>',series,'USD');assert.ok(html.includes('role="img"'));assert.ok(html.includes('Nincs költségadat'));assert.ok(!html.includes('<unsafe>'));assert.equal((html.match(/<polyline /g)||[]).length,2);
  const visits=lineChart('visits','Oldalmegnyitások',[{day:'2026-11-09',value:null}]);assert.ok(visits.includes('Nincs adat'));assert.ok(!visits.includes('Nincs költségadat'));
  assert.ok(!distributionChart('statuses','<x>',[{label:'<img onerror=alert(1)>',value:2}]).includes('<img'));
});
