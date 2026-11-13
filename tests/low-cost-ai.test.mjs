import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {openDatabase} from '../lib/database.mjs';
import {appSettings,validateSettings} from '../lib/settings.mjs';
import {analyze,DEFAULT_MODEL} from '../lib/providers.mjs';
import {FOOD_R1_REVISION} from '../lib/modal-food.mjs';
import {estimatedCost,modelPricing} from '../lib/telemetry.mjs';
import {photoDimensions} from '../public/photo-preparation.mjs';
import {adminApi} from '../lib/admin.mjs';
import {aiPayloadFor,multiFoodAnalysis,secondImage} from './fixtures.mjs';

const photo='data:image/jpeg;base64,'+Buffer.concat([Buffer.from([255,216,255,224]),Buffer.alloc(200)]).toString('base64');
test('low-cost default uses one compact Gemini request and skips Food-R1 for clear food identities',async()=>{
  const calls=[];
  const result=await analyze(photo,'',{OPENCODE_API_KEY:'test',MODAL_FOOD_URL:'https://old.modal.run/recognize',MODAL_PROXY_TOKEN_ID:'test',MODAL_PROXY_TOKEN_SECRET:'test',MODAL_MONTHLY_BUDGET_USD:'15'},async(url,options)=>{
    const body=JSON.parse(options.body);
    if(url==='https://old.modal.run/recognize'){
      calls.push({url,body});assert.deepEqual(body.images,[photo,secondImage]);
      return Response.json({model:'zy12123/Food-R1',revision:FOOD_R1_REVISION,answer:'{"foods":["chicken","rice"]}',truncated:false,input_tokens:100,output_tokens:20,compute_seconds:5});
    }
    assert.equal(JSON.parse(body.contents[0].parts[0].text).untrustedRecognitionCandidates,undefined);
    calls.push({url,body});
    const payload=aiPayloadFor(multiFoodAnalysis(),body);
    const raw=JSON.parse(payload.candidates[0].content.parts[0].text);
    for(const key of ['summary','observations','questions'])delete raw[key];
    for(const item of raw.ingredients){delete item.preparation;delete item.portionNote;}
    payload.candidates[0].content.parts[0].text=JSON.stringify(raw);
    return Response.json(payload);
  },{secondImage});
  assert.equal(calls.length,1);assert.ok(calls[0].url.endsWith(DEFAULT_MODEL+':generateContent'));
  assert.equal(result.usage.recognition.state,'not_needed');
  assert.equal(calls[0].body.generationConfig.maxOutputTokens,1600);
  assert.deepEqual(calls[0].body.generationConfig.thinkingConfig,{thinkingLevel:'MINIMAL'});
  assert.equal(calls[0].body.contents[0].parts.filter(p=>p.inlineData).length,2);
  assert.equal(result.analysis.summary,result.analysis.name);assert.deepEqual(result.analysis.questions,[]);
  assert.equal(result.analysis.ingredients.length,4);assert.equal(result.analysis.ingredients[0].calories,165);
  assert.ok(calls[0].body.systemInstruction.parts[0].text.length<10000,'Keep the prompt smaller than the previous 13,500-character budget');
});
test('truncated or rejected low-cost answers are billed once, with no repair or model fallback',async()=>{
  for(const finishReason of ['MAX_TOKENS','SAFETY']){
    let calls=0,usage;
    await assert.rejects(analyze(photo,'',{OPENCODE_API_KEY:'test'},async()=>{
      calls++;return Response.json({candidates:[{finishReason,content:{parts:[]}}],usageMetadata:{promptTokenCount:4500,candidatesTokenCount:1400,thoughtsTokenCount:200}});
    },{onResponse:data=>{usage=data.usage;}}));
    assert.equal(calls,1);assert.equal(usage.thoughtsTokenCount,200);
    assert.ok(estimatedCost(usage,modelPricing(DEFAULT_MODEL))*328.16<3);
  }
});
test('upgrade replaces persisted expensive AI settings once and retains unrelated settings',async t=>{
  const directory=mkdtempSync(join(tmpdir(),'yumetrics-upgrade-'));t.after(()=>rmSync(directory,{recursive:true,force:true}));
  const path=join(directory,'old.db'),old=new DatabaseSync(path);
  old.exec('CREATE TABLE schema_migrations(name TEXT PRIMARY KEY);');
  const journal=JSON.parse(readFileSync(new URL('../drizzle/meta/_journal.json',import.meta.url)));
  for(const {tag} of journal.entries.filter(e=>e.tag!=='0011_low_cost_ai')){
    old.exec(readFileSync(new URL('../drizzle/'+tag+'.sql',import.meta.url),'utf8'));old.prepare('INSERT INTO schema_migrations VALUES(?)').run(tag);
  }
  old.prepare('UPDATE app_settings SET value=?,revision=7 WHERE id=1').run(JSON.stringify({model:'gemini-4-argon',maxOutputTokens:12000,registrationEnabled:false,dailyLimit:33}));old.close();
  let db=openDatabase(path),settings=await appSettings(db,{});
  assert.equal(settings.revision,8);assert.equal(settings.settings.model,DEFAULT_MODEL);assert.equal(settings.settings.maxOutputTokens,1600);
  assert.equal(settings.settings.registrationEnabled,false);assert.equal(settings.settings.dailyLimit,33);
  assert.throws(()=>validateSettings({...settings.settings,maxOutputTokens:10000}));
  await db.close();db=openDatabase(path);assert.equal((await appSettings(db,{})).revision,8);await db.close();
});
test('detail photo resolution is retained, primary food photos shrink without upscaling',()=>{
  assert.deepEqual(photoDimensions(4000,3000),{width:1600,height:1200});
  assert.deepEqual(photoDimensions(3000,4000,true),{width:1536,height:2048});
  assert.deepEqual(photoDimensions(600,800),{width:600,height:800});
});
test('dated Lite pricing includes thinking/cache and preserves historical Flash prices',()=>{
  assert.equal(modelPricing(DEFAULT_MODEL,'2026-11-11'),null);
  const lite=modelPricing(DEFAULT_MODEL,'2026-11-12');assert.equal(lite.input,.3);assert.equal(lite.output,2.5);
  assert.ok(Math.abs(estimatedCost({promptTokenCount:4500,candidatesTokenCount:1400,thoughtsTokenCount:200},lite)-.00535)<1e-12);
  assert.equal(modelPricing('gemini-3.8-flash','2026-11-11').input,1.5);
  assert.equal(modelPricing('gemini-3.8-flash','2026-11-12').input,.75);
  assert.equal(modelPricing('gemini-3.8-flash','2027-01-01').input,1.5);
});
test('admin reports HUF planning rate and cumulative meal costs including failed and unknown attempts',async t=>{
  const db=openDatabase(':memory:');t.after(()=>db.close());const now=new Date().toISOString();
  await db.prepare('INSERT INTO users(id,google_sub,email,name,created_at,updated_at) VALUES(?,?,?,?,?,?)').bind('owner','owner','thisisnotka@gmail.com','Owner',now,now).run();
  for(const [id,state,cost] of [['first','completed',.003],['retry','failed',.002],['unknown','interrupted',null]]){
    await db.prepare('INSERT INTO ai_requests(id,meal_id,user_id,model,state,cost_usd,created_at) VALUES(?,?,?,?,?,?,?)').bind(id,'same-meal','owner',DEFAULT_MODEL,state,cost,now).run();
  }
  const get=env=>adminApi(new Request('http://localhost/api/admin/costs?days=7'),{db,env,userId:'owner'});
  const report=await(await get({AI_USD_HUF:'350'})).json();
  assert.equal(report.usdHuf,350);assert.equal(Number(report.summary.requests),3);assert.equal(Number(report.summary.failed_requests),2);
  assert.deepEqual(report.mealCosts,[{meal_id:'same-meal',requests:3,priced_requests:2,cost:.005}]);
  assert.equal((await(await get({AI_USD_HUF:'Infinity'})).json()).usdHuf,328.16);
});
