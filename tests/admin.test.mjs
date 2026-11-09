import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { createApp, openDatabase } from '../server.mjs';
import { openPostgresDatabase } from '../lib/database.mjs';
import { tokenHash } from '../lib/auth.mjs';
import { processNextJob } from '../lib/jobs.mjs';
import { secondImage, testGoogleClient, aiPayloadFor } from './fixtures.mjs';

const image='data:image/jpeg;base64,'+Buffer.concat([Buffer.from([255,216,255,224]),Buffer.alloc(200)]).toString('base64');
for (const dialect of ['sqlite','postgres']) {
  const run=(name,fn)=>test(`${dialect}: admin ${name}`,{skip:dialect==='postgres'&&!process.env.TEST_ADMIN_DATABASE_URL},async t=>{
    if(dialect==='postgres')assert.ok(new URL(process.env.TEST_ADMIN_DATABASE_URL).pathname.endsWith('_admin_test'),'Use a dedicated admin test database');
    const db=dialect==='postgres'?await openPostgresDatabase(process.env.TEST_ADMIN_DATABASE_URL):openDatabase(':memory:');
    const env={GOOGLE_CLIENT_ID:'test-client',GOOGLE_CLIENT_SECRET:'private-google-secret',OPENCODE_API_KEY:'private-ai-key',CLOUDINARY_CLOUD_NAME:'test-cloud',CLOUDINARY_API_KEY:'private-photo-key',CLOUDINARY_API_SECRET:'private-photo-secret'};
    const owner=randomUUID(),other=randomUUID(),cookies={},time=new Date().toISOString(),calls=[];
    for(const [id,email] of [[owner,'thisisnotka@gmail.com'],[other,'other@example.test']]){
      await db.prepare('INSERT INTO users(id,google_sub,email,name,created_at,updated_at) VALUES(?,?,?,?,?,?)').bind(id,id,email,'Akos Kovacs',time,time).run();
      const token=randomBytes(32).toString('hex');cookies[id]='yumetrics_session='+token;
      await db.prepare('INSERT INTO sessions(token_hash,user_id,expires_at,created_at) VALUES(?,?,?,?)').bind(tokenHash(token),id,new Date(Date.now()+3600000).toISOString(),time).run();
    }
    const googleClient=testGoogleClient(), analysis={name:'Test meal',confidence:'medium',assumptions:'Test',ingredients:[{name:'Test',grams:100,calories:200,protein:25,carbs:0,fat:11,fiber:0,sugar:0,sodium:70}]};
    const fetcher=async(url,options)=>{
      calls.push({url,options});
      if(url.startsWith('https://res.cloudinary.com/'))return new Response(Buffer.from((url.includes('-angle')?secondImage:image).split(',')[1],'base64'),{headers:{'Content-Type':'image/jpeg'}});
      if(url.endsWith('/upload'))return Response.json({public_id:options.body.get('public_id'),secure_url:`https://res.cloudinary.com/test-cloud/image/authenticated/v1/${options.body.get('public_id')}.jpg`,width:100,height:80});
      return Response.json(aiPayloadFor(analysis,options));
    };
    const server=createApp({db,env,fetcher,googleClient});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    const origin=`http://127.0.0.1:${server.address().port}`;env.APP_ORIGIN=origin;googleClient.callbackOrigin=origin;
    t.after(async()=>{await new Promise(resolve=>server.close(resolve));await db.prepare('DELETE FROM admin_audit WHERE actor_id=?').bind(owner).run();for(const id of [owner,other]){await db.prepare('DELETE FROM app_logs WHERE user_id=?').bind(id).run();await db.prepare('DELETE FROM ai_requests WHERE user_id=?').bind(id).run();await db.prepare('DELETE FROM meals WHERE user_id=?').bind(id).run();await db.prepare('DELETE FROM analysis_attempts WHERE user_id=?').bind(id).run();await db.prepare('DELETE FROM users WHERE id=?').bind(id).run();}await db.prepare("UPDATE app_settings SET value='{}',revision=0 WHERE id=1").bind().run();await db.close();});
    const call=(path,{id=owner,method='GET',body,headers={}}={})=>fetch(origin+path,{method,headers:{...(id?{Cookie:cookies[id]}:{}),...(body?{'Content-Type':'application/json'}:{}),...headers},...(body?{body:JSON.stringify(body)}:{})});
    const settings=async()=> (await call('/api/admin/settings')).json();
    const save=async changes=>{const value=await settings();return call('/api/admin/settings',{method:'PATCH',body:{revision:value.revision,settings:{...value.settings,...changes}}});};
    const login=async()=>{const first=await fetch(origin+'/auth/google',{redirect:'manual'}),cookie=first.headers.getSetCookie()[0].split(';')[0];return fetch(first.headers.get('location'),{redirect:'manual',headers:{Cookie:cookie}});};
    await fn({db,env,owner,other,cookies,call,settings,save,login,googleClient,calls,fetcher});
  });
  run('protects every private route and hides provider configuration from ordinary users',async f=>{
    for(const path of ['/admin','/admin.html','/api/admin/settings','/api/admin/overview','/api/admin/visitors','/api/admin/users','/api/admin/meals','/api/admin/jobs','/api/admin/audit','/api/admin/logs','/api/admin/costs']){
      assert.equal((await f.call(path,{id:null})).status,401,path);
      assert.equal((await f.call(path,{id:f.other})).status,403,path);
      assert.equal((await f.call(path)).status,200,path);
    }
    assert.equal((await f.call('/admin',{id:f.other,method:'HEAD'})).status,403);
    assert.equal((await f.call('/api/admin/settings',{id:null,headers:{'oai-authenticated-user-id':f.owner,'x-user-email':'thisisnotka@gmail.com'}})).status,401);
    const status=await(await f.call('/api/status',{id:f.other})).json();assert.deepEqual(Object.keys(status),['user']);assert.equal(status.user.admin,false);
    const html=await(await f.call('/',{id:f.other})).text();assert.ok(!html.includes('connection-status'));assert.ok(!html.includes('Külső szolgáltatások'));
    const authStatus=await(await f.call('/api/auth-status',{id:null})).json();assert.deepEqual(Object.keys(authStatus),['configured']);
    const admin=JSON.stringify(await f.settings());for(const secret of ['private-google-secret','private-ai-key','private-photo-key','private-photo-secret'])assert.ok(!admin.includes(secret));
    delete f.env.OPENCODE_API_KEY;
    const unavailable=await f.call('/api/analyze',{id:f.other,method:'POST',body:{id:randomUUID(),image,secondImage,day:'2026-11-09',time:'12:00',type:'Ebéd'}});
    assert.equal(unavailable.status,503);assert.ok(!(await unavailable.text()).includes('OpenCode'));
    for(const headers of [{Origin:'https://evil.test'},{'Sec-Fetch-Site':'cross-site'}])assert.equal((await f.call('/api/admin/settings',{method:'PATCH',body:{},headers})).status,403);
    const original=f.googleClient.verifyIdToken;f.googleClient.verifyIdToken=async options=>{const ticket=await original(options);return{getPayload:()=>({...ticket.getPayload(),email:'thisisnotka@gmail.com',email_verified:false})};};
    const denied=await f.login();assert.equal(denied.headers.get('location'),'/?login=failed');assert.ok(!denied.headers.getSetCookie().some(cookie=>cookie.startsWith('yumetrics_session=')));
  });
  run('keeps costs from rejected AI responses after meal deletion and exposes only safe operational logs',async f=>{
    const id=randomUUID(),body={id,image,secondImage,day:'2026-11-09',time:'12:00',type:'Ebéd'};
    assert.equal((await f.call('/api/analyze',{id:f.other,method:'POST',body})).status,202);
    await processNextJob({db:f.db,env:f.env,fetcher:async(url,options)=>url.startsWith('https://opencode.ai/')?Response.json({candidates:[{finishReason:'MAX_TOKENS',content:{parts:[]}}],usageMetadata:{promptTokenCount:1000,candidatesTokenCount:5,thoughtsTokenCount:100,cachedContentTokenCount:400,privateField:'never-log-this'}}):f.fetcher(url,options)});
    const row=await f.db.prepare('SELECT * FROM ai_requests WHERE meal_id=?').bind(id).first();
    assert.equal(row.state,'failed');assert.equal(Number(row.http_status),200);assert.ok(Math.abs(row.cost_usd-.00229)<1e-12);assert.ok(!row.usage.includes('never-log-this'));
    const ordinary=await(await f.call('/api/meals/'+id,{id:f.other})).json();assert.equal(ordinary.meal.job.error,undefined);assert.ok(!JSON.stringify(ordinary).includes('cost_usd'));
    await f.db.prepare('DELETE FROM meals WHERE id=?').bind(id).run();
    const costs=await(await f.call('/api/admin/costs?days=7')).json();assert.equal(Number(costs.summary.requests),1);assert.equal(Number(costs.summary.priced_requests),1);assert.ok(Math.abs(costs.summary.estimated_usd-.00229)<1e-12);
    const logs=await(await f.call('/api/admin/logs?level=error')).json();assert.equal(logs.total,1);assert.equal(logs.items[0].level,'error');assert.ok(!JSON.stringify(logs).includes('private-ai-key'));
    assert.equal((await f.call('/api/admin/logs?level=invalid')).status,400);assert.equal((await f.call('/api/admin/costs?days=999')).status,400);
  });
  run('imports historical usage once, distinguishes missing usage and missing pricing, and preserves its cost snapshot',async f=>{
    const time=new Date().toISOString();
    for(const [model,usage] of [['gemini-4-argon',{promptTokenCount:1000,candidatesTokenCount:100}],['unverified',{promptTokenCount:1000,candidatesTokenCount:100}],['gemini-4-argon',{}]]){
      await f.db.prepare('INSERT INTO meals(id,user_id,day,time,type,public_id,status,model,usage,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind(randomUUID(),f.other,time.slice(0,10),'12:00','Ebéd','test','draft',model,JSON.stringify(usage),time,time).run();
    }
    for(let i=0;i<2;i++){const costs=await(await f.call('/api/admin/costs')).json();assert.equal(Number(costs.summary.requests),3);assert.equal(Number(costs.summary.priced_requests),1);assert.ok(Math.abs(costs.summary.estimated_usd-.003)<1e-12);assert.equal(costs.items.length,3);}
    const known=await f.db.prepare('SELECT * FROM ai_requests WHERE cost_usd IS NOT NULL AND user_id=?').bind(f.other).first();assert.equal(JSON.parse(known.pricing).input,2);
  });
  run('counts only eligible page views and returns private aggregate visitor reports with a working pause switch',async f=>{
    await f.db.prepare('DELETE FROM visitor_stats').bind().run();
    try {
      f.env.NODE_ENV='production';
      const headers={'Sec-Fetch-Dest':'document','User-Agent':'Mozilla/5.0 (Windows NT 10.0) Chrome/142.0 Safari/537.36','X-Envoy-External-Address':'84.2.44.1',Referer:'https://www.google.com/?q=private-meal-name&code=secret-code'};
      assert.equal((await f.call('/',{id:null,headers})).status,200);
      assert.equal((await f.call('/',{id:f.other,headers})).status,200);
      assert.equal((await f.call('/guide',{id:null,headers})).status,200);
      for(const [path,id,extra,method]of[['/',f.owner,{},'GET'],['/',null,{DNT:'1'},'GET'],['/',null,{'Sec-GPC':'1'},'GET'],['/',null,{'User-Agent':'Googlebot'},'GET'],['/',null,{},'HEAD'],['/styles.css',null,{},'GET'],['/admin',f.other,{},'GET']])await f.call(path,{id,headers:{...headers,...extra},method});
      const report=await(await f.call('/api/admin/visitors?days=7')).json();
      assert.equal(report.total,3);assert.equal(report.todayViews,3);assert.equal(report.enabled,true);assert.equal(report.breakdowns.country[0].value,'HU');assert.equal(report.breakdowns.country[0].views,3);assert.equal(report.breakdowns.page.length,3);
      const raw=JSON.stringify(report);for(const secret of ['84.2.44.1','private-meal-name','secret-code',f.other,'other@example.test'])assert.ok(!raw.includes(secret));
      assert.equal((await f.call('/api/admin/visitors?days=99999')).status,400);
      assert.equal((await f.save({visitorStatsEnabled:'false'})).status,400);
      assert.equal((await f.save({visitorStatsEnabled:false})).status,200);
      await f.call('/',{id:null,headers});
      const paused=await(await f.call('/api/admin/visitors')).json();assert.equal(paused.enabled,false);assert.equal(paused.total,3);
      await f.save({visitorStatsEnabled:true});await f.call('/',{id:null,headers});
      assert.equal((await(await f.call('/api/admin/visitors')).json()).total,4);
      const [during,...responses]=await Promise.all([f.call('/api/admin/visitors'),...Array.from({length:12},()=>f.call('/',{id:null,headers}))]);
      assert.ok(responses.every(response=>response.status===200));const snapshot=await during.json();for(const rows of Object.values(snapshot.breakdowns))assert.equal(rows.reduce((sum,row)=>sum+row.views,0),snapshot.total);
      const concurrent=await(await f.call('/api/admin/visitors')).json();assert.equal(concurrent.total,16);for(const rows of Object.values(concurrent.breakdowns))assert.equal(rows.reduce((sum,row)=>sum+row.views,0),16);
    } finally { await f.db.prepare('DELETE FROM visitor_stats').bind().run(); }
  });
  run('validates persisted settings, rejects stale edits, and applies real analysis limits and AI parameters',async f=>{
    const initial=await f.settings();
    for(const changes of [{hourlyLimit:0},{hourlyLimit:100,dailyLimit:5},{aiTimeoutSeconds:76},{model:'../../secret'},{registrationEnabled:'false'},{unknown:'value'}])assert.equal((await f.save(changes)).status,400);
    assert.equal((await f.save({hourlyLimit:1,dailyLimit:2,model:'gemini-4-argon',maxOutputTokens:12000,aiTimeoutSeconds:60})).status,200);
    assert.equal((await f.call('/api/admin/settings',{method:'PATCH',body:{revision:initial.revision,settings:initial.settings}})).status,409);
    const payload=()=>({id:randomUUID(),image,secondImage,day:'2026-11-09',time:'12:00',type:'Ebéd'});
    const first=payload();assert.equal((await f.call('/api/analyze',{id:f.other,method:'POST',body:first})).status,202);
    assert.equal((await f.call('/api/analyze',{id:f.other,method:'POST',body:payload()})).status,429);
    await processNextJob({db:f.db,env:f.env,fetcher:f.fetcher});
    const ai=f.calls.find(call=>call.url.startsWith('https://opencode.ai/'));assert.ok(ai);assert.equal(JSON.parse(ai.options.body).generationConfig.maxOutputTokens,12000);assert.ok(ai.url.includes('/gemini-4-argon:generateContent'));
    await f.save({analysesEnabled:false});const count=f.calls.length;assert.equal((await f.call('/api/analyze',{method:'POST',body:payload()})).status,503);assert.equal(f.calls.length,count);
    const audit=await(await f.call('/api/admin/audit')).json();assert.equal(audit.total,2);assert.ok(audit.items.every(row=>row.action==='settings.update'));
  });
  run('reports cross-account activity, precise token totals, filtering, and bounded pagination',async f=>{
    const time=new Date().toISOString();
    for(const [i,user] of [[1,f.owner],[2,f.other]]){
      await f.db.prepare('INSERT INTO meals(id,user_id,day,time,type,public_id,status,usage,latency_ms,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind(randomUUID(),user,time.slice(0,10),'12:00','Ebéd','test','draft',JSON.stringify({passes:[{promptTokenCount:100*i,candidatesTokenCount:50*i,cachedContentTokenCount:10,thoughtsTokenCount:3}]}),1000*i,time,time).run();
    }
    const data=await(await f.call('/api/admin/overview?days=7')).json();assert.equal(Number(data.activity.active_users),2);assert.equal(Number(data.tokens.input_tokens),300);assert.equal(Number(data.tokens.output_tokens),150);assert.equal(Number(data.tokens.cached_tokens),20);assert.equal(Number(data.tokens.thought_tokens),6);assert.equal(Number(data.activity.average_latency_ms),1500);assert.equal(Number(data.daily[0].meals),2);
    assert.equal((await f.call('/api/admin/overview?days=99999')).status,400);
    const meals=await(await f.call('/api/admin/meals?userId='+f.other)).json();assert.equal(meals.total,1);assert.equal(meals.items[0].email,'other@example.test');
    assert.equal((await f.call('/api/admin/meals/'+meals.items[0].id,{id:f.other})).status,403);
    const detail=await(await f.call('/api/admin/meals/'+meals.items[0].id)).json();assert.ok(detail.meal.usage.passes);
    assert.equal((await f.call('/api/admin/users?page=-1')).status,400);assert.equal((await f.call('/api/admin/users?q='+encodeURIComponent("' OR 1=1 --"))).status,200);
    const users=await(await f.call('/api/admin/users?q=other')).json();assert.equal(users.total,1);assert.ok(!JSON.stringify(users).includes('token_hash'));assert.ok(!JSON.stringify(users).includes('google_sub'));
  });
  run('blocks users, revokes sessions, protects the owner, and applies registration defaults without deleting records',async f=>{
    assert.equal((await f.call('/api/admin/users/'+f.owner,{method:'PATCH',body:{blocked:true,calorieGoal:2000}})).status,403);
    assert.equal((await f.call('/api/admin/users/'+f.other,{id:f.other,method:'PATCH',body:{blocked:false,calorieGoal:2500}})).status,403);
    assert.equal((await f.call('/api/admin/users/'+f.other,{method:'PATCH',body:{blocked:true,calorieGoal:2500}})).status,200);
    assert.equal((await f.call('/api/status',{id:f.other})).status,401);assert.ok(await f.db.prepare('SELECT id FROM users WHERE id=?').bind(f.other).first());
    const verify=f.googleClient.verifyIdToken;
    f.googleClient.verifyIdToken=async options=>{const ticket=await verify(options);return{getPayload:()=>({...ticket.getPayload(),sub:f.other,email:'other@example.test'})};};
    assert.equal((await f.login()).headers.get('location'),'/?login=failed');f.googleClient.verifyIdToken=verify;
    await f.call('/api/admin/users/'+f.other,{method:'PATCH',body:{blocked:false,calorieGoal:2500}});
    assert.equal((await f.call('/api/admin/users/'+f.other,{method:'PATCH',body:{blocked:false,calorieGoal:2500,email:'thisisnotka@gmail.com'}})).status,400);
    assert.equal((await f.call('/api/admin/users/'+f.other+'/revoke-sessions',{method:'POST'})).status,200);
    await f.save({registrationEnabled:false});assert.equal((await f.login()).headers.get('location'),'/?login=failed');
    await f.save({registrationEnabled:true,defaultCalorieGoal:2400});const signedIn=await f.login();assert.equal(signedIn.headers.get('location'),'/');
    const created=await f.db.prepare('SELECT id,calorie_goal FROM users WHERE google_sub=?').bind('google-user-1').first();assert.equal(Number(created.calorie_goal),2400);
    await f.db.prepare('DELETE FROM users WHERE id=?').bind(created.id).run();
    const audit=await(await f.call('/api/admin/audit')).json();assert.equal(audit.total,5);
  });
}
