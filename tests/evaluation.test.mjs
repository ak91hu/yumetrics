import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync,readFileSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import {loadCases,evaluationSummary,evaluationPrediction} from '../scripts/evaluate-nutrition.mjs';
import {secondImage} from './fixtures.mjs';
test('evaluation keeps failed cases visible and reports absolute error and bias, not fake accuracy percentages',()=>{
  const reference={calories:100,protein:10,carbs:0,fat:5,fiber:null,edibleWeightG:200};
  const rows=[{mode:'photo_only',group:'fozelek',reference,predicted:{...reference,calories:120,protein:8}},{mode:'photo_only',group:'fozelek',reference,error:'rejected'},{mode:'with_context',group:'fozelek',reference,predicted:{...reference,calories:90}}];
  const result=evaluationSummary(rows);assert.equal(result.photo_only.attempted,2);assert.equal(result.photo_only.rejected,1);assert.equal(result.photo_only.errors.calories.mae,20);assert.equal(result.photo_only.errors.protein.bias,-2);assert.equal(result.with_context.errors.calories.bias,-10);assert.equal(result.photo_only.errors.fiber.n,0);assert.equal(result.photo_only.errors.fiber.mae,null);
});
test('benchmark includes rejected requests in cost and token totals without treating missing billing as free',()=>{
  const base={mode:'photo_only',group:'generic',reference:{},error:'rejected'};
  const usage={promptTokenCount:100,candidatesTokenCount:20,thoughtsTokenCount:10,cachedContentTokenCount:30,cost:.002};
  const rows=[{...base,providerResponse:{usage}},{...base,providerResponse:{usage:{...usage,cost:.003}}}];
  const result=evaluationSummary(rows).photo_only;
  assert.equal(result.rejected,2);assert.equal(result.billing.totalCostUsd,.005);
  assert.deepEqual(result.tokens,{recordedRequests:2,input:200,output:40,thoughts:20,cached:60});
  rows.push(base);const partial=evaluationSummary(rows).photo_only;
  assert.equal(partial.billing.totalCostUsd,null);assert.equal(partial.billing.knownCostUsd,.005);assert.equal(partial.billing.pricedRequests,2);
  assert.equal(evaluationSummary([base]).photo_only.tokens.input,null);
});

test('benchmark compares total and available carbohydrates on the same basis without inventing missing fibre',()=>{
  const analysis={ingredients:[{name:'Test food',grams:200,quantityUnit:'g',calories:100,protein:5,carbs:15,fat:2,fiber:3,sugar:5,sodium:10}]};
  assert.equal(evaluationPrediction(analysis,{}).carbs,30);
  assert.equal(evaluationPrediction(analysis,{carbohydrateBasis:'total_including_fiber'}).carbs,36);
  assert.equal(analysis.ingredients[0].carbs,15);
  const unknown={ingredients:[{...analysis.ingredients[0],fiber:null}]};
  assert.equal(evaluationPrediction(unknown,{carbohydrateBasis:'total_including_fiber'}).carbs,null);
});
test('benchmark input requires reference provenance, existing local images and independent measured targets',t=>{
  const directory=mkdtempSync(resolve('.test-data-evaluation-'));t.after(()=>rmSync(directory,{recursive:true,force:true}));
  writeFileSync(resolve(directory,'meal.jpg'),Buffer.concat([Buffer.from([255,216,255,224]),Buffer.alloc(200)]));
  writeFileSync(resolve(directory,'meal-angle.jpg'),Buffer.from(secondImage.split(',')[1],'base64'));
  const item={id:'fozelek-01',group:'fozelek',image:'meal.jpg',secondImage:'meal-angle.jpg',context:{dishProfile:'fozelek'},reference:{measured:true,method:'weighed_recipe',provenance:'Software fixture; not a measured real meal.',edibleWeightG:200,calories:200,protein:10,carbs:20,fat:9}};
  const path=resolve(directory,'cases.json'),save=cases=>writeFileSync(path,JSON.stringify({cases}));save([item]);assert.equal(loadCases(path).length,1);
  save([{...item,reference:{...item.reference,method:'weighed_components',carbohydrateBasis:'total_including_fiber'}}]);assert.equal(loadCases(path)[0].reference.method,'weighed_components');assert.equal(loadCases(path)[0].reference.carbohydrateBasis,'total_including_fiber');save([item]);
  const script=fileURLToPath(new URL('../scripts/evaluate-nutrition.mjs',import.meta.url));
  const dryRun=spawnSync(process.execPath,[script,path],{cwd:directory,env:{...process.env,OPENCODE_API_KEY:''},encoding:'utf8',windowsHide:true});assert.equal(dryRun.status,0);assert.ok(dryRun.stdout.includes('Nem történt AI-hívás'));
  const missingKey=spawnSync(process.execPath,[script,path,'--run'],{cwd:directory,env:{...process.env,OPENCODE_API_KEY:''},encoding:'utf8',windowsHide:true});assert.equal(missingKey.status,1);assert.ok(missingKey.stderr.includes('OPENCODE_API_KEY szükséges'));
  const provider=resolve(directory,'mock-provider.mjs');
  writeFileSync(provider,`import {aiPayloadFor} from ${JSON.stringify(new URL('./fixtures.mjs',import.meta.url).href)};
    let calls=0;
    globalThis.fetch=async(url,request)=>{if(!url.startsWith('https://opencode.ai/'))throw Error('Unexpected test network request');const payload=aiPayloadFor({name:'Software fixture',confidence:'medium',assumptions:'Not a measured food',ingredients:[{name:'Fixture ingredient',grams:100,calories:100,protein:5,carbs:10,fat:4,fiber:1,sugar:1,sodium:10}]},request);payload.usageMetadata={cost:0.03};if(++calls===2){const raw=JSON.parse(payload.candidates[0].content.parts[0].text);raw.viewCheck.sameMeal=false;payload.candidates[0].content.parts[0].text=JSON.stringify(raw);}return Response.json(payload);};`);
  writeFileSync(resolve(directory,'.env'),'OPENCODE_MODEL=unused-local-model\n');
  const simulated=spawnSync(process.execPath,['--import',pathToFileURL(provider).href,script,path,'--run'],{cwd:directory,env:{...process.env,OPENCODE_API_KEY:'test-only',OPENCODE_MODEL:'gemini-3.8-flash'},encoding:'utf8',windowsHide:true});assert.equal(simulated.status,0,simulated.stderr);
  const results=readdirSync(resolve(directory,'outputs'));assert.equal(results.length,1);assert.ok(results[0].endsWith('.json'));
  const report=JSON.parse(readFileSync(resolve(directory,'outputs',results[0]),'utf8'));assert.equal(report.complete,true);assert.equal(report.planned,2);assert.equal(report.rows.length,2);assert.equal(report.summary.photo_only.errors.calories.mae,100);assert.equal(report.referenceCount,44);assert.match(report.referenceCatalogSha256,/^[a-f0-9]{64}$/);
  assert.equal(report.summary.with_context.rejected,1);assert.equal(report.rows[1].providerResponse.usage.cost,0.03);assert.equal(report.rows[1].providerResponse.httpStatus,200);assert.ok(report.rows[1].providerResponse.latencyMs>=0);
  assert.equal(report.model,'gemini-3.8-flash','Explicit environment overrides a local .env model during comparisons');
  for(const invalid of [{...item,secondImage:undefined},{...item,secondImage:item.image},{...item,image:'../outside.jpg'},{...item,reference:{...item.reference,measured:false}},{...item,reference:{...item.reference,method:'ai'}},{...item,reference:{...item.reference,carbohydrateBasis:'unknown'}},{...item,reference:{...item.reference,calories:NaN}}]){save([invalid]);assert.throws(()=>loadCases(path));}
  save([item,item]);assert.throws(()=>loadCases(path));
});
