import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { openPostgresDatabase } from '../lib/database.mjs';
import { currentUser, tokenHash } from '../lib/auth.mjs';
import { processNextJob } from '../lib/jobs.mjs';
import { api } from '../lib/api.mjs';
import { userProfile } from '../lib/profile-stats.mjs';
import { secondImage, aiPayloadFor } from './fixtures.mjs';

const connection = process.env.TEST_DATABASE_URL;
const image = 'data:image/jpeg;base64,'+Buffer.concat([Buffer.from([255,216,255,224]),Buffer.alloc(200)]).toString('base64');
const env={OPENCODE_API_KEY:'test',CLOUDINARY_CLOUD_NAME:'test-cloud',CLOUDINARY_API_KEY:'test',CLOUDINARY_API_SECRET:'test'};
const analysis={name:'Teszt',confidence:'medium',assumptions:'Teszt',ingredients:[{name:'Hús',grams:100,calories:200,protein:25,carbs:0,fat:11,fiber:0,sugar:0,sodium:70}]};
const fetcher=async(url,options)=>url.startsWith('https://res.cloudinary.com/')?new Response(Buffer.from((url.includes('-angle')?secondImage:image).split(',')[1],'base64'),{headers:{'Content-Type':'image/jpeg'}}):url.endsWith('/upload')?Response.json({public_id:options.body.get('public_id'),secure_url:`https://res.cloudinary.com/test-cloud/image/authenticated/v1/${options.body.get('public_id')}.jpg`,width:100,height:80}):url.endsWith('/destroy')?Response.json({result:'ok'}):Response.json(aiPayloadFor(analysis,options));
async function seed(db,id) {const now=new Date().toISOString();await db.prepare('INSERT INTO users(id,google_sub,email,name,created_at,updated_at) VALUES(?,?,?,?,?,?)').bind(id,id,'test@example.test','Test',now,now).run();}
async function cleanup(db,id){await db.prepare('DELETE FROM meals WHERE user_id=?').bind(id).run();await db.prepare('DELETE FROM analysis_attempts WHERE user_id=?').bind(id).run();await db.prepare('DELETE FROM users WHERE id=?').bind(id).run();}
function invoke(db,userId,path,method='GET',payload,provider=fetcher){return api(new Request('http://localhost'+path,{method,headers:payload?{'Content-Type':'application/json'}:{},...(payload?{body:JSON.stringify(payload)}:{})}),{db,env,userId,fetcher:provider});}
const input=()=>({id:randomUUID(),image,secondImage,day:'2026-11-07',time:'12:30',type:'Ebéd',notes:''});
async function eventually(fn){const end=Date.now()+12000;do{const result=await fn();if(result)return result;await new Promise(resolve=>setTimeout(resolve,80));}while(Date.now()<end);assert.fail('Timed out waiting for persisted state');}

test('PostgreSQL: real process replacement retains Google session, profile, queued/saved meals and deletion', {skip:!connection,timeout:45000}, async t=>{
  const db=await openPostgresDatabase(connection), sub='restart-'+randomUUID(), children=new Set();let owner;
  async function start(runner){const child=fork(new URL('./server-fixture.mjs',import.meta.url),{env:{...process.env,TEST_DATABASE_URL:connection,TEST_GOOGLE_SUB:sub,TEST_RUNNER:runner?'yes':'no'},windowsHide:true,stdio:['ignore','ignore','pipe','ipc']});children.add(child);let logs='';child.stderr.on('data',chunk=>logs+=chunk);const origin=await Promise.race([once(child,'message').then(([m])=>m.origin),once(child,'exit').then(([code])=>{throw Error('Test server exited: '+code+' '+logs)})]);return {child,origin};}
  async function kill(child){const exited=once(child,'exit');child.kill('SIGKILL');await exited;children.delete(child);}
  t.after(async()=>{for(const child of children)await kill(child);if(owner)await cleanup(db,owner);await db.close();});
  let app=await start(false);
  const begin=await fetch(app.origin+'/auth/google',{redirect:'manual'}), callback=begin.headers.get('location');
  const signedIn=await fetch(callback,{headers:{Cookie:begin.headers.get('set-cookie').split(';')[0]},redirect:'manual'});
  const cookie=signedIn.headers.getSetCookie().find(v=>v.startsWith('yumetrics_session=')).split(';')[0];
  owner=(await db.prepare('SELECT id FROM users WHERE google_sub=?').bind(sub).first()).id;
  const headers={Cookie:cookie,'Content-Type':'application/json'};
  assert.equal((await fetch(app.origin+'/api/profile',{method:'PATCH',headers,body:JSON.stringify({calorieGoal:2400})})).status,200);
  const meal={...input(),context:{language:'en'}};const queued=await fetch(app.origin+'/api/analyze',{method:'POST',headers,body:JSON.stringify(meal)});assert.equal(queued.status,202);assert.equal((await queued.json()).meal.status,'analyzing');
  await kill(app.child);app=await start(true);
  assert.equal((await(await fetch(app.origin+'/api/status',{headers})).json()).user.calorieGoal,2400);
  const draft=await eventually(async()=>{const row=await(await fetch(app.origin+'/api/meals/'+meal.id,{headers})).json();return row.meal?.status==='draft'&&row.meal;});
  assert.equal(draft.totals.calories,300);assert.ok(draft.photo.url.startsWith('/api/meals/'));
  assert.equal(draft.context.language,'en');
  draft.analysis.recipe={cookedWeightG:600,eatenWeightG:150,lossesAccountedFor:true,ingredients:draft.analysis.ingredients.map(item=>({...item,grams:400,gramsMin:400,gramsMax:400}))};
  assert.equal((await fetch(app.origin+'/api/meals/'+meal.id,{method:'PATCH',headers,body:JSON.stringify(draft)})).status,200);
  await kill(app.child);app=await start(false);
  const saved=await(await fetch(app.origin+'/api/meals/'+meal.id,{headers})).json();assert.equal(saved.meal.status,'saved');assert.equal(saved.meal.totals.calories,200);
  assert.equal(saved.meal.analysis.recipe.ingredients[0].grams,400);assert.equal(saved.meal.analysis.ingredients[0].grams,100);assert.equal(saved.meal.report.weight,150);
  assert.equal(saved.meal.context.language,'en');
  const profile=await userProfile(db,owner,'Europe/Budapest',new Date('2026-11-08T12:00:00Z'));
  assert.equal(profile.profile.calorieGoal,2400);
  assert.equal(profile.statistics.periods[7].mealCount,1);
  assert.equal(profile.statistics.periods[7].averagePerMeal.calories,200);
  assert.deepEqual(profile.statistics.periods[7].mealTypes.find(row=>row.type==='Ebéd'),{type:'Ebéd',count:1,averageCalories:200});
  assert.equal(profile.statistics.motivation.activeDays,1);
  assert.equal(profile.statistics.motivation.badges.find(badge=>badge.id==='first').earned,true);
  assert.equal(profile.statistics.motivation.weekly.activeDays,1);
  assert.equal(JSON.parse((await db.prepare('SELECT original_analysis FROM meals WHERE id=?').bind(meal.id).first()).original_analysis).ingredients[0].grams,150);
  assert.equal((await fetch(app.origin+'/api/meals/'+meal.id,{method:'DELETE',headers})).status,202);
  await kill(app.child);app=await start(true);
  await eventually(async()=>(await fetch(app.origin+'/api/meals/'+meal.id,{headers})).status===404);
  assert.ok(await currentUser(new Request('http://localhost',{headers:{Cookie:cookie}}),db));
});

test('PostgreSQL: expired analyses require an explicit retry and stale workers cannot commit', {skip:!connection,timeout:20000},async t=>{
  const db=await openPostgresDatabase(connection),other=await openPostgresDatabase(connection),owner=randomUUID();await seed(db,owner);
  t.after(async()=>{await cleanup(db,owner);await db.close();await other.close();});
  const meal=input();assert.equal((await invoke(db,owner,'/api/analyze','POST',meal)).status,202);
  let resume,started;const began=new Promise(resolve=>started=resolve),pause=new Promise(resolve=>resume=resolve);let first=true;
  const slow=async(url,options)=>{if(url.startsWith('https://opencode.ai/')){if(first){first=false;started();await pause;}return Response.json(aiPayloadFor({...analysis,name:'Stale result'},options));}return fetcher(url,options);};
  const stale=processNextJob({db,env,fetcher:slow});await began;
  await other.prepare('UPDATE analysis_jobs SET lease_until=? WHERE meal_id=?').bind('2000-01-01T00:00:00.000Z',meal.id).run();
  assert.equal(await processNextJob({db:other,env,fetcher}),false);resume();await stale;
  const interrupted=await db.prepare('SELECT status,analysis FROM meals WHERE id=?').bind(meal.id).first();assert.equal(interrupted.status,'failed');assert.equal(interrupted.analysis,null);
  assert.equal((await db.prepare('SELECT attempts FROM analysis_jobs WHERE meal_id=?').bind(meal.id).first()).attempts,1);
  assert.equal((await invoke(db,owner,'/api/meals/'+meal.id+'/retry','POST')).status,202);
  assert.equal(await processNextJob({db:other,env,fetcher}),true);
  const row=await db.prepare('SELECT analysis,original_analysis FROM meals WHERE id=?').bind(meal.id).first();assert.equal(JSON.parse(row.analysis).name,'Teszt');assert.equal(row.analysis,row.original_analysis);
  assert.equal((await db.prepare('SELECT attempts FROM analysis_jobs WHERE meal_id=?').bind(meal.id).first()).attempts,1);
  assert.equal(await processNextJob({db,env,fetcher}),false);
});

test('PostgreSQL: concurrent account requests enforce one remaining paid-analysis allowance', {skip:!connection,timeout:20000},async t=>{
  const db=await openPostgresDatabase(connection),owner=randomUUID();await seed(db,owner);t.after(async()=>{await cleanup(db,owner);await db.close();});
  for(let i=0;i<19;i++)await db.prepare('INSERT INTO analysis_attempts VALUES(?,?,?)').bind(randomUUID(),owner,new Date().toISOString()).run();
  const results=await Promise.all(Array.from({length:3},()=>invoke(db,owner,'/api/analyze','POST',input())));assert.deepEqual(results.map(r=>r.status).sort(),[202,429,429]);
  assert.equal(Number((await db.prepare('SELECT COUNT(*) AS count FROM analysis_attempts WHERE user_id=?').bind(owner).first()).count),20);
});
