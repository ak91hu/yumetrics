import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { once } from 'node:events';
import { request as httpRequest } from 'node:http';
import { createApp, openDatabase } from '../server.mjs';
import { openPostgresDatabase } from '../lib/database.mjs';
import { tokenHash } from '../lib/auth.mjs';
import { requestLimit } from '../lib/request-limits.mjs';
import { storedPhotoData, secureStoredPhotos } from '../lib/photos.mjs';
import { cloudinary } from '../lib/providers.mjs';
import { testGoogleClient, secondImage } from './fixtures.mjs';

const image = 'data:image/jpeg;base64,' + Buffer.concat([Buffer.from([255,216,255,224]),Buffer.alloc(200)]).toString('base64');
const env = { CLOUDINARY_CLOUD_NAME:'test-cloud', CLOUDINARY_API_KEY:'test-key', CLOUDINARY_API_SECRET:'test-secret' };
const photoFor = (id, type='authenticated') => ({ publicId:'yumetrics/'+id, type, url:`https://res.cloudinary.com/test-cloud/image/${type}/v1/yumetrics/${id}.jpg`, width:10, height:10 });
async function account(db, email) {
  const id=randomUUID(), token=randomBytes(32).toString('hex'), time=new Date().toISOString();
  await db.prepare('INSERT INTO users(id,google_sub,email,name,created_at,updated_at) VALUES(?,?,?,?,?,?)').bind(id,id,email,'Security test',time,time).run();
  await db.prepare('INSERT INTO sessions(token_hash,user_id,expires_at,created_at) VALUES(?,?,?,?)').bind(tokenHash(token),id,new Date(Date.now()+3600000).toISOString(),time).run();
  return {id,cookie:'yumetrics_session='+token};
}
for (const dialect of ['sqlite','postgres']) {
  test(`${dialect}: photo bytes require the owner or admin; lists never expose provider URLs`, {skip:dialect==='postgres'&&!process.env.TEST_DATABASE_URL}, async t => {
    const db=dialect==='postgres'?await openPostgresDatabase(process.env.TEST_DATABASE_URL):openDatabase(':memory:');
    const owner=await account(db,'owner-'+randomUUID()+'@example.test'), other=await account(db,'other-'+randomUUID()+'@example.test'), admin=await account(db,'thisisnotka@gmail.com');
    const id=randomUUID(), time=new Date().toISOString(), photo=photoFor(id); photo.additional=photoFor(id+'-angle');
    await db.prepare('INSERT INTO meals(id,user_id,day,time,type,photo,public_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)').bind(id,owner.id,time.slice(0,10),'12:00','Ebéd',JSON.stringify(photo),photo.publicId,time,time).run();
    let calls=0;
    const fetcher=async(url,options)=>{calls++;assert.match(url,/\/image\/authenticated\/s--[\w-]{8}--\/v1\/yumetrics\//);assert.equal(options.redirect,'error');return new Response(Buffer.from(image.split(',')[1],'base64'),{headers:{'Content-Type':'image/jpeg'}});};
    const server=createApp({db,env,fetcher}); server.listen(0,'127.0.0.1');await once(server,'listening');
    t.after(async()=>{await new Promise(resolve=>server.close(resolve));await db.prepare('DELETE FROM meals WHERE id=?').bind(id).run();for(const user of [owner,other,admin])await db.prepare('DELETE FROM users WHERE id=?').bind(user.id).run();await db.close();});
    const origin=`http://127.0.0.1:${server.address().port}`;
    for(const view of ['primary','additional']) {
      const path=`/api/meals/${id}/photo/${view}`,before=calls;
      assert.equal((await fetch(origin+path)).status,401);
      assert.equal((await fetch(origin+path,{headers:{Cookie:other.cookie}})).status,404);assert.equal(calls,before);
      for(const user of [owner,admin]){
        const response=await fetch(origin+path,{headers:{Cookie:user.cookie}});assert.equal(response.status,200);
        assert.equal(response.headers.get('Cache-Control'),'private, no-store');assert.equal(response.headers.get('Cross-Origin-Resource-Policy'),'same-origin');
        assert.deepEqual(Buffer.from(await response.arrayBuffer()),Buffer.from(image.split(',')[1],'base64'));
      }
    }
    const meal=await(await fetch(origin+'/api/meals/'+id,{headers:{Cookie:owner.cookie}})).json();
    assert.equal(meal.meal.photo.url,`/api/meals/${id}/photo/primary`);assert.ok(!JSON.stringify(meal).includes('cloudinary.com'));
    const detail=await(await fetch(origin+'/api/admin/meals/'+id,{headers:{Cookie:admin.cookie}})).json();assert.ok(!JSON.stringify(detail).includes('cloudinary.com'));
    await db.prepare('UPDATE users SET blocked=1 WHERE id=?').bind(owner.id).run();
    assert.equal((await fetch(origin+`/api/meals/${id}/photo/primary`,{headers:{Cookie:owner.cookie}})).status,401);assert.equal(calls,4);
  });
  test(`${dialect}: request limits are atomic, separate identities/scopes and expire`, {skip:dialect==='postgres'&&!process.env.TEST_DATABASE_URL}, async t => {
    const db=dialect==='postgres'?await openPostgresDatabase(process.env.TEST_DATABASE_URL):openDatabase(':memory:');t.after(()=>db.close());
    const identity=randomUUID(), time=Date.now();
    const attempts=await Promise.allSettled(Array.from({length:25},()=>requestLimit(db,'security-test',identity,10,1,time)));
    assert.equal(attempts.filter(item=>item.status==='fulfilled').length,10);
    for(const item of attempts.filter(item=>item.status==='rejected')){assert.equal(item.reason.status,429);assert.equal(item.reason.retryAfter,1);}
    assert.equal((await db.prepare('SELECT hits FROM request_limits WHERE bucket=?').bind(createHash('sha256').update('security-test:'+identity).digest('hex')).first()).hits,10);
    await requestLimit(db,'security-test',identity+'other',10,1,time);await requestLimit(db,'other-security-test',identity,10,1,time);
    await requestLimit(db,'security-test',identity,10,1,time+1001);
  });
}
test('photo migration resumes after moving one view, then becomes a no-op',async t=>{
  const db=openDatabase(':memory:');t.after(()=>db.close());const user=await account(db,'migration@example.test'),id=randomUUID(),primary=photoFor(id,'upload');primary.additional=photoFor(id+'-angle','upload');
  const time=new Date().toISOString();await db.prepare('INSERT INTO meals(id,user_id,day,time,type,photo,public_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)').bind(id,user.id,time.slice(0,10),'12:00','Ebéd',JSON.stringify(primary),primary.publicId,time,time).run();
  const moved=new Set();let fail=true,renames=0;
  const fetcher=async(url,options)=>{
    assert.equal(options.redirect,'error');
    if(url.endsWith('/rename')){
      renames++;const params=options.body,key=params.get('from_public_id');assert.equal(params.get('to_public_id'),key);assert.equal(params.get('to_type'),'authenticated');assert.equal(params.get('invalidate'),'true');assert.equal(params.get('overwrite'),'false');
      if(moved.has(key))return Response.json({error:'Already moved'},{status:404});
      if(key.endsWith('-angle')&&fail){fail=false;return Response.json({error:'Temporary'},{status:503});}moved.add(key);
      return Response.json({public_id:key,secure_url:photoFor(key.split('/')[1]).url,width:10,height:10});
    }
    assert.match(url,/\/resources\/image\/authenticated\//);assert.ok(options.headers.Authorization.startsWith('Basic '));const key=decodeURIComponent(url.split('/').at(-1));
    return Response.json({public_id:key,secure_url:photoFor(key.split('/')[1]).url,width:10,height:10});
  };
  await assert.rejects(secureStoredPhotos(db,env,fetcher));assert.ok(moved.has(primary.publicId));assert.equal((await db.prepare('SELECT photo FROM meals WHERE id=?').bind(id).first()).photo,JSON.stringify(primary));
  assert.equal(await secureStoredPhotos(db,env,fetcher),1);const calls=renames;assert.equal(await secureStoredPhotos(db,env,fetcher),0);assert.equal(renames,calls);
  const saved=JSON.parse((await db.prepare('SELECT photo FROM meals WHERE id=?').bind(id).first()).photo);assert.equal(saved.type,'authenticated');assert.equal(saved.additional.type,'authenticated');assert.ok(!JSON.stringify(saved).includes('/image/upload/'));
});
test('photo signing rejects foreign hosts, clouds, paths, credentials and redirects before sending secrets',async()=>{
  let calls=0;const id=randomUUID(),photo=photoFor(id);
  const fetcher=async(url,options)=>{calls++;const expected=createHash('sha1').update(photo.publicId+'.jpg'+env.CLOUDINARY_API_SECRET).digest('base64url').slice(0,8);assert.ok(url.includes('/s--'+expected+'--/'));assert.equal(options.redirect,'error');return new Response(Buffer.from(image.split(',')[1],'base64'),{headers:{'Content-Type':'image/jpeg'}});};
  assert.equal(await storedPhotoData(photo,fetcher,env),image);
  for(const url of ['https://evil.test/image/authenticated/yumetrics/a.jpg',photo.url.replace('test-cloud','other-cloud'),photo.url.replace('/yumetrics/','/other/'),photo.url.replace('https://','https://user:password@'),photo.url+'?redirect=1',photo.url.replace('res.cloudinary.com','res.cloudinary.com:444'),photo.url.replace(id,'another-id')])await assert.rejects(storedPhotoData({...photo,url},fetcher,env));
  assert.equal(calls,1);
  await assert.rejects(storedPhotoData(photo,async(url,options)=>{assert.equal(options.redirect,'error');throw new TypeError('Redirect refused');},env),error=>error.status===502);
});
test('OAuth throttles spoofed forwarding headers before creating more pending states',async t=>{
  const db=openDatabase(':memory:'),settings={NODE_ENV:'production',GOOGLE_CLIENT_ID:'test-client',GOOGLE_CLIENT_SECRET:'test-secret'};
  const server=createApp({db,env:settings,googleClient:testGoogleClient()});server.listen(0,'127.0.0.1');await once(server,'listening');settings.APP_ORIGIN=`http://127.0.0.1:${server.address().port}`;
  t.after(async()=>{await new Promise(resolve=>server.close(resolve));await db.close();});
  for(let i=0;i<21;i++){
    const response=await fetch(settings.APP_ORIGIN+'/auth/google',{redirect:'manual',headers:{'X-Envoy-External-Address':'192.0.2.10','X-Forwarded-For':'192.0.2.'+(i+20)}});
    assert.equal(response.status,i<20?303:429);if(i===20)assert.equal(response.headers.get('Retry-After'),'600');
  }
  assert.equal((await db.prepare('SELECT COUNT(*) AS total FROM oauth_states').bind().first()).total,20);assert.equal((await fetch(settings.APP_ORIGIN+'/healthz')).status,200);
});
test('uploads require authenticated storage and reject a public provider response',async()=>{
  let calls=0;await assert.rejects(cloudinary('upload','yumetrics/test',env,image,async(url,options)=>{calls++;assert.equal(options.redirect,'error');assert.equal(options.body.get('type'),'authenticated');return Response.json({public_id:'yumetrics/test',secure_url:'https://res.cloudinary.com/test-cloud/image/upload/v1/yumetrics/test.jpg',width:10,height:10});}),error=>error.status===502);assert.equal(calls,1);
});
test('provider delivery signatures are removed from stored photo metadata',async()=>{
  const result=await cloudinary('upload','yumetrics/test',env,image,async()=>Response.json({public_id:'yumetrics/test',secure_url:'https://res.cloudinary.com/test-cloud/image/authenticated/s--secret12--/v1/yumetrics/test.jpg',width:10,height:10}));
  assert.equal(result.url,'https://res.cloudinary.com/test-cloud/image/authenticated/v1/yumetrics/test.jpg');
});
test('missing legacy pending uploads migrate without inventing or deleting image bytes',async t=>{
  const db=openDatabase(':memory:');t.after(()=>db.close());const user=await account(db,'pending@example.test'),id=randomUUID(),photo=photoFor(id,'upload'),time=new Date().toISOString();
  photo.url=photo.url.replace('/v1/','/').replace('.jpg','');photo.pending=true;
  await db.prepare('INSERT INTO meals(id,user_id,day,time,type,photo,public_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)').bind(id,user.id,time.slice(0,10),'12:00','Ebéd',JSON.stringify(photo),photo.publicId,time,time).run();
  let calls=0;assert.equal(await secureStoredPhotos(db,env,async()=>{calls++;return Response.json({error:'Missing'},{status:404});}),1);assert.equal(calls,2);
  const saved=JSON.parse((await db.prepare('SELECT photo FROM meals WHERE id=?').bind(id).first()).photo);assert.equal(saved.type,'authenticated');assert.equal(saved.pending,true);
});
test('external food lookups and upload bodies are throttled per user before provider work',async t=>{
  const db=openDatabase(':memory:'),owner=await account(db,'quota-owner@example.test'),other=await account(db,'quota-other@example.test');let calls=0;
  const server=createApp({db,env:{USDA_API_KEY:'test'},fetcher:async(url,options)=>{calls++;assert.equal(options.redirect,'error');return Response.json({foods:[]});}});
  server.listen(0,'127.0.0.1');await once(server,'listening');const origin=`http://127.0.0.1:${server.address().port}`;
  t.after(async()=>{await new Promise(resolve=>server.close(resolve));await db.close();});
  for(let i=0;i<31;i++){
    const response=await fetch(origin+'/api/foods/search?q=oats',{headers:{Cookie:owner.cookie}});assert.equal(response.status,i<30?200:429);if(i===30)assert.equal(response.headers.get('Retry-After'),'60');
  }
  assert.equal(calls,30);assert.equal((await fetch(origin+'/api/foods/search?q=oats',{headers:{Cookie:other.cookie}})).status,200);assert.equal(calls,31);
  for(let i=0;i<13;i++){
    const response=await fetch(origin+'/api/analyze',{method:'POST',headers:{Cookie:owner.cookie,'Content-Type':'application/json'},body:'{}'});assert.equal(response.status,i<12?400:429);
  }
  assert.equal(calls,31);
});
test('concurrent large requests stay bounded and release their slots after finishing',{timeout:10000},async t=>{
  const db=openDatabase(':memory:'),users=await Promise.all(['one','two','three'].map(name=>account(db,name+'@example.test')));
  let unblock,notify,started=0,held=new Promise(resolve=>unblock=resolve),observed=0;
  const fetcher=async(url,options)=>{
    if(url.startsWith('https://res.cloudinary.com/')||!options.body.get('public_id').endsWith('-angle')){started++;notify?.();await held;}
    if(url.startsWith('https://res.cloudinary.com/'))return new Response(Buffer.from(image.split(',')[1],'base64'),{headers:{'Content-Type':'image/jpeg'}});
    const key=options.body.get('public_id');return Response.json({public_id:key,secure_url:photoFor(key.split('/')[1]).url,width:10,height:10});
  };
  const server=createApp({db,env:{...env,OPENCODE_API_KEY:'test'},fetcher});server.listen(0,'127.0.0.1');await once(server,'listening');
  const origin=`http://127.0.0.1:${server.address().port}`;
  t.after(async()=>{unblock();await new Promise(resolve=>server.close(resolve));await db.close();});
  const waitStarted=async count=>{while(started<count)await new Promise(resolve=>notify=resolve);observed=started;};
  const upload=user=>fetch(origin+'/api/analyze',{method:'POST',headers:{Cookie:user.cookie,'Content-Type':'application/json'},body:JSON.stringify({id:randomUUID(),day:'2026-11-09',time:'12:00',type:'Ebéd',image,secondImage})});
  const first=upload(users[0]);await waitStarted(1);
  assert.equal((await upload(users[0])).status,429);
  const second=upload(users[1]);await waitStarted(2);
  const refused=await upload(users[2]);assert.equal(refused.status,429);assert.equal(refused.headers.get('Retry-After'),'3');assert.equal(started,observed);
  unblock();assert.equal((await first).status,202);assert.equal((await second).status,202);assert.equal((await upload(users[0])).status,202);
  const id=randomUUID(),photo=photoFor(id),time=new Date().toISOString();await db.prepare('INSERT INTO meals(id,user_id,day,time,type,photo,public_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)').bind(id,users[0].id,time.slice(0,10),'12:00','Ebéd',JSON.stringify(photo),photo.publicId,time,time).run();
  held=new Promise(resolve=>unblock=resolve);
  const prior=started;const reads=Array.from({length:12},()=>fetch(origin+`/api/meals/${id}/photo/primary`,{headers:{Cookie:users[0].cookie}}));
  await waitStarted(prior+12);
  const overloaded=await fetch(origin+`/api/meals/${id}/photo/primary`,{headers:{Cookie:users[0].cookie}});assert.equal(overloaded.status,429);assert.equal(started,prior+12);
  unblock();const results=await Promise.all(reads);assert.ok(results.every(response=>response.status===200));
  assert.equal((await fetch(origin+`/api/meals/${id}/photo/primary`,{headers:{Cookie:users[0].cookie}})).status,200);
});
test('malformed request targets and forbidden methods are client errors without database log amplification',async t=>{
  const db=openDatabase(':memory:'),server=createApp({db,env:{}});server.listen(0,'127.0.0.1');await once(server,'listening');
  t.after(async()=>{await new Promise(resolve=>server.close(resolve));await db.close();});
  const port=server.address().port;
  for(const [path,method,status] of [['//[','GET',400],['http://[','GET',400],['/','TRACE',405]]){
    const response=await new Promise((resolve,reject)=>{const request=httpRequest({host:'127.0.0.1',port,path,method},response=>{response.resume();resolve(response);});request.on('error',reject);request.end();});
    assert.equal(response.statusCode,status);if(status===405)assert.ok(response.headers.allow.includes('GET'));
  }
  assert.equal((await db.prepare('SELECT COUNT(*) AS total FROM app_logs').bind().first()).total,0);
});
