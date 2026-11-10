import test from 'node:test';
import assert from 'node:assert/strict';
import {archiveText,archiveJson,readAiResponse,imageHashes} from '../lib/ai-archive.mjs';

test('archives redact credentials, encoded credentials, bearer tokens and images before limiting text',()=>{
  const env={OPENCODE_API_KEY:'private-key',DATABASE_URL:'postgres://user:password@db/app',MODAL_PROXY_TOKEN_SECRET:'ws-private12345',OTHER_SECRET:'quote"slash\\value'};
  const raw=JSON.stringify({name:'Rice',key:env.OPENCODE_API_KEY,encoded:env.OTHER_SECRET,image:'data:image/png;base64,YWJjZA==',auth:'Bearer abc.def',db:env.DATABASE_URL});
  const saved=archiveText(raw,env);for(const value of Object.values(env))assert.ok(!saved.text.includes(value));
  assert.ok(!saved.text.includes('YWJjZA=='));assert.ok(!saved.text.includes('abc.def'));assert.equal(saved.redacted,true);
  const long=archiveText('árvíz '.repeat(20000)+env.OPENCODE_API_KEY,env);assert.ok(Buffer.byteLength(long.text)<=65536);assert.equal(long.truncated,true);assert.ok(!long.text.includes('private-key'));assert.ok(!long.text.includes('\uFFFD'));
});
test('structured metadata remains valid JSON and never stores transport headers or image content',()=>{
  const value=JSON.parse(archiveJson({context:{grams:1234,preparationNotes:'password1234'},headers:{Authorization:'anything'},images:['image'],inlineData:{data:'binary'},hash:'a'.repeat(64)},{API_KEY:'1234'}));
  assert.equal(value.context.grams,1234);assert.ok(!value.context.preparationNotes.includes('1234'));assert.equal(value.headers,'[ADAT ELHAGYVA]');assert.equal(value.hash,'a'.repeat(64));
  assert.notEqual(imageHashes(['data:image/png;base64,YWJj'])[0],imageHashes(['data:image/png;base64,YWJk'])[0]);
});
test('visible OpenCode answers are preserved exactly, while private thought parts and binary parts are excluded',async()=>{
  const text='{"name":"Rizs","ingredients":[]}';
  const response=await readAiResponse(Response.json({candidates:[{finishReason:'STOP',content:{parts:[{thought:true,text:'PRIVATE_THOUGHT'},{inlineData:{data:'BINARY'}},{text}]}}],responseId:'response-1',modelVersion:'model-1'}),{},'opencode');
  assert.equal(response.archive.responseText,text);assert.equal(response.archive.responseMeta.finishReason,'STOP');assert.ok(!JSON.stringify(response.archive).includes('PRIVATE_THOUGHT'));assert.ok(!JSON.stringify(response.archive).includes('BINARY'));
});
test('Modal output and generation provenance are stored even when the returned food list is malformed',async()=>{
  const result=await readAiResponse(Response.json({answer:'{"foods":[',model:'zy12123/Food-R1',revision:'rev',prompt_version:'v2',prompt_hash:'hash',truncated:true}),{},'modal');
  assert.equal(result.archive.responseText,'{"foods":[');assert.equal(result.archive.responseMeta.truncated,true);assert.equal(result.archive.responseMeta.prompt_version,'v2');assert.equal(result.archive.responseTruncated,true);
  const limited=await readAiResponse(Response.json({candidates:[{finishReason:'MAX_TOKENS',content:{parts:[{text:'{"name":'}]}}]}),{},'opencode');assert.equal(limited.archive.responseTruncated,true);
});
test('HTTP errors, malformed JSON and bounded partial responses remain inspectable without exposing hidden content',async()=>{
  const error=await readAiResponse(Response.json({error:{message:'Rejected private-key',status:'DENIED'}},{status:403}),{OPENCODE_API_KEY:'private-key'},'opencode');assert.match(error.archive.responseText,/Rejected/);assert.ok(!error.archive.responseText.includes('private-key'));
  const broken=await readAiResponse(new Response('{broken'),{},'opencode');assert.equal(broken.archive.responseText,'{broken');
  const hidden=await readAiResponse(new Response('{"thought":true,"text":"PRIVATE'),{},'opencode');assert.ok(!hidden.archive.responseText.includes('PRIVATE'));
  const incompletePart=await readAiResponse(new Response('{"candidates":[{"content":{"parts":[{"text":"PRIVATE'),{},'opencode');assert.ok(!incompletePart.archive.responseText.includes('PRIVATE'));
  const oversized=await readAiResponse(new Response('x'.repeat(1048600)),{},'opencode');assert.equal(oversized.wireTruncated,true);assert.equal(oversized.archive.responseTruncated,true);assert.ok(Buffer.byteLength(oversized.archive.responseText)<65540);
});
