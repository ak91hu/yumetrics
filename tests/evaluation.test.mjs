import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync,readFileSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import {loadCases,evaluationSummary} from '../scripts/evaluate-nutrition.mjs';
import {secondImage} from './fixtures.mjs';
test('evaluation keeps failed cases visible and reports absolute error and bias, not fake accuracy percentages',()=>{
  const reference={calories:100,protein:10,carbs:0,fat:5,fiber:null,edibleWeightG:200};
  const rows=[{mode:'photo_only',group:'fozelek',reference,predicted:{...reference,calories:120,protein:8}},{mode:'photo_only',group:'fozelek',reference,error:'rejected'},{mode:'with_context',group:'fozelek',reference,predicted:{...reference,calories:90}}];
  const result=evaluationSummary(rows);assert.equal(result.photo_only.attempted,2);assert.equal(result.photo_only.rejected,1);assert.equal(result.photo_only.errors.calories.mae,20);assert.equal(result.photo_only.errors.protein.bias,-2);assert.equal(result.with_context.errors.calories.bias,-10);assert.equal(result.photo_only.errors.fiber.n,0);assert.equal(result.photo_only.errors.fiber.mae,null);
});
test('benchmark input requires reference provenance, existing local images and independent measured targets',t=>{
  const directory=mkdtempSync(resolve('.test-data-evaluation-'));t.after(()=>rmSync(directory,{recursive:true,force:true}));
  writeFileSync(resolve(directory,'meal.jpg'),Buffer.concat([Buffer.from([255,216,255,224]),Buffer.alloc(200)]));
  writeFileSync(resolve(directory,'meal-angle.jpg'),Buffer.from(secondImage.split(',')[1],'base64'));
  const item={id:'fozelek-01',group:'fozelek',image:'meal.jpg',secondImage:'meal-angle.jpg',context:{dishProfile:'fozelek'},reference:{measured:true,method:'weighed_recipe',provenance:'Software fixture; not a measured real meal.',edibleWeightG:200,calories:200,protein:10,carbs:20,fat:9}};
  const path=resolve(directory,'cases.json'),save=cases=>writeFileSync(path,JSON.stringify({cases}));save([item]);assert.equal(loadCases(path).length,1);
  const script=fileURLToPath(new URL('../scripts/evaluate-nutrition.mjs',import.meta.url));
  const dryRun=spawnSync(process.execPath,[script,path],{cwd:directory,env:{...process.env,OPENCODE_API_KEY:''},encoding:'utf8',windowsHide:true});assert.equal(dryRun.status,0);assert.ok(dryRun.stdout.includes('Nem történt AI-hívás'));
  const missingKey=spawnSync(process.execPath,[script,path,'--run'],{cwd:directory,env:{...process.env,OPENCODE_API_KEY:''},encoding:'utf8',windowsHide:true});assert.equal(missingKey.status,1);assert.ok(missingKey.stderr.includes('OPENCODE_API_KEY szükséges'));
  const provider=resolve(directory,'mock-provider.mjs');
  writeFileSync(provider,`import {aiPayloadFor} from ${JSON.stringify(new URL('./fixtures.mjs',import.meta.url).href)};
    globalThis.fetch=async(url,request)=>{if(!url.startsWith('https://opencode.ai/'))throw Error('Unexpected test network request');return Response.json(aiPayloadFor({name:'Software fixture',confidence:'medium',assumptions:'Not a measured food',ingredients:[{name:'Fixture ingredient',grams:100,calories:100,protein:5,carbs:10,fat:4,fiber:1,sugar:1,sodium:10}]},request));};`);
  const simulated=spawnSync(process.execPath,['--import',pathToFileURL(provider).href,script,path,'--run'],{cwd:directory,env:{...process.env,OPENCODE_API_KEY:'test-only'},encoding:'utf8',windowsHide:true});assert.equal(simulated.status,0,simulated.stderr);
  const results=readdirSync(resolve(directory,'outputs'));assert.equal(results.length,1);assert.ok(results[0].endsWith('.json'));
  const report=JSON.parse(readFileSync(resolve(directory,'outputs',results[0]),'utf8'));assert.equal(report.complete,true);assert.equal(report.planned,2);assert.equal(report.rows.length,2);assert.equal(report.summary.photo_only.errors.calories.mae,100);assert.equal(report.referenceCount,44);assert.match(report.referenceCatalogSha256,/^[a-f0-9]{64}$/);
  for(const invalid of [{...item,secondImage:undefined},{...item,secondImage:item.image},{...item,image:'../outside.jpg'},{...item,reference:{...item.reference,measured:false}},{...item,reference:{...item.reference,method:'ai'}},{...item,reference:{...item.reference,calories:NaN}}]){save([invalid]);assert.throws(()=>loadCases(path));}
  save([item,item]);assert.throws(()=>loadCases(path));
});
