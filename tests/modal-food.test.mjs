import test from 'node:test';
import assert from 'node:assert/strict';
import { foodCandidates, recognizeFoods, FOOD_R1_REVISION, MODAL_FOOD_MODEL } from '../lib/modal-food.mjs';
import { analyze } from '../lib/providers.mjs';
import { recordAiResponse, startModalRequest, modelPricing, estimatedCost } from '../lib/telemetry.mjs';
import { multiFoodAnalysis, aiPayloadFor, secondImage } from './fixtures.mjs';
import { openDatabase } from '../lib/database.mjs';
import { api } from '../lib/api.mjs';
import { processNextJob } from '../lib/jobs.mjs';
import { randomUUID } from 'node:crypto';

const photo = 'data:image/jpeg;base64,' + Buffer.concat([Buffer.from([255,216,255,224]),Buffer.alloc(200)]).toString('base64');
const env = { OPENCODE_API_KEY:'opencode-test', MODAL_FOOD_URL:'https://test-food.modal.run/recognize', MODAL_PROXY_TOKEN_ID:'wk-test', MODAL_PROXY_TOKEN_SECRET:'ws-test' };
const result = overrides => ({ model:'zy12123/Food-R1',revision:FOOD_R1_REVISION,answer:'{"foods":["chicken","rice","salad","orange juice"]}',truncated:false,input_tokens:100,output_tokens:20,compute_seconds:30,...overrides });

test('recognizer names are bounded data, with duplicates removed and markup rejected',()=>{
  assert.deepEqual(foodCandidates('{"foods":[" rice ","rice","salad"]}'),['rice','salad']);
  assert.deepEqual(foodCandidates('```json\n{"foods":[]}\n```'),[]);
  for(const answer of [null,'x','{"foods":["<script>"]}','{"foods":[null]}',JSON.stringify({foods:Array(21).fill('rice')}),JSON.stringify({foods:['x'.repeat(81)]})]) assert.equal(foodCandidates(answer),null);
});
test('unconfigured recognizer is free, and external destinations are rejected before credentials or billing',async()=>{
  let calls=0;const fetcher=()=>{calls++;throw Error();};
  assert.deepEqual(await recognizeFoods([photo],{},fetcher),{state:'disabled'});
  await assert.rejects(()=>recognizeFoods([photo],{...env,MODAL_FOOD_URL:'https://evil.test/recognize'},fetcher),/végpont/);
  assert.equal(calls,0);
});
test('both photo views are checked by Food-R1, then exactly one independent OpenCode analysis uses names only',async()=>{
  const calls=[],reports=[];let starts=0,ownershipChecks=0;
  const fetcher=async(url,options)=>{
    calls.push(url);const body=JSON.parse(options.body);
    if(url===env.MODAL_FOOD_URL){assert.equal(options.headers['Modal-Secret'],'ws-test');assert.deepEqual(body.images,[photo,secondImage]);return Response.json(result());}
    assert.equal(options.headers.Authorization,'Bearer opencode-test');assert.equal(options.headers['Modal-Secret'],undefined);
    const metadata=JSON.parse(body.contents[0].parts[0].text);assert.deepEqual(metadata.untrustedRecognitionCandidates,['chicken','rice','salad','orange juice']);
    assert.equal(body.contents[0].parts.filter(p=>p.inlineData).length,2);assert.match(body.systemInstruction.parts[0].text,/reject unsupported suggestions/);
    return Response.json(aiPayloadFor(multiFoodAnalysis(),body));
  };
  const report=await analyze(photo,'',env,fetcher,{secondImage,onModalStart:()=>{starts++;},onModalResponse:data=>reports.push(data),onOpenCodeStart:()=>{ownershipChecks++;}});
  assert.equal(calls.length,2);assert.equal(starts,1);assert.equal(ownershipChecks,1);assert.equal(reports[0].valid,true);assert.equal(reports[0].computeSeconds,30);
  assert.equal(report.analysis.ingredients.length,4);assert.equal(report.usage.recognition.state,'used');assert.equal(report.usage.passes.length,1);
});
test('timeout, rejected, malformed, truncated and wrong-version recognitions fall back without an extra OpenCode request',async()=>{
  for(const outcome of ['network','invalid','rejected','truncated','version']){
    let modal=0,opencode=0;const records=[];
    const fetcher=async(url,options)=>{
      if(url===env.MODAL_FOOD_URL){modal++;if(outcome==='network')throw Error('secret');return outcome==='invalid'?new Response('bad'):Response.json(result(outcome==='truncated'?{truncated:true}:outcome==='version'?{revision:'wrong'}:{}),{status:outcome==='rejected'?503:200});}
      opencode++;const body=JSON.parse(options.body);assert.equal(JSON.parse(body.contents[0].parts[0].text).untrustedRecognitionCandidates,undefined);return Response.json(aiPayloadFor(multiFoodAnalysis(),body));
    };
    const report=await analyze(photo,'',env,fetcher,{onModalResponse:data=>records.push(data)});
    assert.equal(modal,1);assert.equal(opencode,1);assert.equal(report.usage.recognition.state,'failed');assert.equal(records[0].valid,false);
  }
});
test('accounting failures and lost ownership prevent further paid calls',async()=>{
  let calls=0;const fetcher=async()=>{calls++;return Response.json(result());};
  await assert.rejects(()=>analyze(photo,'',env,fetcher,{onModalStart:()=>{throw Error('ledger unavailable');}}),/ledger/);assert.equal(calls,0);
  await assert.rejects(()=>analyze(photo,'',env,fetcher,{onModalResponse:()=>{throw Error('ledger unavailable');}}),/ledger/);assert.equal(calls,1);
  await assert.rejects(()=>analyze(photo,'',env,fetcher,{onOpenCodeStart:()=>{throw Error('lost ownership');}}),/ownership/);assert.equal(calls,2);
});
test('the internal monthly budget reserves pending or unknown calls and skips Modal when exhausted',async()=>{
  let inserts=0,total=0,reservation;
  const db={async transaction(fn){return fn(this);},prepare(sql){return {bind(...args){return {async first(){reservation=args[0];return {total};},async run(){if(sql.startsWith('INSERT'))inserts++;else assert.match(sql,/UPDATE app_settings/);}};}};}};
  const meal={id:'meal',user_id:'user'};
  assert.ok(await startModalRequest(db,meal,15));assert.ok(reservation>0);assert.equal(inserts,1);
  total=15;assert.equal(await startModalRequest(db,meal,15),null);assert.equal(inserts,1);
  for(const budget of [0,NaN,-1,Infinity,1001])assert.equal(await startModalRequest(db,meal,budget),null);
  let requests=0;const report=await analyze(photo,'',env,async(url,options)=>{requests++;assert.notEqual(url,env.MODAL_FOOD_URL);return Response.json(aiPayloadFor(multiFoodAnalysis(),JSON.parse(options.body)));},{onModalStart:()=>false});
  assert.equal(requests,1);assert.equal(report.usage.recognition.state,'budget');
});
test('Modal compute is recorded separately from token-priced OpenCode usage; missing duration is unknown',async()=>{
  const pricing=modelPricing(MODAL_FOOD_MODEL,'2026-11-10');assert.equal(estimatedCost({promptTokenCount:100,candidatesTokenCount:20},pricing),null);
  let values;const db={prepare(){return {bind(...args){values=args;return {async run(){}};}};}};
  for(const seconds of [30,null,NaN,-1,601]){
    await recordAiResponse(db,{id:'test',pricing},{usage:{promptTokenCount:100,candidatesTokenCount:20,secret:'never stored'},computeSeconds:seconds,httpStatus:200,latencyMs:40000});
    assert.equal(values[5],seconds===30?30*pricing.second:null);assert.equal(JSON.parse(values[0]).secret,undefined);
  }
});
test('real database reservations serialize concurrent attempts and retain the settings revision',async t=>{
  const db=openDatabase(':memory:');t.after(()=>db.close());
  const revision=await db.prepare('SELECT revision FROM app_settings WHERE id=1').bind().first();
  const reservation=90*modelPricing(MODAL_FOOD_MODEL).second;
  const attempts=await Promise.all([1,2].map(index=>startModalRequest(db,{id:'trial-'+index,user_id:null},reservation*1.5)));
  const accepted=attempts.filter(Boolean);assert.equal(accepted.length,1);
  assert.deepEqual(await db.prepare('SELECT revision FROM app_settings WHERE id=1').bind().first(),revision);
  await recordAiResponse(db,accepted[0],{usage:{promptTokenCount:100,candidatesTokenCount:20},computeSeconds:5,httpStatus:200,latencyMs:10000});
  assert.ok(await startModalRequest(db,{id:'trial-3',user_id:null},reservation*1.5));
});
test('meal jobs retain both usage ledgers, then continue with OpenCode when the Modal budget is disabled',async t=>{
  const db=openDatabase(':memory:');t.after(()=>db.close());const userId=randomUUID(),now=new Date().toISOString();
  await db.prepare('INSERT INTO users(id,google_sub,email,name,created_at,updated_at) VALUES(?,?,?,?,?,?)').bind(userId,userId,'hybrid@example.test','Hybrid',now,now).run();
  const runtime={...env,CLOUDINARY_CLOUD_NAME:'test-cloud',CLOUDINARY_API_KEY:'test',CLOUDINARY_API_SECRET:'test'};let modalCalls=0,openCodeCalls=0;
  const fetcher=async(url,options)=>{
    if(url.startsWith('https://res.cloudinary.com/'))return new Response(Buffer.from(photo.split(',')[1],'base64'),{headers:{'Content-Type':'image/jpeg'}});
    if(url.endsWith('/upload'))return Response.json({public_id:options.body.get('public_id'),secure_url:`https://res.cloudinary.com/test-cloud/image/authenticated/v1/${options.body.get('public_id')}.jpg`,width:100,height:80});
    if(url===env.MODAL_FOOD_URL){modalCalls++;return Response.json(result());}
    if(url.startsWith('https://opencode.ai/')){openCodeCalls++;return Response.json(aiPayloadFor(multiFoodAnalysis(),JSON.parse(options.body)));}
    throw Error('Unexpected provider');
  };
  for(const budget of ['15','0']){
    runtime.MODAL_MONTHLY_BUDGET_USD=budget;const id=randomUUID();
    const response=await api(new Request('http://localhost/api/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,image:photo,day:'2026-11-10',time:'12:00',type:'Ebéd',notes:''})}),{db,env:runtime,userId,fetcher});
    assert.equal(response.status,202,await response.text());await processNextJob({db,env:runtime,fetcher});
    const meal=await db.prepare('SELECT status,usage FROM meals WHERE id=?').bind(id).first();assert.equal(meal.status,'draft');assert.equal(JSON.parse(meal.usage).recognition.state,budget==='15'?'used':'budget');
    const ledger=(await db.prepare('SELECT model,state,cost_usd FROM ai_requests WHERE meal_id=?').bind(id).all()).results;
    assert.equal(ledger.length,budget==='15'?2:1);assert.ok(ledger.every(row=>row.state==='completed'&&row.cost_usd>0));
  }
  assert.equal(modalCalls,1);assert.equal(openCodeCalls,2);
});
