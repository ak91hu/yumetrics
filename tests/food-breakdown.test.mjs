import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {openDatabase,openPostgresDatabase} from '../lib/database.mjs';
import {analysisReport,validateAnalysis,totals,NUTRIENTS} from '../lib/domain.mjs';
import {analyze} from '../lib/providers.mjs';
import {api} from '../lib/api.mjs';
import {multiFoodAnalysis,secondImage,aiPayloadFor} from './fixtures.mjs';

test('every named food has portion nutrients, mixed units stay separate and unknown totals remain unknown',()=>{
  const analysis=validateAnalysis(multiFoodAnalysis()),report=analysisReport(analysis);
  assert.deepEqual(report.items.map(item=>item.name),analysis.ingredients.map(item=>item.name));
  assert.deepEqual(report.items.map(item=>[item.quantity,item.unit]),[[150,'g'],[200,'g'],[100,'g'],[250,'ml']]);
  assert.deepEqual(report.items.map(item=>item.totals.calories),[247.5,260,30,105]);
  assert.equal(report.total.calories,642.5);assert.equal(report.total.protein,54.7);assert.equal(report.total.carbs,82.5);assert.equal(report.total.fat,7.5);
  assert.equal(report.total.sodium,null);assert.equal(report.items[2].totals.sodium,null);assert.equal(report.items[0].totals.sodium,105);
  assert.equal(report.weight,450);assert.equal(report.volume,250);
  for(const [index,item]of report.items.entries())assert.deepEqual(item.totals,totals([analysis.ingredients[index]]));
  for(const item of report.items)assert.deepEqual(Object.keys(item.totals),NUTRIENTS);
  const inferred=analysisReport({ingredients:[{...analysis.ingredients[0],visibility:'inferred'}]});assert.equal(inferred.items[0].inferred,true);
  const changed=structuredClone(analysis);changed.ingredients[0].grams=200;
  assert.equal(analysisReport(changed).items[0].totals.calories,330);assert.equal(analysisReport(changed).total.calories,725);
});
test('recipe breakdown describes the ingredients in the saved portion without adding the whole batch again',()=>{
  const ingredients=multiFoodAnalysis().ingredients.slice(0,2),analysis=validateAnalysis({name:'Csirkés rizs',confidence:'medium',ingredients,recipe:{cookedWeightG:450,eatenWeightG:225,lossesAccountedFor:true,ingredients}});
  const report=analysisReport(analysis);assert.equal(report.items.length,2);assert.deepEqual(report.items.map(item=>item.quantity),[75,100]);assert.equal(report.total.calories,253.8);assert.equal(report.weight,225);assert.equal(report.volume,null);
});
for(const dialect of ['sqlite','postgres'])for(const viewCount of [1,2])test(`${dialect}: ${viewCount}-photo analysis preserves all food names and portion nutrients through save and reload`,{skip:dialect==='postgres'&&!process.env.TEST_DATABASE_URL},async t=>{
  const db=dialect==='postgres'?await openPostgresDatabase(process.env.TEST_DATABASE_URL):openDatabase(':memory:'),userId=randomUUID(),id=randomUUID(),now=new Date().toISOString();
  t.after(async()=>{await db.prepare('DELETE FROM meals WHERE user_id=?').bind(userId).run();await db.prepare('DELETE FROM users WHERE id=?').bind(userId).run();await db.close();});
  await db.prepare('INSERT INTO users(id,google_sub,email,name,created_at,updated_at) VALUES(?,?,?,?,?,?)').bind(userId,userId,'foods@example.test','Foods test',now,now).run();
  const image='data:image/jpeg;base64,'+Buffer.concat([Buffer.from([255,216,255,224]),Buffer.alloc(200)]).toString('base64');let calls=0;
  const result=await analyze(image,'',{OPENCODE_API_KEY:'test'},async(url,options)=>{
    calls++;const request=JSON.parse(options.body),prompt=request.systemInstruction.parts[0].text;
    assert.ok(prompt.includes('List EVERY'));assert.ok(prompt.includes('Several foods on one plate are one meal'));assert.ok(prompt.includes('match every food to the supplied images'));
    assert.equal(request.contents[0].parts.filter(part=>part.inlineData).length,viewCount);
    return Response.json(aiPayloadFor(multiFoodAnalysis(),options));
  },{secondImage:viewCount===2?secondImage:undefined});assert.equal(calls,1);assert.equal(result.analysis.ingredients.length,4);
  await db.prepare('INSERT INTO meals(id,user_id,day,time,type,status,analysis,original_analysis,photo,public_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,userId,'2026-11-09','12:00','Ebéd','draft',JSON.stringify(result.analysis),JSON.stringify(result.analysis),'{}','yumetrics/'+id,now,now).run();
  const call=(path,method='GET',body)=>api(new Request('http://localhost'+path,{method,headers:{'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})}),{db,userId,env:{}});
  let {meal}=await(await call('/api/meals/'+id)).json();assert.equal(meal.report.items.length,4);
  assert.equal((await call('/api/meals/'+id,'PATCH',meal)).status,200);
  const month=await(await call('/api/meals?month=2026-11')).json();meal=month.meals.find(meal=>meal.id===id);assert.equal(meal.status,'saved');
  assert.deepEqual(meal.report.items.map(item=>item.name),multiFoodAnalysis().ingredients.map(item=>item.name));assert.equal(meal.report.total.calories,642.5);assert.equal(meal.report.total.sodium,null);
  Object.assign(meal.analysis.ingredients[0],{name:'Sült csirkemell, pontosítva',grams:200,gramsMin:200,gramsMax:200,weightBasis:'user'});
  assert.equal((await call('/api/meals/'+id,'PATCH',meal)).status,200);
  meal=(await(await call('/api/meals/'+id)).json()).meal;assert.equal(meal.report.items[0].name,'Sült csirkemell, pontosítva');assert.equal(meal.report.items[0].totals.calories,330);assert.equal(meal.report.total.calories,725);
  assert.equal(JSON.parse((await db.prepare('SELECT original_analysis FROM meals WHERE id=?').bind(id).first()).original_analysis).ingredients[0].grams,150);
});
