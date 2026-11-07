import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {analysisContext,analysisReport,validateAnalysis} from '../lib/domain.mjs';
import {api} from '../lib/api.mjs';
import {openDatabase} from '../lib/database.mjs';

const ingredients=[
  {name:'Sűrűbb összetevő',grams:150,gramsMin:100,gramsMax:200,calories:200,protein:20,carbs:0,fat:13,fiber:0,sugar:0,sodium:0,saturatedFat:0,weightBasis:'measured_total'},
  {name:'Könnyebb összetevő',grams:150,gramsMin:100,gramsMax:200,calories:20,protein:1,carbs:3,fat:0,fiber:0,sugar:0,sodium:0,saturatedFat:0,weightBasis:'measured_total'},
];
test('new analysis context always means the entire image, with only legacy 100% input accepted',()=>{
  assert.equal(analysisContext().portionScope,'full_image');assert.equal(analysisContext({consumedPercent:100}).consumedPercent,undefined);
  for(const consumedPercent of [0,1,50,99,101,'100',NaN])assert.throws(()=>analysisContext({consumedPercent}));
  assert.throws(()=>analysisContext({portionScope:'half'}));
  assert.throws(()=>analysisContext({plateDiameterCm:61}),error=>error.message.includes('A tányér átmérője: 5 és 60 cm')&&!error.message.includes('plateDiameterCm'));
});
test('known total mass constrains the energy envelope instead of inventing smaller or bigger meals',()=>{
  const report=analysisReport({ingredients});
  assert.equal(report.total.calories,330);assert.equal(report.weight,300);
  assert.deepEqual(report.energyRange,{min:240,max:420,kind:'fixed_total'});
  const unmeasured=analysisReport({ingredients:ingredients.map(item=>({...item,weightBasis:'visual'}))});
  assert.deepEqual(unmeasured.energyRange,{min:220,max:440,kind:'independent_portions'});
  const mixed=analysisReport({ingredients:ingredients.map((item,index)=>({...item,weightBasis:index?'user':'measured_total'}))});assert.equal(mixed.basis,'edited');assert.equal(mixed.energyRange.kind,'independent_portions');
});
test('fixed-total allocation agrees with every feasible two-component endpoint and is order independent',()=>{
  for(const first of [0,10,100,300])for(const second of [0,30,200,900]) {
    const items=ingredients.map((item,index)=>({...item,calories:index?second:first}));
    const report=analysisReport({ingredients:items});
    const values=Array.from({length:101},(_,i)=>(100+i)*first/100+(200-i)*second/100);
    assert.equal(report.energyRange.min,Math.min(...values));assert.equal(report.energyRange.max,Math.max(...values));
    assert.deepEqual(analysisReport({ingredients:[...items].reverse()}).energyRange,report.energyRange);
  }
});
test('fixed-total allocation distributes the remaining mass across three bounded components',()=>{
  const items=[{grams:100,gramsMin:0,gramsMax:200,calories:900},{grams:100,gramsMin:50,gramsMax:150,calories:400},{grams:100,gramsMin:0,gramsMax:200,calories:0}].map(item=>({...ingredients[0],...item}));
  assert.deepEqual(analysisReport({ingredients:items}).energyRange,{min:400,max:2200,kind:'fixed_total'});
});
test('legacy saved quantities survive validation; a new full-image marker is explicit',()=>{
  const legacy={name:'Korábbi adag',confidence:'low',ingredients:ingredients.map(item=>({...item,weightBasis:'user'}))};
  assert.equal(validateAnalysis(legacy).portionScope,undefined);assert.equal(validateAnalysis({...legacy,portionScope:'full_image'}).portionScope,'full_image');assert.throws(()=>validateAnalysis({...legacy,portionScope:'half'}));
});
test('API rejects partial-photo analysis before storing a job, uploading or requesting AI',async t=>{
  const db=openDatabase(':memory:');t.after(()=>db.close());let calls=0;
  const image='data:image/jpeg;base64,'+Buffer.concat([Buffer.from([255,216,255,224]),Buffer.alloc(200)]).toString('base64');
  const response=await api(new Request('http://localhost/api/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:randomUUID(),image,day:'2026-11-07',time:'12:00',type:'Ebéd',context:{consumedPercent:50}})}),{db,env:{OPENCODE_API_KEY:'test',CLOUDINARY_CLOUD_NAME:'test-cloud',CLOUDINARY_API_KEY:'test',CLOUDINARY_API_SECRET:'test'},userId:'alice',fetcher:()=>{calls++;throw Error('Unexpected provider call');}});
  assert.equal(response.status,400);assert.equal(calls,0);assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM meals').bind().first()).n,0);
});
