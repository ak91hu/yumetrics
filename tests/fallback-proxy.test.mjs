import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createBackupProxy,BACKUP_ORIGIN} from '../fallback/worker.mjs';
import {openDatabase} from '../lib/database.mjs';
import {authRoute,currentUser} from '../lib/auth.mjs';
import {api} from '../lib/api.mjs';
import {testGoogleClient} from './fixtures.mjs';
const state='a'.repeat(64);
test('proxy only reaches the fixed upstream and forwards app cookies without platform credentials',async()=>{
  let outgoing;
  const worker=createBackupProxy(async request=>{outgoing=request;return new Response('app',{headers:{'Set-Cookie':'__Host-yumetrics_session=abc; Secure; HttpOnly; Path=/'}});});
  const response=await worker.fetch(new Request(BACKUP_ORIGIN+'/api/meals?month=2026-11',{headers:{Cookie:'platform_session=secret; __Host-yumetrics_session=app-token; yumetrics_language=hu',Authorization:'Bearer platform-secret','OAI-Sites-Authorization':'platform-secret'}}));
  assert.equal(outgoing.url,'https://yumetrics.app/api/meals?month=2026-11');assert.equal(outgoing.headers.get('Cookie'),'__Host-yumetrics_session=app-token; yumetrics_language=hu');
  assert.equal(outgoing.headers.get('Authorization'),null);assert.equal(outgoing.headers.get('OAI-Sites-Authorization'),null);assert.equal(await response.text(),'app');assert.match(response.headers.get('Set-Cookie'),/__Host-yumetrics_session/);
  await worker.fetch(new Request(BACKUP_ORIGIN+'//evil.test/path'));assert.equal(new URL(outgoing.url).hostname,'yumetrics.app');
  assert.equal((await worker.fetch(new Request('https://evil.test/'))).status,403);
});
test('proxy rejects cross-site writes before forwarding and keeps same-origin request bodies',async()=>{
  let calls=0;
  const worker=createBackupProxy(async request=>{calls++;assert.equal(request.headers.get('Origin'),'https://yumetrics.app');assert.equal(await request.text(),'hello');return Response.json({ok:true});});
  for(const headers of [{Origin:'https://evil.test'},{'Sec-Fetch-Site':'cross-site'}])assert.equal((await worker.fetch(new Request(BACKUP_ORIGIN+'/api/profile',{method:'PATCH',headers,body:'hello'}))).status,403);
  assert.equal(calls,0);assert.equal((await worker.fetch(new Request(BACKUP_ORIGIN+'/api/profile',{method:'PATCH',headers:{Origin:BACKUP_ORIGIN},body:'hello'}))).status,200);assert.equal(calls,1);
});
test('canonical redirects stay on backup and backend failures return a useful retry page',async()=>{
  const worker=createBackupProxy(async()=>new Response(null,{status:308,headers:{Location:'https://yumetrics.app/path?q=1'}}));
  assert.equal((await worker.fetch(new Request(BACKUP_ORIGIN+'/path'))).headers.get('Location'),BACKUP_ORIGIN+'/path?q=1');
  for(const fetcher of [async()=>{throw new Error('sensitive error');},async()=>new Response('sensitive error',{status:502})]){
    const r=await createBackupProxy(fetcher).fetch(new Request(BACKUP_ORIGIN));assert.equal(r.status,503);assert.doesNotMatch(await r.text(),/sensitive error/);
  }
});
test('Google bridge and host-only cookies support backup sign-in, session and logout without changing primary auth',async t=>{
  const db=openDatabase(':memory:');t.after(()=>db.close());
  const env={APP_ORIGIN:'https://yumetrics.app',GOOGLE_CLIENT_ID:'test-client',GOOGLE_CLIENT_SECRET:'test-secret',GOOGLE_REDIRECT_URI:'https://ak91hu.github.io/yumetrics/oauth.html'};
  const client=testGoogleClient(),generate=client.generateAuthUrl;
  client.generateAuthUrl=options=>{const url=new URL(generate.call(client,options));url.searchParams.set('redirect_uri',env.GOOGLE_REDIRECT_URI);return url.href;};
  const worker=createBackupProxy(async request=>{
    const auth=await authRoute(request,{db,env,googleClient:client});if(auth)return auth;
    const user=await currentUser(request,db);return api(request,{db,env,user,userId:user?.id});
  });
  const start=await worker.fetch(new Request(BACKUP_ORIGIN+'/auth/google'));
  const google=new URL(start.headers.get('Location')),cookie=start.headers.get('Set-Cookie').split(';')[0];
  assert.match(google.searchParams.get('state'),/^backup\.[a-f0-9]{64}$/);
  assert.equal(google.searchParams.get('redirect_uri'),env.GOOGLE_REDIRECT_URI);assert.match(cookie,/^__Host-yumetrics_oauth=/);
  let destination;
  vm.runInNewContext(readFileSync(new URL('../docs/oauth.js',import.meta.url),'utf8'),{URL,location:{href:env.GOOGLE_REDIRECT_URI+google.search,replace:value=>{destination=value;}},history:{replaceState(){}},document:{getElementById(){throw new Error('Unexpected callback failure');}}});
  assert.equal(new URL(destination).origin,BACKUP_ORIGIN);
  const callback=await worker.fetch(new Request(destination,{headers:{Cookie:cookie}}));
  assert.equal(new URL(callback.headers.get('Location')).origin,BACKUP_ORIGIN);
  const session=callback.headers.getSetCookie().find(c=>c.startsWith('__Host-yumetrics_session=')).split(';')[0];
  assert.ok(session);const status=await worker.fetch(new Request(BACKUP_ORIGIN+'/api/status',{headers:{Cookie:session}}));
  assert.equal((await status.json()).user.email,'teszt@example.test');
  const logout=await worker.fetch(new Request(BACKUP_ORIGIN+'/api/logout',{method:'POST',headers:{Cookie:session,Origin:BACKUP_ORIGIN}}));assert.equal(logout.status,200);
  assert.equal((await worker.fetch(new Request(BACKUP_ORIGIN+'/api/status',{headers:{Cookie:session}}))).status,401);
});
