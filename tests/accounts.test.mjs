import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp, openDatabase } from '../server.mjs';
import { tokenHash, authRoute, currentUser } from '../lib/auth.mjs';
import { secondImage, testGoogleClient, aiPayloadFor } from './fixtures.mjs';
import { foodRecord, fetchFood, analysisReferences, searchFoods } from '../lib/food-data.mjs';
import { analysisContext, validateAnalysis } from '../lib/domain.mjs';
import { analyze } from '../lib/providers.mjs';

test('Google-only gate, one-use state, durable hashed session, profile and logout', async t => {
  const avatarUrl = 'https://lh3.googleusercontent.com/a/test-photo';
  const db = openDatabase(':memory:'), env = { GOOGLE_CLIENT_ID: 'test-client', GOOGLE_CLIENT_SECRET: 'test-secret' }, client = testGoogleClient({ picture: avatarUrl });
  let server, origin;
  async function start() {
    server = createApp({ db, env, googleClient: client });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); origin = `http://127.0.0.1:${server.address().port}`; env.APP_ORIGIN = origin;
  }
  await start(); t.after(async () => { await new Promise(resolve => server.close(resolve)); await db.close(); });
  assert.equal((await fetch(`${origin}/api/status`)).status, 401);
  const page = await fetch(origin); assert.ok((await page.text()).includes('google-signin')); assert.ok(page.headers.get('content-security-policy').includes("script-src 'self'"));
  for (const path of ['/.env', '/postgres/0001_initial.sql', '/data/yumetrics.sqlite']) assert.equal((await fetch(origin + path)).status, 404);
  assert.equal((await fetch(`${origin}/api/status`, { headers: { 'oai-authenticated-user-id': 'spoofed' } })).status, 401);
  const begin = await fetch(`${origin}/auth/google`, { redirect: 'manual' }); assert.equal(begin.status, 303);
  const stateCookie = begin.headers.get('set-cookie').split(';')[0], location = new URL(begin.headers.get('location'));
  const callback = `${origin}/auth/google/callback${location.search}`;
  const badState = await fetch(callback.replace(/state=[^&]+/, 'state=wrong'), { headers: { Cookie: stateCookie }, redirect: 'manual' }); assert.equal(badState.headers.get('location'), '/?login=failed');
  const signedIn = await fetch(callback, { headers: { Cookie: stateCookie }, redirect: 'manual' }); assert.equal(signedIn.headers.get('location'), '/');
  const sessionCookie = signedIn.headers.getSetCookie().find(cookie => cookie.startsWith('yumetrics_session=')).split(';')[0];
  assert.ok(signedIn.headers.getSetCookie().some(cookie => cookie.includes('HttpOnly') && cookie.includes('SameSite=Lax')));
  const savedSession = await db.prepare('SELECT * FROM sessions').bind().first(); assert.equal(savedSession.token_hash, tokenHash(sessionCookie.split('=')[1]));
  assert.ok(!JSON.stringify(savedSession).includes(sessionCookie.split('=')[1]));
  assert.equal((await fetch(callback, { headers: { Cookie: stateCookie }, redirect: 'manual' })).headers.get('location'), '/?login=failed');
  const headers = { Cookie: sessionCookie, Origin: origin, 'Content-Type': 'application/json' };
  assert.equal((await fetch(`${origin}/api/profile`, { method: 'PATCH', headers, body: JSON.stringify({ calorieGoal: 2300 }) })).status, 200);
  assert.equal((await fetch(`${origin}/api/profile`, { method: 'PATCH', headers: { ...headers, Origin: 'https://evil.test' }, body: JSON.stringify({ calorieGoal: 1000 }) })).status, 403);
  await new Promise(resolve => server.close(resolve)); await start();
  const profile = await (await fetch(`${origin}/api/status`, { headers: { Cookie: sessionCookie } })).json(); assert.equal(profile.user.calorieGoal, 2300); assert.equal(profile.user.email, 'teszt@example.test');
  assert.equal(profile.user.avatarUrl, avatarUrl);
  const account = await (await fetch(`${origin}/api/profile`, { headers: { Cookie: sessionCookie } })).json();
  assert.equal(account.profile.avatarUrl, avatarUrl);
  const policy = (await fetch(origin, { headers: { Cookie: sessionCookie } })).headers.get('content-security-policy');
  assert.ok(policy.includes('https://*.googleusercontent.com')); assert.ok(!policy.includes('img-src *'));
  assert.ok((await (await fetch(origin, { headers: { Cookie: sessionCookie } })).text()).includes('id="upload-form"'));
  assert.equal((await fetch(`${origin}/api/logout`, { method: 'POST', headers: { Cookie: sessionCookie } })).status, 200);
  assert.equal((await fetch(`${origin}/api/status`, { headers: { Cookie: sessionCookie } })).status, 401);
});

test('wrong issuer, audience, nonce and unverified Google identities cannot create users', async t => {
  const db = openDatabase(':memory:'); t.after(() => db.close());
  for (const claims of [{ iss: 'https://evil.test' }, { aud: 'other-client' }, { nonce: 'wrong' }, { email_verified: false }, { sub: '' }]) {
    const env = { GOOGLE_CLIENT_ID: 'test-client', GOOGLE_CLIENT_SECRET: 'test-secret' }, server = createApp({ db, env, googleClient: testGoogleClient(claims) });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); const origin = `http://127.0.0.1:${server.address().port}`; env.APP_ORIGIN = origin;
    try {
      const start = await fetch(`${origin}/auth/google`, { redirect: 'manual' }), location = new URL(start.headers.get('location'));
      const end = await fetch(`${origin}/auth/google/callback${location.search}`, { headers: { Cookie: start.headers.get('set-cookie').split(';')[0] }, redirect: 'manual' }); assert.equal(end.headers.get('location'), '/?login=failed');
    } finally { await new Promise(resolve => server.close(resolve)); }
  }
  assert.equal((await db.prepare('SELECT COUNT(*) AS count FROM users').bind().first()).count, 0);
});
test('HTTPS authentication cookies use host-only prefix, Secure and root path; expired sessions fail closed',async t=>{
  const db=openDatabase(':memory:');t.after(()=>db.close());
  const env={APP_ORIGIN:'https://app.example.test',GOOGLE_CLIENT_ID:'test-client',GOOGLE_CLIENT_SECRET:'test-secret'},googleClient=testGoogleClient();
  const start=await authRoute(new Request(env.APP_ORIGIN+'/auth/google'),{db,env,googleClient});
  const stateCookie=start.headers.get('set-cookie');assert.ok(stateCookie.startsWith('__Host-yumetrics_oauth='));assert.ok(stateCookie.includes('; Secure'));assert.ok(stateCookie.includes('Path=/;'));
  const location=new URL(start.headers.get('location'));
  const end=await authRoute(new Request(env.APP_ORIGIN+'/auth/google/callback'+location.search,{headers:{Cookie:stateCookie.split(';')[0]}}),{db,env,googleClient});
  const cookie=end.headers.getSetCookie().find(value=>value.startsWith('__Host-yumetrics_session='));assert.ok(cookie.includes('; Secure'));assert.ok(cookie.includes('Path=/;'));
  const request=new Request(env.APP_ORIGIN,{headers:{Cookie:cookie.split(';')[0]}});assert.ok(await currentUser(request,db));
  await db.prepare('UPDATE sessions SET expires_at=?').bind('2000-01-01T00:00:00.000Z').run();assert.equal(await currentUser(request,db),null);
});

export const usdaFixture = { fdcId: 12345, description: 'Pork, cooked', dataType: 'Foundation', publicationDate: '2026-01-01', foodNutrients: [[2048,250,'kcal'],[1003,25,'g'],[1004,16,'g'],[1005,0,'g'],[1079,0,'g'],[1093,70,'mg']].map(([id,amount,unitName]) => ({ nutrient:{id,unitName},amount })) };
test('USDA values retain identifiers, units, nulls and immutable source snapshots', () => {
  const { key, record } = foodRecord(usdaFixture); assert.ok(/^fdc-12345-[a-f0-9]{16}$/.test(key)); assert.equal(record.nutrients.calories, 250); assert.equal(record.nutrients.sugar, null);
  assert.equal(record.nutrients.carbs, 0); assert.equal(record.url, 'https://fdc.nal.usda.gov/food-details/12345/nutrients');
  const item = { name: 'Csülök', grams: 150, ...record.nutrients, referenceKey:key, sourceType:'reference', sourceConfirmed:true, weightBasis:'measured_ingredient' };
  const input = {name:'Csülök', confidence:'medium', ingredients:[item]};
  assert.equal(validateAnalysis(input,{[key]:record}).ingredients[0].sourceType,'reference');
  assert.equal(validateAnalysis({...input,ingredients:[{...item,calories:1}]},{[key]:record}).ingredients[0].sourceType,'user');
  assert.throws(() => foodRecord({...usdaFixture, foodNutrients:usdaFixture.foodNutrients.filter(n=>n.nutrient.id!==1079)}));
  assert.throws(() => foodRecord({...usdaFixture, foodNutrients:usdaFixture.foodNutrients.map(n=>n.nutrient.id===2048?{...n,nutrient:{...n.nutrient,unitName:'kJ'}}:n)}));
});
test('bones are removed from the full image portion, never silently counted as food', async () => {
  const image = 'data:image/jpeg;base64,' + Buffer.concat([Buffer.from([255,216,255,224]),Buffer.alloc(200)]).toString('base64');
  const analysis = {name:'Hús',confidence:'medium',assumptions:'Teszt',ingredients:[{name:'Hús',grams:100,calories:200,protein:25,carbs:0,fat:11,fiber:0,sugar:0,sodium:0}]};
  const result = await analyze(image,'',{OPENCODE_API_KEY:'test'},async (url,options)=>Response.json(aiPayloadFor(analysis,options)),{secondImage,context:{totalWeightG:600,inedibleWeightG:200}});
  assert.equal(result.analysis.ingredients[0].grams,400);
  for (const context of [{totalWeightG:100,inedibleWeightG:100},{inedibleWeightG:50},{inedibleWeightG:-1}]) assert.throws(()=>analysisContext(context));
});
test('USDA search uses server credentials; selected canonical snapshots are cached and cannot be forged', async t => {
  const db=openDatabase(':memory:');t.after(()=>db.close());let calls=0;
  const fetcher=async(url,options)=>{calls++;assert.ok(url.startsWith('https://api.nal.usda.gov/fdc/v1/'));assert.ok(url.endsWith('api_key=test-key'));return Response.json(url.includes('/foods/search')?{foods:[{fdcId:12345,description:'Pork, cooked',dataType:'Foundation'}]}:usdaFixture);};
  assert.equal((await searchFoods('pork cooked',{USDA_API_KEY:'test-key'},fetcher))[0].id,12345);
  const selected=await fetchFood('12345',db,{USDA_API_KEY:'test-key'},fetcher);
  assert.deepEqual(await fetchFood('12345',db,{},fetcher),selected);assert.equal(calls,2,'Persisted record is used without another provider request');
  const references=await analysisReferences({ingredients:[{referenceKey:selected.key,referenceRecord:{nutrients:{calories:0}}}]},db);assert.equal(references[selected.key].nutrients.calories,250);
  await assert.rejects(analysisReferences({ingredients:[{referenceKey:'fdc-99999-0000000000000000'}]},db));
  await assert.rejects(analysisReferences({ingredients:'invalid'},db));
  await assert.rejects(fetchFood('54321',db,{USDA_API_KEY:'test-key'},fetcher),error=>error.status===502);
  await assert.rejects(searchFoods('aa',{USDA_API_KEY:'test-key'},fetcher),error=>error.status===400);
});
