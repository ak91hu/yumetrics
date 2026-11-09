import {test} from 'node:test';
import assert from 'node:assert/strict';
import {openDatabase} from '../lib/database.mjs';
import {visitDimensions,recordPageView,visitorReport} from '../lib/visitors.mjs';
import {createApp} from '../server.mjs';
import {once} from 'node:events';

const browser='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/142.0.0.0 Safari/537.36';
const request=(headers={},method='GET')=>new Request('https://yumetrics.app/?private=secret-token',{method,headers:{'Sec-Fetch-Dest':'document','User-Agent':browser,...headers}});
const context={page:'login',country:'HU',language:'hu'};
test('visitor dimensions are bounded categories and discard private URLs, raw headers and identifiers',()=>{
  const dimensions=visitDimensions(request({Referer:'https://www.google.com/search?q=private-meal-name&email=personal@example.test'}),context);
  assert.deepEqual(dimensions,{total:'all',page:'login',country:'HU',browser:'chrome',os:'windows',device:'desktop',source:'google',language:'hu'});
  assert.equal(visitDimensions(request({Referer:'https://secret-token.attacker.test/path?email=personal@example.test'}),context).source,'other');
  assert.equal(visitDimensions(request({Referer:'https://google.evil.test'}),context).source,'other');
  assert.equal(visitDimensions(request({Referer:'https://yumetrics.app/guide?private=secret-token'}),context).source,'internal');
  assert.equal(visitDimensions(request({Referer:'not a URL'}),context).source,'direct');
  assert.equal(visitDimensions(request(),{...context,country:'<script>',language:'invalid'}).country,'unknown');
  for(const [ua,device,os,browserName]of[
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1','phone','ios','safari'],
    ['Mozilla/5.0 (Linux; Android 15; Tablet) AppleWebKit/537.36 Chrome/142.0 Safari/537.36','tablet','android','chrome'],
    [browser+' Edg/142.0','desktop','windows','edge'],
    ['Mozilla/5.0 (X11; Linux x86_64) Gecko/20100101 Firefox/142.0','desktop','linux','firefox'],
  ]){const value=visitDimensions(request({'User-Agent':ua}),context);assert.deepEqual([value.device,value.os,value.browser],[device,os,browserName]);}
});
test('page views exclude assets, APIs, prefetches, known robots, admin pages and privacy opt-outs',()=>{
  for(const value of [request({'Sec-Fetch-Dest':'empty'}),request({'Sec-Fetch-Dest':'image'}),request({DNT:'1'}),request({'Sec-GPC':'1'}),request({'Sec-Purpose':'prefetch'}),request({Purpose:'prefetch'}),request({'User-Agent':browser.replace('Chrome/','HeadlessChrome/')}),request({'User-Agent':'Googlebot/2.1'}),request({},'HEAD')])assert.equal(visitDimensions(value,context),null);
  assert.equal(visitDimensions(request(),{...context,page:'admin'}),null);
  assert.equal(visitDimensions(request(),{...context,page:'/api/meals/private-id'}),null);
});
test('daily counters stay consistent under concurrent writes, prune old data and count views rather than unique visitors',async t=>{
  const db=openDatabase(':memory:');t.after(()=>db.close());
  const now=Date.parse('2026-11-09T12:30:00Z');
  await recordPageView(db,request(),context,Date.parse('2025-09-01T00:00:00Z'));
  await recordPageView(db,request(),context,Date.parse('2026-11-08T23:59:59Z'));
  await Promise.all(Array.from({length:12},()=>recordPageView(db,request({Referer:'https://www.google.com/?q=secret-token'}),context,now)));
  await recordPageView(db,request(),{page:'diary',country:null,language:'en'},now);
  assert.equal(await recordPageView(db,request({DNT:'1'}),context,now),false);
  const report=await visitorReport(db,7,now);assert.equal(report.total,14);assert.equal(report.todayViews,13);assert.equal(report.coverage.first_day,'2026-11-08');
  for(const rows of Object.values(report.breakdowns))assert.equal(rows.reduce((sum,row)=>sum+row.views,0),14);
  assert.equal(report.breakdowns.country.find(row=>row.value==='HU').views,13);assert.equal(report.breakdowns.country.find(row=>row.value==='unknown').views,1);
  assert.equal(report.breakdowns.source.find(row=>row.value==='google').views,12);assert.equal(report.daily.length,2);
  const stored=JSON.stringify((await db.prepare('SELECT * FROM visitor_stats').bind().all()).results);for(const secret of ['secret-token','Mozilla','127.0.0.1','personal@example.test'])assert.ok(!stored.includes(secret));
  assert.ok(!(await db.prepare("SELECT day FROM visitor_stats WHERE day='2025-09-01'").bind().first()));
  assert.equal((await visitorReport(db,7,Date.parse('2028-01-01T00:00:00Z'))).coverage.first_day,null);
});
test('statistics storage failure does not prevent a public page from loading or add a tracking cookie',async t=>{
  const db=openDatabase(':memory:'),server=createApp({db,env:{}});server.listen(0,'127.0.0.1');await once(server,'listening');
  t.after(async()=>{await new Promise(resolve=>server.close(resolve));await db.close();});
  await db.prepare('DROP TABLE visitor_stats').bind().run();
  const response=await fetch(`http://127.0.0.1:${server.address().port}`,{headers:{'Sec-Fetch-Dest':'document','User-Agent':browser}});
  assert.equal(response.status,200);assert.equal(response.headers.get('Set-Cookie'),null);assert.ok((await response.text()).includes('google-signin'));
});
