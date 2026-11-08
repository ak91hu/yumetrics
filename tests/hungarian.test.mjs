import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { validateAnalysis, totals, analysisReport, analysisContext } from '../lib/domain.mjs';
import { HUNGARIAN_DISHES, REFERENCE_STATES } from '../lib/hungarian-food.mjs';
import { FOOD_REFERENCE } from '../lib/food-reference.mjs';
import { analyze } from '../lib/providers.mjs';
import { secondImage, visualInventory, aiPayloadFor } from './fixtures.mjs';
import { openDatabase } from '../lib/database.mjs';
import { api } from '../lib/api.mjs';

const base = { name:'Saját rizses recept',confidence:'medium',assumptions:'Ismert recept; a hozzáadott olaj az ételben maradt.',dishProfile:'rakott',ingredients:[
  {name:'Rizs, száraz',grams:300,calories:360,protein:7,carbs:78,fat:1,fiber:2,sugar:0,sodium:0,saturatedFat:0,sourceType:'user',foodState:'raw'},
  {name:'Ételben maradt olaj',grams:20,calories:884,protein:0,carbs:0,fat:100,fiber:0,sugar:0,sodium:0,saturatedFat:null,sourceType:'user',foodState:'as_sold'},
] };
const recipe = (values={}) => ({...base, recipe:{cookedWeightG:900,eatenWeightG:225,lossesAccountedFor:true,ingredients:structuredClone(base.ingredients),...values}});
const image='data:image/jpeg;base64,'+Buffer.concat([Buffer.from([255,216,255,224]),Buffer.alloc(200)]).toString('base64');

test('a whole-pot recipe scales nutrients by measured cooked yield, not by the sum of raw weights',()=>{
  const calculated=validateAnalysis(recipe());
  assert.equal(totals(calculated.ingredients).calories,314.2);
  assert.equal(totals(calculated.ingredients).fat,5.8);
  assert.equal(totals(calculated.ingredients).saturatedFat,null);
  assert.equal(analysisReport(calculated).weight,225);
  assert.equal(calculated.ingredients.reduce((sum,item)=>sum+item.grams,0),80,'Raw-equivalent ingredient weight differs from cooked serving weight');
  assert.equal(analysisReport(calculated).basis,'recipe');
  assert.deepEqual(validateAnalysis(calculated),calculated,'Repeated save does not apply the portion fraction twice');
  assert.equal(totals(validateAnalysis(recipe({cookedWeightG:450})).ingredients).calories,628.4,'A drier batch has greater energy density for the same weighed serving');
});
test('Hungarian kitchen staples use archived USDA values and keep substitutions explicit',()=>{
  assert.equal(Object.keys(FOOD_REFERENCE).length,44);
  for(const [key,food] of Object.entries(FOOD_REFERENCE)) {
    assert.ok(REFERENCE_STATES[key]);assert.ok(food.url.includes(String(food.fdcId)));
    assert.equal(validateAnalysis({name:food.label,confidence:'low',ingredients:[{name:food.label,grams:100,...food.nutrients,referenceKey:key,sourceType:'reference'}]}).ingredients[0].sourceType,'reference');
  }
  assert.equal(FOOD_REFERENCE['fdc-167843'].nutrients.calories,236);
  assert.equal(FOOD_REFERENCE['fdc-167844'].nutrients.calories,292);
  assert.ok(FOOD_REFERENCE['fdc-167844'].matchNotes.includes('nem pörkölt vagy csülök'));
  assert.ok(FOOD_REFERENCE['fdc-171257'].matchNotes.includes('magyar 12%-os vagy 20%-os'));
  assert.ok(!Object.values(FOOD_REFERENCE).some(food=>food.label.includes('rögös túró')),'Cottage cheese is not relabelled as Hungarian túró');
});
test('a known thickened pea-dish recipe can use grounded flour, oil, dairy and cooked peas',()=>{
  const entries=[['fdc-169761',30],['fdc-171025',20],['fdc-171257',100],['fdc-170420',600]];
  const ingredients=entries.map(([key,grams])=>({name:FOOD_REFERENCE[key].label,grams,...FOOD_REFERENCE[key].nutrients,referenceKey:key,sourceType:'reference',sourceConfirmed:true}));
  const result=validateAnalysis({name:'Receptszámítási szoftverteszt, nem mért étkezés',confidence:'low',ingredients,recipe:{cookedWeightG:1000,eatenWeightG:250,lossesAccountedFor:true,ingredients}});
  const report=analysisReport(result);assert.equal(report.total.calories,247);assert.equal(report.total.protein,9.4);assert.equal(report.total.carbs,21.8);assert.equal(report.total.fat,10.3);assert.equal(report.total.fiber,8.5);assert.equal(report.referenceCount,4);assert.equal(report.weight,250);
});
test('recipe boundaries reject missing loss accounting, impossible servings, mass composition and nested data',()=>{
  for(const value of [{lossesAccountedFor:false},{cookedWeightG:0},{cookedWeightG:Infinity},{eatenWeightG:901},{eatenWeightG:-1},{cookedWeightG:10,eatenWeightG:5},{ingredients:[]}])assert.throws(()=>validateAnalysis(recipe(value)));
  const nested=recipe();nested.recipe.recipe={ingredients:[]};assert.equal(validateAnalysis(nested).recipe.recipe,undefined,'Unrecognised nested data is not retained');
});
test('forged derived portion values cannot replace the canonical recipe calculation',()=>{
  const value=recipe();value.ingredients=value.ingredients.map(item=>({...item,grams:1,calories:0}));
  const result=validateAnalysis(value);assert.equal(totals(result.ingredients).calories,314.2);
  assert.equal(result.recipe.ingredients[0].grams,300);
});
test('Hungarian groups have no fabricated dish calories; preparation context is bounded and validated',()=>{
  assert.equal(Object.keys(HUNGARIAN_DISHES).length,10);
  for(const group of Object.values(HUNGARIAN_DISHES)){assert.ok(group.hint);assert.ok(group.questions.length<=3);assert.equal(group.calories,undefined);}
  assert.deepEqual(new Set(Object.keys(REFERENCE_STATES)),new Set(Object.keys(FOOD_REFERENCE)));
  assert.equal(analysisContext({dishProfile:'fozelek',preparationNotes:'20%-os tejföllel habart'}).dishProfile,'fozelek');
  assert.throws(()=>analysisContext({dishProfile:'invented'}));assert.throws(()=>analysisContext({preparationNotes:'x'.repeat(1201)}));
});
test('a prepared ingredient cannot inherit a raw USDA reference; the single request includes actual preparation facts',async()=>{
  const inventory=visualInventory({...base,ingredients:[base.ingredients[0]]});inventory.ingredients[0].referenceKey='fdc-169756';inventory.ingredients[0].foodState='prepared';inventory.dishProfile='teszta';
  let calls=0,lastRequest;
  const fetcher=async(url,request)=>{calls++;lastRequest=JSON.parse(request.body);return Response.json(aiPayloadFor({...base,ingredients:[base.ingredients[0]]},request,inventory));};
  const result=await analyze(image,'Teszt',{OPENCODE_API_KEY:'test'},fetcher,{secondImage,context:{dishProfile:'teszta',preparationNotes:'A tészta főtt tömegét adtam meg.'}});
  assert.equal(calls,1);assert.equal(result.analysis.ingredients[0].sourceType,'ai');assert.equal(result.analysis.ingredients[0].referenceKey,null);assert.ok(result.analysis.ingredients[0].portionNote.includes('más elkészítési módhoz'));
  assert.ok(JSON.parse(lastRequest.contents[0].parts.find(part => part.text).text).context.preparationNotes.includes('főtt tömeg'));
});
test('two photos without supplementary fields produce a complete editable estimate with at most one optional question', async () => {
  const inventory = visualInventory(base); inventory.dishProfile = 'rakott';
  inventory.questions = ['Milyen tejföl került bele?', 'Mennyi olajat használtál?'];
  const calls = [];
  const result = await analyze(image, '', { OPENCODE_API_KEY: 'test' }, async (url, request) => {
    calls.push(JSON.parse(request.body)); return Response.json(aiPayloadFor(base, request, inventory));
  }, { secondImage });
  assert.equal(calls.length, 1);
  const context = JSON.parse(calls[0].contents[0].parts.find(part => part.text).text).context;
  assert.ok(!context.dishProfile || context.dishProfile === 'generic'); assert.equal(context.totalWeightG, null); assert.ok(!context.preparationNotes);
  assert.ok(calls[0].systemInstruction.parts[0].text.includes('questions alapból üres lista'));
  assert.ok(calls[0].systemInstruction.parts[0].text.includes('context.dishProfile=generic automatikus felismerést jelent'));
  assert.equal(result.analysis.name, base.name); assert.equal(result.analysis.dishProfile, 'rakott');
  assert.equal(result.analysis.ingredients[0].preparation, inventory.ingredients[0].preparation);
  assert.equal(result.analysis.ingredients[0].weightBasis, 'visual');
  assert.ok(totals(result.analysis.ingredients).calories > 0);
  assert.deepEqual(result.analysis.questions, [inventory.questions[0]]);
  const noQuestions = { ...inventory, questions: [] };
  const automatic = await analyze(image, '', { OPENCODE_API_KEY: 'test' }, async (url, request) => Response.json(aiPayloadFor(base, request, noQuestions)), { secondImage });
  assert.deepEqual(automatic.analysis.questions, []);
});
test('server save normalises recipe nutrients, keeps the original photo analysis and is owner-scoped',async t=>{
  const db=openDatabase(':memory:');t.after(()=>db.close());const id=randomUUID(),initial=JSON.stringify(base),now=new Date().toISOString();
  await db.prepare('INSERT INTO meals(id,user_id,day,time,type,status,analysis,original_analysis,photo,public_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,'alice','2026-11-07','12:00','Ebéd','draft',initial,initial,JSON.stringify({url:'https://res.cloudinary.com/test/image/upload/a.jpg'}),'a',now,now).run();
  const call=(userId,input)=>api(new Request(`http://localhost/api/meals/${id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)}),{db,env:{},userId});
  const payload={day:'2026-11-07',time:'12:00',type:'Ebéd',notes:'',revision:0,analysis:recipe()};
  assert.equal((await call('bob',payload)).status,404);
  const response=await call('alice',payload);assert.equal(response.status,200);const meal=(await response.json()).meal;
  assert.equal(meal.totals.calories,314.2);assert.equal(meal.report.weight,225);assert.equal(meal.analysis.recipe.cookedWeightG,900);
  assert.equal((await db.prepare('SELECT original_analysis FROM meals WHERE id=?').bind(id).first()).original_analysis,initial);
  const forged=structuredClone(payload);forged.revision=1;forged.analysis.recipe.ingredients[0].referenceKey='fdc-99999-0000000000000000';forged.analysis.recipe.ingredients[0].sourceType='reference';
  assert.equal((await call('alice',forged)).status,400);
});
