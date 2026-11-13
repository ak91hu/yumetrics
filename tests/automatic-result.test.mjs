import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { openDatabase } from '../lib/database.mjs';
import { api } from '../lib/api.mjs';
import { processNextJob } from '../lib/jobs.mjs';
import { FOOD_R1_REVISION } from '../lib/modal-food.mjs';
import { aiPayloadFor, visualInventory } from './fixtures.mjs';

test('automatic assembly publishes only the completed result and saves it without source selection or questions',async t=>{
  const db=openDatabase(':memory:');t.after(()=>db.close());const userId=randomUUID(),mealId=randomUUID(),time=new Date().toISOString();
  await db.prepare('INSERT INTO users(id,google_sub,email,name,created_at,updated_at) VALUES(?,?,?,?,?,?)').bind(userId,userId,'automatic@example.test','Test',time,time).run();
  const photo='data:image/jpeg;base64,'+Buffer.concat([Buffer.from([255,216,255,224]),Buffer.alloc(200)]).toString('base64');
  const env={OPENCODE_API_KEY:'fixture',FREE_FOOD_SOURCES:'cnf',MODAL_FOOD_URL:'https://test-food.modal.run/recognize',MODAL_PROXY_TOKEN_ID:'fixture',MODAL_PROXY_TOKEN_SECRET:'fixture',CLOUDINARY_CLOUD_NAME:'test-cloud',CLOUDINARY_API_KEY:'fixture',CLOUDINARY_API_SECRET:'fixture'};
  const input={name:'Gouda sajt',confidence:'medium',ingredients:[{name:'Gouda sajt',grams:50,quantityUnit:'g',foodState:'as_sold',calories:999,protein:1,carbs:1,fat:1,fiber:null,sugar:null,sodium:null,saturatedFat:null}]};
  const inventory=visualInventory(input);Object.assign(inventory.ingredients[0],{lookupQuery:'Cheese, gouda',identityUncertain:true,alternatives:['Más sajt']});
  const values=Object.entries({208:357,203:24.94,205:2.22,204:28,291:0,269:2.22,307:819,606:17.614}).map(([id,value])=>({food_code:109,nutrient_name_id:Number(id),nutrient_value:value}));
  let resume,announce,gemini=0,helper=0;const gate=new Promise(resolve=>resume=resolve),began=new Promise(resolve=>announce=resolve);
  const fetcher=async(url,options)=>{
    if(url.startsWith('https://res.cloudinary.com/'))return new Response(Buffer.from(photo.split(',')[1],'base64'),{headers:{'Content-Type':'image/jpeg'}});
    if(url.endsWith('/upload'))return Response.json({public_id:options.body.get('public_id'),secure_url:`https://res.cloudinary.com/test-cloud/image/authenticated/v1/${options.body.get('public_id')}.jpg`,width:100,height:80});
    if(url.startsWith('https://opencode.ai/')){gemini++;const payload=aiPayloadFor(input,JSON.parse(options.body),inventory);const parsed=JSON.parse(payload.candidates[0].content.parts[0].text);parsed.ingredients[0].nutrients=null;payload.candidates[0].content.parts[0].text=JSON.stringify(parsed);return Response.json(payload);}
    if(url===env.MODAL_FOOD_URL){helper++;return Response.json({model:'zy12123/Food-R1',revision:FOOD_R1_REVISION,answer:'{"foods":["cheese gouda","helper-only pineapple"]}',truncated:false,input_tokens:100,output_tokens:20,compute_seconds:1});}
    if(url.includes('/nutrientamount/')){announce();await gate;return Response.json(values);}
    if(url.includes('/servingsize/'))return Response.json([]);
    if(url.includes('/food/'))return Response.json([{food_code:109,food_description:'Cheese, gouda'}]);
    throw Error('Unexpected endpoint');
  };
  const call=(path,method='GET',body)=>api(new Request('http://localhost'+path,{method,headers:{'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})}),{db,env,userId,fetcher});
  const started=await call('/api/analyze','POST',{id:mealId,image:photo,day:'2026-11-13',time:'12:00',type:'Ebéd',notes:''});assert.equal(started.status,202);
  const job=processNextJob({db,env,fetcher});
  try{
    await began;
    const partial=(await(await call('/api/meals/'+mealId)).json()).meal;assert.equal(partial.analysis,null);assert.equal(partial.status,'analyzing');
  }finally{resume();}
  await job;
  const result=(await(await call('/api/meals/'+mealId)).json()).meal;
  assert.equal(result.status,'draft');assert.equal(gemini,1);assert.equal(helper,1);
  assert.deepEqual(result.analysis.questions,[]);assert.equal(result.analysis.ingredients[0].sourceType,'reference');assert.equal(result.analysis.ingredients[0].sourceConfirmed,false);
  assert.equal(result.analysis.ingredients[0].referenceRecord.source,'cnf');assert.equal(result.analysis.confidence,'low');assert.equal(result.totals.calories,178.5);
  assert.ok(!result.analysis.observations.join(' ').includes('helper-only pineapple'));
  const ledger=await db.prepare('SELECT usage FROM meals WHERE id=?').bind(mealId).first();assert.equal(JSON.parse(ledger.usage).foodData.evidence[0].state,'provisional_identity');
  const saved=await call('/api/meals/'+mealId,'PATCH',result);assert.equal(saved.status,200,await saved.clone().text());
  assert.equal((await saved.json()).meal.status,'saved');assert.equal(gemini,1);assert.equal(helper,1);
});
