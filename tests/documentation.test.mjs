import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {once} from 'node:events';
import {createApp} from '../server.mjs';

test('publishable documentation has complete anchors, full-image guidance and no local/private dependencies',()=>{
  const html=readFileSync(new URL('../public/help.html',import.meta.url),'utf8');
  assert.ok(html.includes('lang="hu"'));assert.ok(html.includes('a képen látható teljes ehető étel és ital'));
  assert.ok(html.includes('100%'));assert.ok(html.includes('azonos össztömegű adaggal számol'));
  assert.ok(!/<script[\s>]/i.test(html));assert.ok(!/(C:\\|C:\/|Kovács|\.test-data-|chatgpt\.site)/.test(html));
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]);assert.equal(new Set(ids).size,ids.length);
  for(const [,target] of html.matchAll(/\bhref="#([^"]+)"/g))assert.ok(ids.includes(target),`Broken public anchor: ${target}`);
  for(const [,target] of html.matchAll(/\bsrc="([^"]+)"/g))assert.equal(target,'./favicon.svg');
});
test('documentation is public while the meal API remains protected',async t=>{
  const server=createApp({env:{}});server.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>new Promise(resolve=>server.close(resolve)));
  const origin=`http://127.0.0.1:${server.address().port}`;
  for(const path of ['/utmutato','/help.html']){const response=await fetch(origin+path);assert.equal(response.status,200);assert.ok((await response.text()).includes('id="teljes-adag"'));assert.ok(response.headers.get('content-security-policy').includes("script-src 'self'"));}
  assert.equal((await fetch(origin+'/api/meals?month=2026-11')).status,401);
});
