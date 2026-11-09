import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {once} from 'node:events';
import {ENGLISH} from '../lib/translations-en.mjs';
import {translate,translateMarkup,formatMessage,translateSystemMessage,requestLanguage,guideMarkup,localeFor,messageSource} from '../lib/i18n.mjs';
import {analysisContext,totals,metadata} from '../lib/domain.mjs';
import {analyze} from '../lib/providers.mjs';
import { secondImage,aiPayloadFor} from './fixtures.mjs';
import {createApp} from '../server.mjs';

test('translations preserve interpolation values, whitespace and markup boundaries',()=>{
  assert.equal(translate('  Mégsem\n','en'),'  Cancel\n');
  assert.equal(translate('Mégsem','hu'),'Mégsem');
  assert.equal(translate('__proto__','en'),'__proto__');assert.equal(translate('constructor','en'),'constructor');
  const name='Ebéd {1} $&';
  assert.equal(formatMessage(['Megadott elkészítés: ',''],[name],'en'),'Preparation details provided: '+name);
  assert.equal(translateMarkup('<button aria-label="Bezárás">Mégsem</button>','en'),'<button aria-label="Close">Cancel</button>');
  assert.equal(translateMarkup('<input placeholder="X &amp; Y">','en'),'<input placeholder="X &amp; Y">');
  assert.equal(messageSource('Text is missing or exceeds the 99-character limit.'),'A szöveg hiányzik, vagy hosszabb a megengedett 99 karakternél.');
  assert.equal(translateSystemMessage('Zsír: 100 g ételre vonatkozó, 0 és 100 g közötti értéket adj meg.','en'),'Fat: enter a value between 0 and 100 g per 100 g of food.');
  assert.equal(messageSource('Fat: enter a value between 0 and 100 g per 100 g of food.'),'Zsír: 100 g ételre vonatkozó, 0 és 100 g közötti értéket adj meg.');
  assert.equal(translate(' · külön megmért térfogat', 'en'), ' · separately measured volume');
  assert.equal(translate(' · kézzel pontosított mennyiség', 'en'), ' · manually adjusted quantity');
  assert.equal(messageSource('You earned a badge! Your meal has been saved.'), 'Új jelvényt szereztél! Elmentettük az étkezésedet.');
  for(const [hu,en] of Object.entries(ENGLISH)){
    assert.ok(en.length>0,hu);
    assert.deepEqual([...new Set([...en.matchAll(/\{(\d+)\}/g)].map(m=>m[1]))].sort(),[...new Set([...hu.matchAll(/\{(\d+)\}/g)].map(m=>m[1]))].sort(),'Interpolation slots: '+hu);
  }
});
test('language selection is bounded; both versions share portions, nutrients and canonical meal types',()=>{
  assert.equal(requestLanguage(new Request('http://localhost',{headers:{'Accept-Language':'en-GB,en;q=0.9'}})),'en');
  assert.equal(requestLanguage(new Request('http://localhost',{headers:{'Accept-Language':'en','Cookie':'yumetrics_language=hu'}})),'hu');
  assert.equal(localeFor('en'),'en-GB');assert.equal(localeFor('hu'),'hu-HU');
  assert.equal(analysisContext({language:'en'}).portionScope,'full_image');assert.throws(()=>analysisContext({language:'fr'}));
  assert.throws(()=>analysisContext({language:'en',consumedPercent:50}));
  assert.equal(metadata({day:'2026-11-07',time:'12:00',type:'Ebéd'}).type,'Ebéd');
});
test('both public guides are complete and standalone, without translating source identifiers',()=>{
  const source=readFileSync(new URL('../public/help.html',import.meta.url),'utf8');
  const english=guideMarkup(source,'en',true),hungarian=guideMarkup(source,'hu',true);
  assert.ok(english.includes('lang="en"'));assert.ok(english.includes('The whole portion.'));assert.ok(english.includes('100%'));
  assert.ok(english.includes('href="./index.html"'));assert.ok(hungarian.includes('href="./english.html"'));
  assert.ok(!english.includes('<script'));assert.ok(english.includes('GOOGLE_CLIENT_SECRET'));assert.ok(english.includes('id="teljes-adag"'));
  for(const part of source.replace(/<style[\s\S]*?<\/style>/g,'').split(/<[^>]+>/).map(value=>value.trim()).filter(value=>/[áéíóöőúüű]/i.test(value)&&value!=='Language / Nyelv'))assert.notEqual(translate(part,'en'),part,'Missing English guide text: '+part);
});
test('public English errors and guide routes keep the same authentication boundary',async t=>{
  const server=createApp({env:{}});server.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>new Promise(resolve=>server.close(resolve)));
  const origin=`http://127.0.0.1:${server.address().port}`;
  const response=await fetch(origin+'/api/meals?month=2026-11',{headers:{'Accept-Language':'en'}});
  assert.equal(response.status,401);assert.equal((await response.json()).error,'Sign in with your Google account to use the diary.');
  const guide=await fetch(origin+'/guide');assert.equal(guide.status,200);assert.equal(guide.headers.get('Content-Language'),'en');assert.ok((await guide.text()).includes('The whole portion.'));
  assert.equal((await fetch(origin+'/utmutato')).status,200);
});
test('AI output language survives durable context and does not change quantity or reference rules',async()=>{
  const image='data:image/jpeg;base64,'+Buffer.concat([Buffer.from([255,216,255,224]),Buffer.alloc(200)]).toString('base64');
  const base={name:'A meal',confidence:'medium',assumptions:'Test',ingredients:[{name:'Ingredient',grams:100,calories:100,protein:2,carbs:20,fat:1,fiber:1,sugar:0,sodium:1,saturatedFat:null}]};
  const calls=[];const fetcher=async(url,request)=>{calls.push(JSON.parse(request.body));return Response.json(aiPayloadFor(base,request));};
  const result=await analyze(image,'User notes',{OPENCODE_API_KEY:'test'},fetcher,{secondImage,context:{language:'en',totalWeightG:600,inedibleWeightG:200}});
  assert.ok(calls[0].systemInstruction.parts[0].text.includes('OUTPUT LANGUAGE: English'));
  assert.ok(calls[0].systemInstruction.parts[0].text.includes('JSON keys, enum values, reference IDs'));
  assert.equal(JSON.parse(calls[0].contents[0].parts.find(part=>part.text).text).context.language,'en');
  assert.equal(result.analysis.ingredients[0].grams,400);assert.equal(result.analysis.portionScope,'full_image');assert.ok(result.analysis.assumptions.includes('remaining 400 g edible food'));
  const hungarian=await analyze(image,'User notes',{OPENCODE_API_KEY:'test'},fetcher,{secondImage,context:{language:'hu',totalWeightG:600,inedibleWeightG:200}});
  const hungarianPrompt=calls[1].systemInstruction.parts[0].text;
  for(const rule of ['természetes, választékos, igényes magyar nyelven','angolból tükörfordított szerkezeteket','magyar mondatritmusra','tapasztalt magyar szerkesztő'])assert.ok(hungarianPrompt.includes(rule));
  assert.equal(calls.length,2,'The language policy must not add another AI request');
  assert.deepEqual(totals(result.analysis.ingredients),totals(hungarian.analysis.ingredients));
});
