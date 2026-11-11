import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {once} from 'node:events';
import {createApp} from '../server.mjs';

test('the Onesvibe ownership tag is present in both homepage versions and public HTML',async t=>{
  const claim='<meta name="onesvibe-claim" content="ov-53c3fcf1-fe1d-4c92-9279-54d91486c003">';
  for(const name of ['index.html','login.html']){
    const html=readFileSync(new URL('../public/'+name,import.meta.url),'utf8');
    assert.equal(html.split(claim).length,2);assert.ok(html.indexOf(claim)<html.indexOf('</head>'));
  }
  const server=createApp({env:{}});server.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>new Promise(resolve=>server.close(resolve)));
  const response=await fetch(`http://127.0.0.1:${server.address().port}/`);
  assert.equal(response.status,200);assert.ok((await response.text()).includes(claim));
});

test('the beta notice appears once on the login, diary and admin pages and has an English translation',async()=>{
  const {translate}=await import('../lib/i18n.mjs');
  for(const name of ['index.html','login.html','admin.html']){
    const html=readFileSync(new URL('../public/'+name,import.meta.url),'utf8');
    assert.equal(html.match(/class="beta-banner"/g)?.length,1);
    assert.ok(html.includes('Bétaverzió – tesztelés alatt'));
    assert.match(html,/<body class="[^"]*\bbeta-testing\b/);
  }
  assert.equal(translate('Bétaverzió – tesztelés alatt','en'),'Beta version – testing in progress');
});

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
