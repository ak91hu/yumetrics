import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { searchFoodSources, resolveFoodSource } from '../lib/food-search.mjs';
import { openDatabase } from '../lib/database.mjs';
import { api } from '../lib/api.mjs';
import { FOOD_REFERENCE } from '../lib/food-reference.mjs';
import { REFERENCE_STATES } from '../lib/hungarian-food.mjs';
import { analysisReferences } from '../lib/food-data.mjs';
import { validateAnalysis } from '../lib/domain.mjs';
import { foodApiClient } from '../lib/food-api-cache.mjs';

const food={food_code:109,food_description:'Cheese, gouda'};
const values=Object.entries({208:357,203:24.94,205:2.22,204:28,291:0,269:2.22,307:819,606:17.614}).map(([id,value])=>({food_code:109,nutrient_name_id:Number(id),nutrient_value:value}));
const fetchCnf=async(url,options)=>{
  assert.ok(!url.startsWith('https://opencode.ai/'),'No AI during correction');
  assert.equal(options.headers.Authorization,undefined);
  if(url.includes('/servingsize/'))return Response.json([{food_code:109,measure_name:'50g',conversion_factor_value:.5}]);
  if(url.includes('/nutrientamount/'))return Response.json(values);
  return Response.json([food,{food_code:110,food_description:'Cheese, gouda, low fat'}]);
};
test('manual search offers food variants as choices without treating partial names as automatic matches',async()=>{
  const result=await searchFoodSources('gouda',{FREE_FOOD_SOURCES:'cnf'},fetchCnf);
  assert.deepEqual(result.foods.map(food=>food.id),['109','110']);assert.ok(result.foods.every(food=>food.provider==='cnf'&&food.quantityUnit==='g'&&!Object.hasOwn(food,'nutrients')));
  const selected=await resolveFoodSource('cnf','109',{FREE_FOOD_SOURCES:'cnf'},fetchCnf);
  assert.equal(selected.record.nutrients.calories,357);assert.equal(selected.record.foodState,'as_sold');assert.equal(selected.record.portions[0].grams,50);
});
test('Hungarian local names remain searchable without external credentials or network requests',async()=>{
  const [key,reference]=Object.entries(FOOD_REFERENCE)[0];
  const result=await searchFoodSources(reference.label,{FREE_FOOD_APIS:'0'},()=>{throw Error('network not allowed');});
  assert.ok(result.foods.some(food=>food.id===key&&food.provider==='local'));
  const selected=await resolveFoodSource('local',key,{},()=>{throw Error('network not allowed');});assert.equal(selected.record,reference);
  assert.equal(result.foods.find(food=>food.id===key).foodState,REFERENCE_STATES[key]);
});
test('disabled, arbitrary and malformed source identifiers fail before network access',async()=>{
  let calls=0;const fetcher=()=>{calls++;throw Error();};
  for(const [provider,id] of [['other','109'],['cnf','https://evil.test/'],['usda','../123'],['local','fdc-forged'],['matvare','1/2']]) await assert.rejects(()=>resolveFoodSource(provider,id,{},fetcher));
  await assert.rejects(()=>resolveFoodSource('cnf','109',{FREE_FOOD_APIS:'0'},fetcher));
  for(const query of ['', 'ab', 'x'.repeat(101)])await assert.rejects(()=>searchFoodSources(query,{},fetcher));
  assert.equal(calls,0);
});
test('provider outages preserve local results, while wrong or incomplete records cannot be selected',async()=>{
  const data=await searchFoodSources('rice',{},async()=>new Response('down',{status:503}));
  assert.ok(data.foods.every(food=>food.provider==='local'));
  await assert.rejects(()=>resolveFoodSource('usda','109',{USDA_API_KEY:'test'},async()=>Response.json({fdcId:999})),/hiányos/);
  await assert.rejects(()=>resolveFoodSource('cnf','109',{FREE_FOOD_SOURCES:'cnf'},async url=>url.includes('/food/')?Response.json([food]):Response.json([])),/hiányos/);
});
test('authenticated app search, selection, save and reload retain trusted external data without any AI call',async t=>{
  const db=openDatabase(':memory:');t.after(()=>db.close());const userId=randomUUID(),id=randomUUID(),time=new Date().toISOString();
  await db.prepare('INSERT INTO users(id,google_sub,email,name,created_at,updated_at) VALUES(?,?,?,?,?,?)').bind(userId,userId,'food-search@example.test','Test',time,time).run();
  const env={FREE_FOOD_SOURCES:'cnf'}, invoke=(path,method='GET',body,owner=userId)=>api(new Request('http://localhost'+path,{method,headers:{'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})}),{db,env,userId:owner,fetcher:fetchCnf});
  assert.equal((await invoke('/api/food-sources/search?q=gouda','GET',null,null)).status,401);
  const response=await invoke('/api/food-sources/search?q=gouda');assert.equal(response.status,200);assert.equal((await response.json()).foods[0].provider,'cnf');
  const resolved=await invoke('/api/food-sources/cnf/109');assert.equal(resolved.status,200);const {key,record}=await resolved.json();
  const analysis={name:'Gouda',confidence:'medium',ingredients:[{name:record.label,grams:50,gramsMin:40,gramsMax:60,foodState:record.foodState,quantityUnit:'g',sourceType:'reference',sourceConfirmed:true,referenceKey:key,...record.nutrients}]};
  await db.prepare('INSERT INTO meals(id,user_id,day,time,type,status,analysis,original_analysis,photo,public_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,userId,'2026-11-13','12:00','Ebéd','draft',JSON.stringify(analysis),JSON.stringify(analysis),'{}','yumetrics/'+id,time,time).run();
  const saved=await invoke('/api/meals/'+id,'PATCH',{day:'2026-11-13',time:'12:00',type:'Ebéd',notes:'',revision:0,analysis});assert.equal(saved.status,200,await saved.clone().text());
  const meal=(await(await invoke('/api/meals/'+id)).json()).meal;assert.equal(meal.analysis.ingredients[0].sourceConfirmed,true);assert.equal(meal.analysis.ingredients[0].referenceRecord.source,'cnf');assert.equal(meal.totals.calories,178.5);
  const forged=structuredClone(analysis);forged.ingredients[0].referenceRecord={...record,nutrients:{...record.nutrients,calories:0}};
  assert.equal(validateAnalysis(forged,await analysisReferences(forged,db)).ingredients[0].calories,357);
});
test('the unified search route shares per-user throttling with legacy food lookups',async t=>{
  const db=openDatabase(':memory:');t.after(()=>db.close());const userId=randomUUID(),time=new Date().toISOString();
  await db.prepare('INSERT INTO users(id,google_sub,email,name,created_at,updated_at) VALUES(?,?,?,?,?,?)').bind(userId,userId,'limit@example.test','Test',time,time).run();
  let calls=0;const env={FREE_FOOD_APIS:'0'};
  const request=()=>api(new Request('http://localhost/api/food-sources/search?q=rice'),{db,env,userId,fetcher:()=>{calls++;throw Error();}});
  for(let i=0;i<30;i++)assert.equal((await request()).status,200);
  assert.equal((await request()).status,429);assert.equal(calls,0);
});
test('parallel searches share one catalogue fetch even while the persistent cache read is pending',async t=>{
  const db=openDatabase(':memory:');t.after(()=>db.close());let calls=0;
  const fetcher=async(url,options)=>{calls++;return fetchCnf(url,options);};
  const results=await Promise.all(Array.from({length:8},()=>searchFoodSources('gouda',{FREE_FOOD_SOURCES:'cnf'},fetcher,db)));
  assert.equal(calls,1);assert.ok(results.every(result=>result.foods.some(food=>food.id==='109')));
});
test('parallel distinct requests cannot exceed the 16-request cap after asynchronous reservations',async t=>{
  const db=openDatabase(':memory:');t.after(()=>db.close());let calls=0;
  const client=foodApiClient({},async()=>{calls++;return Response.json([]);},db);
  await Promise.all(Array.from({length:24},(_,i)=>client.get('cnf',`https://food-nutrition.canada.ca/api/canadian-nutrient-file/food/?id=${i}`)));
  assert.equal(calls,16);assert.equal(client.stats.requests,16);
});
test('Swedish and Norwegian choices resolve through their own adapters without mixing identifiers or nutrients',async()=>{
  const slv={nummer:12,namn:'Cheese, gouda'};
  const slvValues=Object.entries({ENERC:['kcal',357],PROT:['g',24.94],CHO:['g',2.22],FAT:['g',28]}).map(([code,[unit,value]])=>({euroFIRkod:code,enhet:unit,varde:value,viktGram:100,matrisenhetkod:'W',vardetypkod:'BE'}));
  const norwegian={foodId:'01.100',foodName:'Cheese, gouda',calories:{quantity:357,unit:'kcal'},constituents:Object.entries({Protein:24.94,Karbo:2.22,Fett:28}).map(([id,value])=>({nutrientId:id,quantity:value,unit:'g'}))};
  for(const provider of ['slv','matvare']){
    const fetcher=async url=>Response.json(provider==='matvare'?{foods:[norwegian]}:url.includes('naringsvarden')?slvValues:{_meta:{totalRecords:1},livsmedel:[slv]});
    const result=await searchFoodSources('gouda',{FREE_FOOD_SOURCES:provider},fetcher);
    const choice=result.foods.find(food=>food.provider===provider);assert.ok(choice);
    const resolved=await resolveFoodSource(choice.provider,choice.id,{FREE_FOOD_SOURCES:provider},fetcher);
    assert.equal(resolved.record.source,provider);assert.equal(resolved.record.nutrients.calories,357);assert.equal(resolved.record.nutrients.fiber,null);
  }
});
