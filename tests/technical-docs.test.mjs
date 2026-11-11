import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync,readFileSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
import {technicalDocumentation} from '../lib/http.mjs';
import {createApp} from '../server.mjs';

test('technical documentation serves HTML and local assets without exposing source or parent files',async t=>{
  const directory=mkdtempSync(join(tmpdir(),'yumetrics-docs-'));assert.ok(directory.startsWith(join(tmpdir(),'yumetrics-docs-')));
  t.after(()=>rmSync(directory,{recursive:true,force:true}));
  const site=join(directory,'site');mkdirSync(join(site,'chapter'),{recursive:true});
  writeFileSync(join(site,'index.html'),'<h1>Technikai dokumentáció</h1>');writeFileSync(join(site,'chapter','index.html'),'<h1>API</h1>');
  writeFileSync(join(site,'search.json'),'{}');writeFileSync(join(site,'code.js'),'void 0;');writeFileSync(join(directory,'secret.json'),'private');writeFileSync(join(site,'source.md'),'source');
  const get=path=>technicalDocumentation(path,'GET',site);
  assert.equal(get('/docs').headers.get('location'),'/docs/');assert.equal(get('/docs/chapter').headers.get('location'),'/docs/chapter/');
  assert.match(await get('/docs/').text(),/Technikai/);assert.match(await get('/docs/chapter/').text(),/API/);
  assert.match(get('/docs/code.js').headers.get('content-type'),/^text\/javascript/);assert.equal(get('/docs/search.json').status,200);
  const head=technicalDocumentation('/docs/','HEAD',site);assert.equal(head.status,200);assert.equal(await head.text(),'');
  for(const path of ['/docs/missing/','/docs/source.md','/docs/../secret.json','/docs/%2e%2e/secret.json','/docs/%2f../secret.json','/docs/..%5csecret.json','/docs/%00.html','/docs/%zz','/docs/.env','/docs/code.js/inside','/other/index.html'])assert.equal(get(path).status,404,path);
  const post=technicalDocumentation('/docs/','POST',site);assert.equal(post.status,405);assert.equal(post.headers.get('allow'),'GET, HEAD');
});

test('documentation routes stay public without granting access to meals or admin',async t=>{
  const server=createApp({env:{}});server.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>new Promise(resolve=>server.close(resolve)));
  const origin=`http://127.0.0.1:${server.address().port}`;
  const redirect=await fetch(origin+'/docs',{redirect:'manual'});assert.equal(redirect.status,308);assert.equal(redirect.headers.get('location'),'/docs/');
  const missing=await fetch(origin+'/docs/does-not-exist/');assert.equal(missing.status,404);assert.ok(missing.headers.get('content-security-policy').includes("script-src 'self'"));
  assert.equal((await fetch(origin+'/api/meals?month=2026-11')).status,401);assert.equal((await fetch(origin+'/admin')).status,401);
  const login=await (await fetch(origin+'/')).text();assert.ok(login.includes('href="/docs/"'));
  assert.ok(readFileSync(new URL('../public/index.html',import.meta.url),'utf8').includes('<a href="/docs/">Technikai dokumentáció</a>'));
});

test('MkDocs navigation covers the technical source pages and the build includes its inputs',()=>{
  const root=new URL('..',import.meta.url),config=readFileSync(new URL('mkdocs.yml',root),'utf8');
  const pages=[...config.matchAll(/: ([a-z-]+\.md)$/gm)].map(match=>match[1]);assert.equal(pages.length,14);assert.equal(new Set(pages).size,pages.length);
  for(const page of pages){const path=new URL('docs/technical/'+page,root);assert.ok(existsSync(path),page);assert.ok(readFileSync(path,'utf8').startsWith('# '));}
  assert.match(config,/strict: true/);assert.match(config,/highlightjs: false/);
  const docker=readFileSync(new URL('Dockerfile',root),'utf8');assert.match(docker,/requirements-docs\.txt/);assert.match(docker,/MKDOCS_PYTHON/);
});
