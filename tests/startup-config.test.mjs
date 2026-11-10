import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import pg from 'pg';
import {postgresConnectionString} from '../lib/database.mjs';

test('ambiguous PostgreSQL SSL aliases retain certificate and hostname verification without a warning',async()=>{
  const warnings=[],capture=warning=>warnings.push(warning.message);process.on('warning',capture);
  try{
    for(const mode of ['prefer','require','verify-ca']){
      const url=postgresConnectionString('postgresql://test:p%40ss%2Fword@db.example.test:5433/app?sslmode='+mode+'&application_name=yumetrics');
      const client=new pg.Client({connectionString:url}),params=client.connectionParameters;
      assert.equal(new URL(url).searchParams.get('sslmode'),'verify-full');
      assert.equal(params.password,'p@ss/word');assert.equal(params.host,'db.example.test');assert.equal(params.port,5433);
      assert.ok(params.ssl);assert.notEqual(params.ssl.rejectUnauthorized,false);assert.equal(params.ssl.checkServerIdentity,undefined);
    }
    await new Promise(resolve=>setImmediate(resolve));assert.ok(!warnings.some(message=>message.includes('SSL modes')));
  }finally{process.off('warning',capture);}
});

test('explicit SSL settings, compatibility opt-in and duplicate query parameters retain their meaning',()=>{
  for(const suffix of ['sslmode=disable','sslmode=no-verify','sslmode=verify-full','sslmode=require&uselibpqcompat=true','sslmode=require&sslmode=disable']){
    const url='postgres://test:pass@db.example.test/app?'+suffix;assert.equal(postgresConnectionString(url),url);
  }
  assert.equal(new URL(postgresConnectionString('postgres://test:pass@db.example.test/app?sslmode=disable&sslmode=require')).searchParams.get('sslmode'),'verify-full');
});

test('production fails closed with actionable configuration names and no secret values or stack trace',()=>{
  const result=spawnSync(process.execPath,['server.mjs'],{cwd:new URL('..',import.meta.url),encoding:'utf8',env:{...process.env,NODE_ENV:'production',DATABASE_URL:'',GOOGLE_CLIENT_ID:'',GOOGLE_CLIENT_SECRET:'private-never-print',APP_ORIGIN:'http://invalid.example.test'}});
  assert.equal(result.status,1);assert.match(result.stderr,/DATABASE_URL/);assert.match(result.stderr,/GOOGLE_CLIENT_ID/);assert.match(result.stderr,/APP_ORIGIN/);
  assert.ok(!result.stderr.includes('private-never-print'));assert.ok(!result.stderr.includes('at file:'));assert.ok(!result.stderr.includes('GOOGLE_CLIENT_SECRET'));
});
