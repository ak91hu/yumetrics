import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import { createApp, openDatabase } from '../server.mjs';
import { aiPayloadFor, visualInventory, testGoogleClient, multiFoodAnalysis } from '../tests/fixtures.mjs';
import { startJobRunner } from '../lib/jobs.mjs';
import { randomUUID } from 'node:crypto';
import { validateAnalysis } from '../lib/domain.mjs';
import { normalizeLabel, labelNutrients } from '../lib/product-label.mjs';
import { productLabelFixture } from '../tests/fixtures.mjs';

const chrome = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const language = process.env.TEST_LANGUAGE === 'en' ? 'en' : 'hu';
const device = process.env.TEST_DEVICE === 'desktop' ? 'desktop' : 'mobile';
const navigation = device === 'desktop' ? '.sidebar' : '.mobile-nav';
const expected = (hu, en) => language === 'en' ? en : hu;
const out = resolve('outputs', language === 'hu' && device === 'mobile' ? '' : `${language}-${device}`); mkdirSync(out, { recursive: true });
writeFileSync(resolve(out, 'browser-check.json'), JSON.stringify({ passed: false, status: 'running' }));
const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a2ioAAAAASUVORK5CYII=';
const photoFile = resolve(out, 'upload-fixture.png'); writeFileSync(photoFile, Buffer.from(png, 'base64'));
const ingredient = { name: 'Teszt avokádó', grams: 100, calories: 160, protein: 2, carbs: 1.8, fat: 14.7, fiber: 6.7, sugar: .7, sodium: 7 };
const avatarUrl = 'https://lh3.googleusercontent.com/a/browser-avatar';
const avatarSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#547a93"/><circle cx="32" cy="24" r="12" fill="#f3d4b4"/><path d="M8 64a24 24 0 0 1 48 0" fill="#f3d4b4"/></svg>';
let providerCalls = 0, aiRequests = 0, failFirstAnalysis = true; const storedPhotos = new Map(), googleClient = testGoogleClient({ picture: avatarUrl });
const env = { NODE_ENV: 'production', USDA_API_KEY:'test-usda', GOOGLE_CLIENT_ID: 'test-client', GOOGLE_CLIENT_SECRET: 'test-secret', OPENCODE_API_KEY: 'browser-test', CLOUDINARY_CLOUD_NAME: 'test-cloud', CLOUDINARY_API_KEY: 'browser-test', CLOUDINARY_API_SECRET: 'browser-test' };
let runner;
const db = openDatabase(':memory:');
const fetcher = async (url, options) => {
  if (!url.startsWith('https://res.cloudinary.com/')) providerCalls++;
  if(url.startsWith('https://api.nal.usda.gov/')) return Response.json(url.includes('/foods/search') ? {foods:[{fdcId:99991,description:'Avocado, raw (browser fixture)',dataType:'Foundation'}]} : {fdcId:99991,description:'Avocado, raw (browser fixture)',dataType:'Foundation',foodNutrients:[[2048,160,'kcal'],[1003,2,'g'],[1004,14.7,'g'],[1005,8.5,'g'],[1079,6.7,'g'],[2000,.7,'g'],[1093,7,'mg']].map(([id,amount,unitName])=>({nutrient:{id,unitName},amount}))});
  if (url.startsWith('https://opencode.ai/')) {
    aiRequests++;
    const body = JSON.parse(options.body), input = JSON.parse(body.contents[0].parts.find(part => part.text).text);
    assert.equal(body.contents[0].parts.filter(part => part.inlineData).length, 2);
    assert.equal(input.context.language, language);
    if (failFirstAnalysis) { failFirstAnalysis = false; return Response.json({error:'Simulated recoverable failure'},{status:503}); }
    const analysis = { name: expected('Tesztétkezés', 'Test meal'), confidence: 'medium', assumptions: expected('Automatizált teszt: nem valódi AI-elemzés.', 'Automated test, not a real AI analysis.'), ingredients: [{ ...ingredient, name: expected(ingredient.name, 'Test avocado') }] };
    const inventory = visualInventory(analysis);
    if (language === 'en') {
      assert.ok(body.systemInstruction.parts[0].text.includes('OUTPUT LANGUAGE: English'));
      Object.assign(inventory, { summary: 'Food with separately estimated ingredients. Measured quantities can improve the estimate.', observations: ['The side dish and main ingredient can be assessed separately.'], questions: ['How much oil was added?'], imageQuality: { level: 'limited', issues: ['A photo cannot measure exact weight.'] } });
      inventory.ingredients.forEach(item => Object.assign(item, { preparation: 'Prepared', portionNote: 'Test data: visual portion estimate.' }));
    }
    return Response.json(aiPayloadFor(analysis, options, inventory));
  }
  if (url.startsWith('https://res.cloudinary.com/')) { const data = [...storedPhotos.entries()].find(([key]) => new URL(url).pathname.endsWith('/' + key + '.jpg'))[1]; return new Response(Buffer.from(data.split(',')[1], 'base64'),{headers:{'Content-Type':data.slice(5,data.indexOf(';'))}}); }
  if (url.endsWith('/upload')) { storedPhotos.set(options.body.get('public_id'), options.body.get('file')); return Response.json({ public_id: options.body.get('public_id'), secure_url: `https://res.cloudinary.com/test-cloud/image/authenticated/v1/${options.body.get('public_id')}.jpg`, width: 1, height: 1, bytes: 68, version: 1, format: 'jpg' }); }
  if (url.endsWith('/destroy')) return Response.json({ result: 'ok' });
  throw new Error('Unexpected provider URL');
};
runner = startJobRunner({db,env,fetcher});
const server = createApp({db,env,fetcher,googleClient,wake:()=>runner.wake()});
server.listen(0, '127.0.0.1'); await once(server, 'listening');
const origin = `http://127.0.0.1:${server.address().port}`; env.APP_ORIGIN = origin; googleClient.callbackOrigin = origin;
const processHandle = spawn(chrome, ['--headless=new', '--disable-gpu', '--disable-software-rasterizer', '--remote-debugging-port=0', `--user-data-dir=${resolve(out, `chrome-profile-${Date.now()}`)}`, '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--disable-background-networking', '--hide-scrollbars', 'about:blank'], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
let ws, pending = new Map(), nextId = 0, sessionId, errors = [], chromeLog = '', fileChooser;
processHandle.stderr.on('data', chunk => { chromeLog += chunk; });
try {
  const endpoint = await new Promise((resolve, reject) => {
    let buffer = '';
    const timeout = setTimeout(() => reject(new Error('Chrome did not expose a debugging endpoint')), 20_000);
    processHandle.on('error', reject); processHandle.on('exit', code => { clearTimeout(timeout); reject(new Error(`Chrome exited: ${code}`)); });
    processHandle.stderr.on('data', chunk => { buffer += chunk; const match = /DevTools listening on (ws:\/\/[^\s]+)/.exec(buffer); if (match) { clearTimeout(timeout); resolve(match[1]); } });
  });
  ws = new WebSocket(endpoint); await once(ws, 'open');
  ws.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) { const task = pending.get(message.id); pending.delete(message.id); message.error ? task.reject(new Error(message.error.message)) : task.resolve(message.result); }
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
    if (message.method === 'Page.fileChooserOpened') fileChooser = message.params;
    if (message.method === 'Network.requestWillBeSent' && message.params.request.url.startsWith('https://res.cloudinary.com/')) errors.push('Browser requested a direct provider photo');
    if (message.method === 'Fetch.requestPaused') {
      if (message.params.request.url.startsWith('https://lh3.googleusercontent.com/')) {
        const success = message.params.request.url === avatarUrl;
        send('Fetch.fulfillRequest', { requestId: message.params.requestId, responseCode: success ? 200 : 404, responseHeaders: [{name:'Content-Type',value:'image/svg+xml'}], body: success ? Buffer.from(avatarSvg).toString('base64') : '' }, message.sessionId).catch(error => errors.push(error.message));
        return;
      }
    }
  });
  function send(method, params = {}, session = sessionId) {
    return new Promise((resolve, reject) => {
      const id = ++nextId; const timeout = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 15_000);
      pending.set(id, { resolve: result => { clearTimeout(timeout); resolve(result); }, reject: error => { clearTimeout(timeout); reject(error); } });
      ws.send(JSON.stringify({ id, method, params, ...(session ? { sessionId: session } : {}) }));
    });
  }
  const target = await send('Target.createTarget', { url: 'about:blank' }, null);
  sessionId = (await send('Target.attachToTarget', { targetId: target.targetId, flatten: true }, null)).sessionId;
  await send('Runtime.enable'); await send('Page.enable'); await send('Network.enable');
  await send('Fetch.enable', { patterns: [{urlPattern:'https://lh3.googleusercontent.com/*',requestStage:'Request'}] });
  async function evaluate(expression) {
    if (device === 'desktop') expression = expression.replaceAll('.mobile-nav [data-action=upload]', '.page-heading [data-action=upload]');
    expression = expression.replaceAll('.mobile-nav [data-action=', navigation + ' [data-action=');
    if (/\.click\(|\.requestSubmit\(|\.dispatchEvent\(/.test(expression)) await viewport(device === 'desktop' ? 1440 : 390, device === 'desktop' ? 1100 : 844, device !== 'desktop');
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true, userGesture:true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  }
  async function waitFor(expression) {
    const started = Date.now();
    while (Date.now() - started < 12_000) { if (await evaluate(expression.replace(/\??\.textContent/g, '?.textContent'))) return; await new Promise(resolve => setTimeout(resolve, 100)); }
    writeFileSync(resolve(out,'browser-last-state.json'),JSON.stringify({expression,errors,state:await evaluate("({url:location.href,text:document.body.innerText,invalid:[...document.querySelectorAll('input:invalid')].map(input=>({name:input.name,message:input.validationMessage}))})")},null,2));
    throw new Error(`Browser condition not met: ${expression}`);
  }
  async function screenshot(name, full = true) {
    await evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
    const metrics=await send('Page.getLayoutMetrics'),size=full?metrics.cssContentSize:metrics.cssLayoutViewport;
    const width=size.width??size.clientWidth,height=size.height??size.clientHeight;
    assert.ok(width>0&&height>0,'Screenshot layout must have positive dimensions');
    const result = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: full,clip:{x:0,y:full?0:metrics.cssVisualViewport.pageY,width,height,scale:1} });
    writeFileSync(resolve(out, name), Buffer.from(result.data, 'base64'));
  }
  async function viewport(width, height, mobile) { await send('Emulation.setDeviceMetricsOverride', { width, height, screenWidth: width, screenHeight: height, deviceScaleFactor: 1, mobile }); await send('Emulation.setTouchEmulationEnabled', { enabled: mobile }); }
  async function checkHelp(id, english = language === 'en') {
    const aiBefore = aiRequests, values = "JSON.stringify([...document.querySelectorAll('input,textarea,select')].map(input=>[input.name,input.id,input.value,input.checked]))";
    const before = await evaluate(values);
    for (const width of [320,390,768,1024,1440]) {
      await viewport(width,1000,width<768);
      await evaluate(`{ const button=document.querySelector('[popovertarget="${id}"]'); button.scrollIntoView({block:'center'}); button.focus(); }`);
      await evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
      await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',text:'\r',unmodifiedText:'\r',windowsVirtualKeyCode:13});
      await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
      await waitFor(`document.querySelector('#${id}').matches(':popover-open')`);
      assert.ok(await evaluate(`{const help=document.querySelector('#${id}'),r=help.getBoundingClientRect();r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight}`), 'Help fits '+width);
      assert.ok(await evaluate(`document.querySelector('[popovertarget="${id}"]').getAttribute('aria-label').startsWith(${JSON.stringify(english?'Help:':'Súgó:')})`));
      if(width===390&&['weight-help','energy-range-help','ai-cost-help'].includes(id))await screenshot(`context-${id}-mobile.png`,false);
      await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
      await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
      assert.ok(await evaluate(`!document.querySelector('#${id}').matches(':popover-open')`));
      assert.ok(await evaluate(`document.activeElement.matches('[popovertarget="${id}"]')`),'Escape keeps keyboard focus on help');
    }
    await viewport(390,844,true);
    await evaluate(`document.querySelector('[popovertarget="${id}"]').scrollIntoView({block:'center'})`);
    await evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
    await evaluate(`document.querySelector('[popovertarget="${id}"]').focus()`);
    await send('Input.dispatchKeyEvent',{type:'keyDown',key:' ',code:'Space',text:' ',windowsVirtualKeyCode:32});
    await send('Input.dispatchKeyEvent',{type:'keyUp',key:' ',code:'Space',windowsVirtualKeyCode:32});
    await waitFor(`document.querySelector('#${id}').matches(':popover-open')`);
    await viewport(391,844,true);
    await waitFor(`!document.querySelector('#${id}').matches(':popover-open')`);
    await viewport(390,844,true);
    const point=await evaluate(`{const r=document.querySelector('[popovertarget="${id}"]').getBoundingClientRect();({x:r.x+r.width/2,y:r.y+r.height/2})}`);
    await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await waitFor(`document.querySelector('#${id}').matches(':popover-open')`);
    await send('Input.dispatchMouseEvent',{type:'mousePressed',x:1,y:1,button:'left',clickCount:1});await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:1,y:1,button:'left',clickCount:1});
    assert.ok(await evaluate(`!document.querySelector('#${id}').matches(':popover-open')`),'Click outside dismisses help');
    assert.equal(await evaluate(values),before,'Help keeps entered values');assert.equal(aiRequests,aiBefore,'Help makes no AI request');
  }
  async function switchLanguage(next, scope = '') {
    await evaluate(`{ const select = document.querySelector(${JSON.stringify(scope + ' [data-language-switch]')}); select.value = ${JSON.stringify(next)}; select.dispatchEvent(new Event('change',{bubbles:true})); }`);
    assert.equal(await evaluate('document.documentElement.lang'),next);
  }
  async function auditEnglish() {
    if(language !== 'en')return;
    const remaining=await evaluate(`(async()=>{const {translate}=await import('/i18n.mjs');const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT),result=[];while(walker.nextNode()){const node=walker.currentNode,value=node.textContent.trim();if(value&&!node.parentElement.closest('script,style,[data-language-switch]')&&translate(value,'en')!==value)result.push(value);}return result;})()`);
    assert.deepEqual(remaining,[],'Untranslated interface text');
  }
  for (const [address, initialLanguage] of [['84.2.44.1', 'hu'], ['2001:4c48::1', 'hu'], ['8.8.8.8', 'en']]) {
    await send('Network.clearBrowserCookies');
    await send('Network.setExtraHTTPHeaders', { headers: { 'X-Envoy-External-Address': address, 'Accept-Language': initialLanguage === 'hu' ? 'en-US' : 'hu-HU' } });
    await send('Page.navigate', { url: origin });
    await waitFor("document.documentElement.dataset.languageReady === 'true' && !!document.querySelector('#google-signin')");
    assert.equal(await evaluate('document.documentElement.lang'), initialLanguage);
    assert.equal(await evaluate("document.querySelector('[data-language-switch]').value"), initialLanguage);
  }
  await send('Network.setExtraHTTPHeaders', { headers: {} });
  await viewport(1440, 1100, false); await send('Page.navigate', { url: origin + '?lang=' + language });
  await waitFor("document.documentElement.dataset.languageReady === 'true' && !!document.querySelector('#google-signin') && document.querySelector('#google-signin').getAttribute('aria-disabled') !== 'true'");
  assert.ok(await evaluate("!!document.querySelector('#google-signin')"));
  await switchLanguage(language === 'en' ? 'hu' : 'en'); await switchLanguage(language);
  await auditEnglish();
  for (const width of [320,390,768,1024,1440]) { await viewport(width,844,width<768); assert.ok(await evaluate('document.documentElement.scrollWidth <= innerWidth'), 'Login fits '+width); }
  await viewport(1440,1100,false); await screenshot('login-desktop.png');
  await evaluate("document.querySelector('#google-signin').click()");
  await waitFor("document.querySelector('#loading')?.hidden === true");
  assert.equal(await evaluate("document.querySelector('#meal-count').textContent"),'0');
  await waitFor("!document.querySelector('#motivation-card').hidden");
  assert.equal(await evaluate("document.querySelectorAll('#motivation-card .growth-steps .complete').length"),0);
  await evaluate("document.querySelector('[data-action=prev-day]').click(); document.querySelector('#motivation-card [data-action=log-today]').click()");
  await waitFor("document.querySelector('#upload-dialog').open");
  assert.ok(await evaluate("new Date(document.querySelector('#upload-day').value+'T12:00:00').toDateString() === new Date().toDateString()"));
  await evaluate("document.querySelector('#upload-dialog [data-close]').click()");
  await waitFor("document.querySelector('.avatar img')?.naturalWidth === 64");
  assert.equal(await evaluate("document.querySelector('.avatar img').referrerPolicy"), 'no-referrer');
  await evaluate(`(async () => { const {renderAvatar} = await import('/profile-ui.mjs'); const element = document.createElement('span'); element.id = 'avatar-test'; document.body.append(element); for (const avatarUrl of [null, 'javascript:alert(1)', 'https://evil.test/photo', 'https://lh3.googleusercontent.com.evil.test/photo', 'http://lh3.googleusercontent.com/photo']) { renderAvatar(element, { name: 'Teszt Elek', avatarUrl }); if (element.querySelector('img') || element.textContent !== 'TE') throw Error('Invalid avatar fallback'); } renderAvatar(element, { name: 'Teszt Elek', avatarUrl: 'https://lh3.googleusercontent.com/missing' }); })()`);
  await waitFor("document.querySelector('#avatar-test').textContent === 'TE' && !document.querySelector('#avatar-test img')");
  await evaluate("document.querySelector('#avatar-test').remove()");
  assert.equal(await evaluate("getComputedStyle(document.querySelector('#month-label')).textTransform"),'none');
  assert.ok(await evaluate("!document.querySelector('#demo-button')"));
  assert.ok(await evaluate("document.querySelector('#admin-link').hidden && !document.querySelector('#connection-status')"), 'Ordinary users have no admin link or provider panel');
  await screenshot('desktop.png');
  for (const width of [320,390,768,1024,1440]) { await viewport(width,844,width<768); assert.ok(await evaluate('document.documentElement.scrollWidth <= innerWidth'), 'App fits '+width); }
  await viewport(device === 'desktop' ? 1440 : 390, device === 'desktop' ? 1100 : 844, device !== 'desktop'); await screenshot('mobile.png');
  assert.equal(await evaluate("getComputedStyle(document.querySelector('.mobile-nav')).display"),device === 'desktop' ? 'none' : 'flex');
  await evaluate("document.querySelector('.mobile-nav [data-action=calendar]').click()");
  assert.equal(await evaluate('document.activeElement.id'),'calendar');
  const initialMonth=await evaluate("document.querySelector('#month-label').textContent");
  await evaluate("document.querySelector('[data-action=next-month]').click()");
  await waitFor(`document.querySelector('#month-label').textContent !== ${JSON.stringify(initialMonth)} && document.querySelector('#loading').hidden`);
  await evaluate("document.querySelector('[data-action=prev-month]').click()");
  await waitFor(`document.querySelector('#month-label').textContent === ${JSON.stringify(initialMonth)} && document.querySelector('#loading').hidden`);
  await evaluate("document.querySelector('[data-action=next-day]').click(); document.querySelector('[data-action=prev-day]').click(); document.querySelector('[data-action=today]').click()");
  await evaluate("document.querySelector('.mobile-nav [data-action=learn]').click()");
  assert.ok(await evaluate("document.querySelector('#learn-dialog').open"));
  assert.ok((await evaluate("document.querySelector('#learn-dialog a').getAttribute('href')")).endsWith(language === 'en' ? '/guide' : '/utmutato'));
  for (const width of [320,390,768,1024,1440]) {
    await viewport(width,900,width<768);
    assert.ok(await evaluate("document.querySelector('#learn-dialog').scrollWidth <= document.querySelector('#learn-dialog').clientWidth"), 'Methodology fits '+width);
  }
  await viewport(1440,1100,false); await screenshot('methodology-desktop.png',false);
  await viewport(390,844,true); await screenshot('methodology-mobile.png',false);
  await auditEnglish();
  await evaluate("document.querySelector('#learn-dialog [data-close]').click()");
  await evaluate("document.querySelector('.mobile-nav [data-action=upload]').click()");
  assert.ok(await evaluate("[...document.querySelectorAll('#upload-form input:not([type=file]),#upload-form textarea,#upload-form select')].every(field => field.closest('details') && !field.closest('details').open)"), 'All supplementary fields start collapsed');
  assert.ok(await evaluate("document.querySelector('#upload-form').checkValidity() && document.querySelector('#dish-profile').value === 'generic'"), 'Metadata is already valid without manual entry');
  assert.ok(await evaluate("!document.querySelector('#second-photo-input').closest('details') && !document.querySelector('#second-photo-input').closest('[hidden]')"), 'The required second view is visible outside optional fields');
  await screenshot('upload-simple.png', false);
  await evaluate("document.querySelector('#context-panel').open=true; document.querySelector('#upload-dialog [data-close]').click(); document.querySelector('.mobile-nav [data-action=upload]').click()");
  assert.ok(await evaluate("![...document.querySelectorAll('#upload-form details')].some(element => element.open)"), 'Reopening upload collapses optional fields again');
  await evaluate("document.querySelector('#dish-profile').value='fozelek'; document.querySelector('#dish-profile').dispatchEvent(new Event('change')); document.querySelector('#preparation-notes').value='20%-os tejföllel habart'");
  assert.ok(await evaluate(`document.querySelector('#dish-guidance').textContent.includes(${JSON.stringify(expected('Rántással','thickened'))})`));
  assert.ok(await evaluate("!document.querySelector('#context-consumed') && document.querySelector('.portion-policy').textContent.includes('100%')"));
  const doc = await send('DOM.getDocument'); const fileInput = await send('DOM.querySelector', { nodeId: doc.root.nodeId, selector: '#photo-input' });
  await send('DOM.setFileInputFiles', { nodeId: fileInput.nodeId, files: [photoFile] });
  await waitFor("!document.querySelector('#photo-preview').hidden");
  assert.ok((await evaluate("document.querySelector('#photo-preview').src")).startsWith('data:image/jpeg;base64,'));
  await send('Page.setInterceptFileChooserDialog',{enabled:true});
  await evaluate("document.querySelector('#camera-button').click()");
  for(let attempt=0;!fileChooser&&attempt<30;attempt++)await new Promise(resolve=>setTimeout(resolve,50));
  assert.ok(fileChooser,'Camera control opens the native file chooser');
  const cameraInput=await send('DOM.querySelector',{nodeId:doc.root.nodeId,selector:'#camera-input'});
  assert.equal((await send('DOM.describeNode',{nodeId:cameraInput.nodeId})).node.backendNodeId,fileChooser.backendNodeId);
  assert.equal(await evaluate("document.querySelector('#camera-input').getAttribute('capture')"),'environment');
  await send('DOM.setFileInputFiles',{nodeId:cameraInput.nodeId,files:[photoFile]});
  await waitFor("!document.querySelector('#analyze-button').disabled");
  const beforePair = providerCalls;
  await evaluate("document.querySelector('#upload-form').requestSubmit()");
  assert.ok(await evaluate(`!document.querySelector('#upload-error').hidden && document.querySelector('#upload-error').textContent.includes(${JSON.stringify(expected('Két fotó szükséges', 'Two photos are required'))})`));
  assert.equal(providerCalls, beforePair, 'A single photo cannot start provider work');
  await evaluate("document.querySelector('#context-panel').open = true; document.querySelector('#context-weight').value='100'");
  const angleInput = await send('DOM.querySelector', { nodeId: doc.root.nodeId, selector: '#second-photo-input' });
  await send('DOM.setFileInputFiles', { nodeId: angleInput.nodeId, files: [photoFile] });
  await waitFor("!document.querySelector('#analyze-button').disabled");
  assert.ok(await evaluate(`document.querySelector('.second-preview-wrap').hidden && document.querySelector('#upload-error').textContent.includes(${JSON.stringify(expected('Ugyanazt a képet', 'same image twice'))})`));
  assert.equal(providerCalls, beforePair, 'Duplicate images cannot start provider work');
  const anglePhotoFile = resolve(out, 'upload-angle-fixture.png');
  const anglePng = await evaluate("(() => { const canvas = document.createElement('canvas'); canvas.width = 2400; canvas.height = 1600; const ctx = canvas.getContext('2d'); ctx.fillStyle = '#648043'; ctx.fillRect(0,0,2400,1600); ctx.fillStyle = '#efe4c9'; ctx.fillRect(500,300,1200,900); return canvas.toDataURL('image/png').split(',')[1]; })()");
  writeFileSync(anglePhotoFile, Buffer.from(anglePng, 'base64'));
  fileChooser = null;
  await evaluate("document.querySelector('#second-camera-button').click()");
  for (let attempt = 0; !fileChooser && attempt < 30; attempt++) await new Promise(resolve => setTimeout(resolve, 50));
  const secondCamera = await send('DOM.querySelector', { nodeId: doc.root.nodeId, selector: '#second-camera-input' });
  assert.equal((await send('DOM.describeNode', { nodeId: secondCamera.nodeId })).node.backendNodeId, fileChooser?.backendNodeId);
  assert.equal(await evaluate("document.querySelector('#second-camera-input').getAttribute('capture')"), 'environment');
  await send('DOM.setFileInputFiles', { nodeId: secondCamera.nodeId, files: [anglePhotoFile] });
  await waitFor("!document.querySelector('.second-preview-wrap').hidden");
  await waitFor("document.querySelector('#second-photo-preview').naturalWidth === 2048");
  await evaluate("document.querySelector('#remove-second-photo').click()");
  assert.ok(await evaluate("document.querySelector('.second-preview-wrap').hidden"));
  await send('DOM.setFileInputFiles', { nodeId: angleInput.nodeId, files: [anglePhotoFile] });
  await waitFor("!document.querySelector('.second-preview-wrap').hidden");
  const uploadBefore=await evaluate("JSON.stringify({photo:document.querySelector('#photo-preview').src,second:document.querySelector('#second-photo-preview').src,weight:document.querySelector('#context-weight').value,notes:document.querySelector('#preparation-notes').value,profile:document.querySelector('#dish-profile').value,type:document.querySelector('#upload-type').value})");
  await switchLanguage(language === 'en' ? 'hu' : 'en','#upload-dialog'); await switchLanguage(language,'#upload-dialog');
  assert.equal(await evaluate("JSON.stringify({photo:document.querySelector('#photo-preview').src,second:document.querySelector('#second-photo-preview').src,weight:document.querySelector('#context-weight').value,notes:document.querySelector('#preparation-notes').value,profile:document.querySelector('#dish-profile').value,type:document.querySelector('#upload-type').value})"),uploadBefore);
  await auditEnglish();
  await checkHelp('photo-help');await checkHelp('weight-help');
  await evaluate("document.querySelector('#upload-form').requestSubmit()");
  await waitFor("!!document.querySelector('#retry-meal')");
  assert.equal(aiRequests, 1, 'A failed analysis sends exactly one AI request');
  await auditEnglish();
  await evaluate("document.querySelector('#retry-meal').click()");
  await waitFor("document.querySelector('#detail-calories')?.textContent === '160'");
  assert.equal(aiRequests, 2, 'The explicit retry sends one further AI request');
  assert.equal(await evaluate("document.querySelector('#detail-calories').textContent"), '160');
  assert.ok(await evaluate("document.querySelector('.analysis-report') && document.querySelector('.additional-view')"));
  for(const id of ['confidence-help','edit-nutrients-help','portion-values-help','energy-range-help'])await checkHelp(id);
  assert.ok(await evaluate("![...document.querySelectorAll('.report-disclosure')].some(element => element.open) && !document.querySelector('[name=notes]').closest('details').open"), 'Optional review questions and notes start collapsed');
  await evaluate("document.querySelector('#add-ingredient').click()");
  assert.equal(await evaluate("document.querySelectorAll('[data-ingredient]').length"),2);
  await evaluate("document.querySelector('[data-remove=\"1\"]').click()");
  assert.equal(await evaluate("document.querySelectorAll('[data-ingredient]').length"),1);
  await evaluate("document.querySelector('[name=type]').value='Ebéd'; document.querySelector('[name=notes]').value='Saját megjegyzés — lunch & dinner'; document.querySelector('[name=notes]').dispatchEvent(new Event('input',{bubbles:true}))");
  await evaluate("document.querySelector('[name=i-0-grams]').value='200'; document.querySelector('[name=i-0-grams]').dispatchEvent(new Event('input',{bubbles:true}))");
  assert.equal(await evaluate("document.querySelector('#detail-calories').textContent"), '320');
  await switchLanguage(language === 'en' ? 'hu' : 'en','#meal-dialog'); await switchLanguage(language,'#meal-dialog');
  assert.equal(await evaluate("document.querySelector('[name=i-0-grams]').value"),'200');
  assert.equal(await evaluate("document.querySelector('#detail-calories').textContent"),'320');
  assert.equal(await evaluate("document.querySelector('[name=notes]').value"),'Saját megjegyzés — lunch & dinner');
  assert.equal(await evaluate("document.querySelector('[name=type]').value"),'Ebéd');
  await evaluate("document.querySelector('[data-reference-index=\"0\"]').value='fdc-171705'; document.querySelector('[data-reference-index=\"0\"]').dispatchEvent(new Event('change',{bubbles:true}))");
  await evaluate("document.querySelector('[name=i-0-measured]').click()");
  assert.ok(await evaluate(`document.querySelector('#report-weight-note').textContent.includes(${JSON.stringify(expected('Külön lemért','separately weighed'))})`));
  await evaluate("document.querySelector('#ingredient-list .source-picker').open=true; document.querySelector('[data-food-query]').value='avocado raw'; document.querySelector('[data-food-search]').click()");
  await waitFor("!!document.querySelector('[data-food-id]')");
  await evaluate("document.querySelector('[data-food-id]').click()");
  await waitFor("document.querySelector('.source-picker a')?.textContent.includes('99991')");
  await evaluate("document.querySelector('#ingredient-list .source-picker').open=true; document.querySelector('#ingredient-list .nutrient-inputs').closest('details').open=true");
  for (const width of [320, 390]) {
    await viewport(width, 844, true);
    assert.ok(await evaluate("document.querySelector('#meal-detail').scrollWidth <= document.querySelector('#meal-detail').clientWidth"), `Expanded source and nutrient controls fit at ${width}px`);
  }
  assert.equal(await evaluate("document.querySelector('[data-source-label=\"0\"]').textContent"), expected('USDA-adat', 'USDA data'));
  await auditEnglish();
  await evaluate("document.querySelector('[data-reference-index]').value='fdc-171257'; document.querySelector('[data-reference-index]').dispatchEvent(new Event('change',{bubbles:true})); document.querySelector('.source-picker').open=true");
  assert.ok(await evaluate(`document.querySelector('.reference-caution').textContent.includes(${JSON.stringify(expected('magyar 12%-os vagy 20%-os','Hungarian sour cream with 12% or 20% fat'))})`));
  for(const width of [320,390]) { await viewport(width,844,true); assert.ok(await evaluate("document.querySelector('#meal-detail').scrollWidth <= document.querySelector('#meal-detail').clientWidth"),'Long Hungarian reference and caveat fit '+width); }
  await evaluate("document.querySelector('[data-reference-index]').value='fdc-171705'; document.querySelector('[data-reference-index]').dispatchEvent(new Event('change',{bubbles:true}))");
  await evaluate("document.querySelector('[name=i-0-protein]').value='3'; document.querySelector('[name=i-0-protein]').dispatchEvent(new Event('input',{bubbles:true}))");
  assert.equal(await evaluate("document.querySelector('[data-source-label=\"0\"]').textContent"), expected('Saját értékek', 'Your own values'));
  await evaluate("document.querySelector('[data-reference-index=\"0\"]').value='fdc-171705'; document.querySelector('[data-reference-index=\"0\"]').dispatchEvent(new Event('change',{bubbles:true}))");
  const reviewWidth = await evaluate("({scroll:document.querySelector('#meal-detail').scrollWidth,client:document.querySelector('#meal-detail').clientWidth})");
  assert.ok(reviewWidth.scroll <= reviewWidth.client, `Review form fits mobile dialog: ${JSON.stringify(reviewWidth)}`);
  await screenshot('mobile-review.png', false);
  await evaluate("document.querySelector('#ingredient-list .source-picker').open=true; document.querySelector('#ingredient-list').scrollIntoView({block:'start'})");
  await screenshot('mobile-ingredients.png', false);
  await evaluate("document.querySelector('#detail-form').requestSubmit()");
  await waitFor("document.querySelector('#meal-count').textContent === '1' && !document.querySelector('#meal-dialog').open");
  await waitFor(`document.querySelector('#toast').textContent.includes(${JSON.stringify(expected('Új jelvényt szereztél!', 'You earned a badge!'))})`);
  await switchLanguage(language === 'en' ? 'hu' : 'en');
  await switchLanguage(language);
  assert.ok(await evaluate(`document.querySelector('#toast').textContent.includes(${JSON.stringify(expected('Új jelvényt szereztél!', 'You earned a badge!'))})`));
  assert.equal(await evaluate("document.querySelectorAll('#motivation-card .growth-steps .complete').length"),1);
  assert.equal(await evaluate("document.querySelector('#calorie-total').textContent"), '320');
  for (const width of [320,390,768,1024,1440]) { await viewport(width,844,width<768); assert.ok(await evaluate('document.documentElement.scrollWidth <= innerWidth'), 'Saved meal fits '+width); assert.ok(await evaluate("document.querySelector('.meal-card').getBoundingClientRect().right <= document.querySelector('main').getBoundingClientRect().right")); }
  await viewport(device === 'desktop' ? 1440 : 390, device === 'desktop' ? 1100 : 844, device !== 'desktop');
  await send('Page.reload'); await waitFor("document.querySelector('#meal-count').textContent === '1'");
  await evaluate("document.querySelector('#meal-list [data-meal]').click()");
  await evaluate("document.querySelector('.recipe-tools').open=true; document.querySelector('#recipe-start').click()");
  assert.ok(await evaluate("document.querySelector('#save-meal').disabled"));
  assert.ok(await evaluate(`document.querySelector('.analysis-report').hidden && document.querySelector('#detail-heading').textContent.includes(${JSON.stringify(expected('teljes recept','whole recipe'))})`));
  await evaluate("document.querySelector('#recipe-cooked').value='800'; document.querySelector('#recipe-eaten').value='100'; document.querySelector('#recipe-apply').click()");
  assert.ok(await evaluate("!document.querySelector('#recipe-error').hidden"));
  await switchLanguage(language === 'en' ? 'hu' : 'en','#meal-dialog'); await switchLanguage(language,'#meal-dialog');
  assert.equal(await evaluate("document.querySelector('#recipe-cooked').value"),'800');
  assert.equal(await evaluate("document.querySelector('#recipe-eaten').value"),'100');
  assert.ok(await evaluate("!document.querySelector('#recipe-error').hidden"));
  await evaluate("document.querySelector('#recipe-losses').checked=true; document.querySelector('#recipe-apply').click()");
  assert.equal(await evaluate("document.querySelector('#detail-calories').textContent"),'40');
  await auditEnglish();
  assert.equal(await evaluate("document.querySelector('#report-weight').textContent.trim()"),'100 g');
  assert.ok(await evaluate("document.querySelector('[name=i-0-grams]').disabled"));
  await evaluate("document.querySelector('#recipe-edit').click(); document.querySelector('#recipe-cancel').click()");
  assert.equal(await evaluate("document.querySelector('#detail-calories').textContent"),'40');
  for (const width of [320,390]) { await viewport(width,844,true); assert.ok(await evaluate("document.querySelector('#meal-detail').scrollWidth <= document.querySelector('#meal-detail').clientWidth"),'Recipe fits '+width); }
  await evaluate("document.querySelector('.recipe-tools').scrollIntoView({block:'start'})");
  await screenshot('mobile-recipe.png',false);
  await evaluate("document.querySelector('#detail-form').requestSubmit()");
  await waitFor("!document.querySelector('#meal-dialog').open && document.querySelector('#calorie-total').textContent==='40'");
  await send('Page.reload'); await waitFor("document.querySelector('#calorie-total')?.textContent==='40'");
  const savedRecipe=await db.prepare('SELECT day,analysis,original_analysis,analysis_context FROM meals').bind().first();
  assert.equal(JSON.parse(savedRecipe.analysis).recipe.cookedWeightG,800);
  assert.equal(JSON.parse(savedRecipe.original_analysis).ingredients[0].grams,100);
  assert.equal(JSON.parse(savedRecipe.analysis_context).portionScope,'full_image');
  assert.equal(JSON.parse(savedRecipe.analysis_context).consumedPercent,undefined);
  assert.equal(JSON.parse(savedRecipe.analysis_context).preparationNotes,'20%-os tejföllel habart');
  assert.equal(JSON.parse(savedRecipe.analysis_context).language,language);
  await evaluate("document.querySelector('.mobile-nav [data-action=settings]').click()");
  await waitFor("document.querySelectorAll('.activity-day').length === 365");
  await waitFor("document.querySelector('.profile-initials img')?.naturalWidth === 64");
  assert.equal(await evaluate("document.querySelectorAll('.growth-badge').length"),6);
  assert.equal(await evaluate("document.querySelectorAll('.growth-badge.earned').length"),1);
  assert.equal(await evaluate("document.querySelector('[data-badge=first]').dataset.earned"),'true');
  assert.equal(await evaluate("document.querySelector('#growth-level-progress').value"),1);
  assert.equal(await evaluate("document.querySelector('.profile-stat strong').textContent.trim()"), '1');
  assert.ok(await evaluate("document.querySelectorAll('.profile-stat strong')[4].textContent.startsWith('40')"));
  assert.equal(await evaluate(`document.querySelector('.activity-day[data-profile-day="${savedRecipe.day}"]').dataset.level`), '1');
  assert.equal(await evaluate("document.querySelector('#profile-period').value"), '30');
  assert.equal(await evaluate("document.querySelectorAll('.profile-day-list li').length"), 7);
  assert.ok(await evaluate("[...document.querySelectorAll('#profile-summary details')].every(section => !section.open)"));
  assert.ok(await evaluate("document.querySelector('#profile-energy-progress').max > 0"));
  await evaluate("document.querySelector('#profile-period').value='7'; document.querySelector('#profile-period').dispatchEvent(new Event('change',{bubbles:true}))");
  assert.equal(await evaluate("document.querySelector('#profile-period').value"), '7');
  assert.equal(await evaluate("document.querySelectorAll('#profile-period-content tbody tr').length"), 4);
  await evaluate("document.querySelector('#profile-nutrition-details').open=true");
  await auditEnglish();
  await evaluate("document.querySelector('#profile-period').value='365'; document.querySelector('#profile-period').dispatchEvent(new Event('change',{bubbles:true}))");
  assert.ok(await evaluate("document.querySelectorAll('#profile-period-content .profile-stat strong')[0].textContent.startsWith('40')"));
  for (const width of [320,390,768,1024,1440]) {
    await viewport(width,900,width<768);
    assert.ok(await evaluate("document.querySelector('#settings-dialog').scrollWidth <= document.querySelector('#settings-dialog').clientWidth"), 'Profile fits '+width);
  }
  await evaluate("document.querySelector('#calorie-goal').value='2355'");
  await switchLanguage(language === 'en' ? 'hu' : 'en', '#settings-dialog'); await switchLanguage(language, '#settings-dialog');
  assert.equal(await evaluate("document.querySelector('#calorie-goal').value"), '2355');
  assert.equal(await evaluate("document.querySelector('#profile-period').value"), '365');
  await auditEnglish();
  await viewport(390,844,true);
  await evaluate("document.querySelector('.profile-growth').scrollIntoView({block:'start'})");
  await evaluate("(async()=>{const images=[...document.querySelectorAll('.growth-badge-image')];if(images.length!==6)throw Error('Six badge images required');for(const image of images){image.loading='eager';await image.decode();if(image.naturalWidth<250)throw Error('Badge image did not load');}})()");
  await screenshot('growth-mobile.png',false);
  await evaluate("document.querySelector('.growth-badges').scrollIntoView({block:'start'})");
  await screenshot('badges-mobile.png',false);
  await evaluate("document.querySelector('#profile-nutrition-details').open=true; document.querySelector('#profile-daily-details').open=true");
  for (const width of [320,390,768,1024,1440]) {
    await viewport(width,900,width<768);
    assert.ok(await evaluate("document.querySelector('#settings-dialog').scrollWidth <= document.querySelector('#settings-dialog').clientWidth"), 'Expanded profile fits '+width);
  }
  await viewport(390,844,true);
  await evaluate("document.querySelector('#profile-nutrition-details').scrollIntoView({block:'start'})");
  await screenshot('profile-details-mobile.png',false);
  await evaluate("document.querySelector('#profile-nutrition-details').open=false; document.querySelector('#profile-daily-details').open=false; document.querySelector('#settings-dialog').scrollTop=0");
  await viewport(1440,1100,false); await screenshot('profile-desktop.png',false);
  await viewport(390,844,true);
  await evaluate("document.querySelector('.activity-scroll').scrollLeft=document.querySelector('.activity-scroll').scrollWidth");
  await screenshot('profile-mobile.png',false);
  await evaluate("document.querySelector('.activity-day[tabindex=\"0\"]').focus()");
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Home',code:'Home'});
  assert.ok(await evaluate("document.activeElement === document.querySelector('.activity-day')"));
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'End',code:'End'});
  assert.ok(await evaluate("document.activeElement === [...document.querySelectorAll('.activity-day')].at(-1)"));
  await evaluate(`document.querySelector('.activity-day[data-profile-day="${savedRecipe.day}"]').click()`);
  await waitFor("!document.querySelector('#settings-dialog').open && document.querySelector('#meal-list [data-meal]')");
  await evaluate("document.querySelector('#meal-list [data-meal]').click()");
  await evaluate("document.querySelector('#delete-meal').click(); document.querySelector('#confirm-dialog [data-close]').click()");
  assert.ok(await evaluate("!document.querySelector('#confirm-dialog').open && document.querySelector('#meal-dialog').open"));
  await evaluate("document.querySelector('#delete-meal').click(); document.querySelector('#confirm-delete').click()");
  await waitFor("document.querySelector('#meal-count').textContent === '0' && !document.querySelector('#meal-dialog').open");
  await waitFor("document.querySelector('#draft-list').children.length === 0");
  assert.equal(providerCalls, 8, 'Provider calls excluding protected photo reads'); assert.deepEqual(errors, []);
  await evaluate("document.querySelector('.mobile-nav [data-action=settings]').click()");
  await waitFor("document.querySelectorAll('.activity-day').length === 365");
  assert.equal(await evaluate("document.querySelector('.profile-stat strong').textContent.trim()"), '0');
  assert.equal(await evaluate("document.querySelectorAll('.growth-badge.earned').length"),0);
  assert.ok(await evaluate("document.querySelectorAll('.profile-stat strong')[4].textContent.startsWith('—')"));
  await evaluate("document.querySelector('#calorie-goal').value='2300'; document.querySelector('#settings-form').requestSubmit()");
  await waitFor("!document.querySelector('#settings-dialog').open");
  assert.equal((await db.prepare('SELECT calorie_goal FROM users').bind().first()).calorie_goal,2300);
  await evaluate("document.querySelector('.mobile-nav [data-action=settings]').click()");
  await waitFor("document.querySelector('#profile-summary').getAttribute('aria-busy') === 'false'");
  const label = normalizeLabel(productLabelFixture()), packagedId = randomUUID(), owner = (await db.prepare('SELECT id FROM users').bind().first()).id;
  const packaged = validateAnalysis({ name: 'Test drink', confidence: 'high', ingredients: [{ name: label.productName, grams: 330, gramsMin: 330, gramsMax: 330, quantityUnit: 'ml', productLabel: label, sourceType: 'label', weightBasis: 'label', foodState: 'as_sold', ...labelNutrients(label) }] });
  storedPhotos.set('yumetrics/'+packagedId,'data:image/png;base64,'+readFileSync('public/badges/first.png').toString('base64'));
  await db.prepare('INSERT INTO meals(id,user_id,day,time,type,status,analysis,original_analysis,photo,public_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').bind(packagedId, owner, savedRecipe.day, '15:00', 'Kisétkezés', 'draft', JSON.stringify(packaged), JSON.stringify(packaged), JSON.stringify({publicId:'yumetrics/'+packagedId,type:'authenticated',url:'https://res.cloudinary.com/test-cloud/image/authenticated/v1/yumetrics/'+packagedId+'.jpg'}), packagedId, new Date().toISOString(), new Date().toISOString()).run();
  await send('Page.reload'); await waitFor("!!document.querySelector('#draft-list button') && document.querySelector('#loading').hidden");
  await evaluate("document.querySelector('#draft-list button').click()");
  assert.equal(await evaluate("document.querySelector('#report-weight').textContent.trim()"),'330 ml');
  assert.ok(await evaluate(`document.querySelector('[data-source-label="0"]').textContent.includes(${JSON.stringify(expected('Címkéről','label'))})`));
  assert.ok(await evaluate(`document.querySelector('[name=i-0-grams]').closest('label').textContent.includes('ml')`));
  assert.equal(await evaluate("document.querySelectorAll('[data-reference-index]').length"),0);
  assert.ok(await evaluate(`['fiber','sodium'].every(key=>document.querySelector('[name=i-0-'+key+']').placeholder === ${JSON.stringify(expected('Ismeretlen','Unknown'))})`));
  assert.equal(await evaluate("document.querySelector('[data-package-count]').textContent"),'1');
  await evaluate("document.querySelector('.product-label-details').open=true");
  assert.ok(await evaluate(`document.querySelector('.product-label-details').textContent.includes(${JSON.stringify(expected('0,0125','0.0125'))})`));
  for (const width of [320,390,768,1024,1440]) { await viewport(width,900,width<768); assert.ok(await evaluate("document.querySelector('#meal-dialog').scrollWidth <= document.querySelector('#meal-dialog').clientWidth"),'Packaged label fits '+width); }
  await auditEnglish();
  await viewport(390,844,true); await evaluate("document.querySelector('.product-label-details').scrollIntoView({block:'start'})"); await screenshot('packaged-label-mobile.png',false);
  await evaluate("document.querySelector('[name=i-0-grams]').value='165'; document.querySelector('[name=i-0-grams]').dispatchEvent(new Event('input',{bubbles:true}))");
  assert.equal(await evaluate("document.querySelector('#report-weight').textContent.trim()"),'165 ml');
  assert.equal(await evaluate("document.querySelector('#detail-calories').textContent"),'69');
  await evaluate("document.querySelector('#detail-form').requestSubmit()");
  await waitFor("!document.querySelector('#meal-dialog').open && document.querySelector('#meal-count').textContent==='1'");
  let savedLabel = JSON.parse((await db.prepare('SELECT analysis FROM meals WHERE id=?').bind(packagedId).first()).analysis);
  assert.equal(savedLabel.ingredients[0].quantityUnit,'ml'); assert.equal(savedLabel.ingredients[0].sourceType,'label'); assert.equal(savedLabel.ingredients[0].grams,165);
  await evaluate("document.querySelector('#meal-list [data-meal]').click()");
  await evaluate("document.querySelector('[name=i-0-calories]').value='99'; document.querySelector('[name=i-0-calories]').dispatchEvent(new Event('input',{bubbles:true}))");
  assert.ok(await evaluate(`document.querySelector('[data-source-label="0"]').textContent.includes(${JSON.stringify(expected('Saját','Your own'))})`));
  await evaluate("document.querySelector('#detail-form').requestSubmit()"); await waitFor("!document.querySelector('#meal-dialog').open");
  savedLabel = JSON.parse((await db.prepare('SELECT analysis FROM meals WHERE id=?').bind(packagedId).first()).analysis);
  assert.equal(savedLabel.ingredients[0].sourceType,'user'); assert.equal(savedLabel.ingredients[0].productLabel.nutrients.calories,42);
  const rangeMeal = { analysis: structuredClone(savedLabel) };
  Object.assign(rangeMeal.analysis.ingredients[0], { weightBasis: 'visual', gramsMin: 120, gramsMax: 200 });
  await evaluate(`(async()=>{const {ingredientMarkup,reportMarkup,refreshReport}=await import('/analysis-ui.mjs');const meal=${JSON.stringify(rangeMeal)};document.querySelector('#meal-detail').innerHTML=reportMarkup(meal)+'<div data-ingredient="0">'+ingredientMarkup(meal.analysis.ingredients[0],0)+'</div>';refreshReport(meal);const portion=document.querySelector('[data-portion-label="0"]');if(!portion.textContent.includes('ml'))throw Error('Liquid range lost its ml unit');const source=document.querySelector('.source-picker');source.open=true;refreshReport(meal);if(!source.isConnected||!source.open)throw Error('Source disclosure was replaced during refresh');meal.analysis.ingredients[0].weightBasis='measured_ingredient';refreshReport(meal);if(!portion.textContent.includes(${JSON.stringify(expected('térfogat', 'volume'))}))throw Error('Measured liquid is described as mass');})()`);
  await db.prepare('DELETE FROM meals WHERE id=?').bind(packagedId).run();
  const multiId=randomUUID(),multi=validateAnalysis(multiFoodAnalysis(language)),multiTime=new Date().toISOString();
  storedPhotos.set('yumetrics/'+multiId,'data:image/png;base64,'+readFileSync('public/badges/first.png').toString('base64'));
  await db.prepare('INSERT INTO meals(id,user_id,day,time,type,status,analysis,original_analysis,photo,public_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').bind(multiId,owner,savedRecipe.day,'12:00','Ebéd','draft',JSON.stringify(multi),JSON.stringify(multi),JSON.stringify({publicId:'yumetrics/'+multiId,type:'authenticated',url:'https://res.cloudinary.com/test-cloud/image/authenticated/v1/yumetrics/'+multiId+'.jpg'}),'yumetrics/'+multiId,multiTime,multiTime).run();
  await send('Page.reload');await waitFor("!!document.querySelector('#draft-list button') && document.querySelector('#loading').hidden");
  await evaluate("document.querySelector('#draft-list button').click()");
  assert.deepEqual(await evaluate("[...document.querySelectorAll('#food-breakdown tbody th')].map(node=>node.textContent.trim())"),multi.ingredients.map(item=>item.name));
  assert.equal(await evaluate("document.querySelectorAll('#food-breakdown tbody tr').length"),4);
  assert.equal(await evaluate("document.querySelector('#food-breakdown tbody tr [data-nutrient=calories]').textContent"),expected('247,5','247.5'));
  assert.equal(await evaluate("document.querySelector('#food-breakdown tfoot [data-nutrient=calories]').textContent"),expected('642,5','642.5'));
  assert.equal(await evaluate("document.querySelector('#food-breakdown tfoot [data-nutrient=sodium]').textContent"),'—');
  assert.ok(await evaluate("document.querySelector('#food-breakdown tbody tr:last-child td').textContent.includes('250 ml')"));
  for(const width of [320,390,768,1024,1440]){await viewport(width,900,width<768);assert.ok(await evaluate("document.querySelector('#meal-dialog').scrollWidth<=document.querySelector('#meal-dialog').clientWidth"),'Per-food table fits '+width);if(width<480)assert.ok(await evaluate("document.querySelector('#food-breakdown tbody tr [data-nutrient=calories]').getBoundingClientRect().right<=document.querySelector('#food-breakdown .food-table-scroll').getBoundingClientRect().right"),'Food calories visible without scrolling at '+width);}
  await viewport(1440,1100,false);await evaluate("document.querySelector('#food-breakdown').scrollIntoView({block:'start'})");await screenshot('food-breakdown-desktop.png',false);
  await viewport(390,844,true);await evaluate("document.querySelector('#food-breakdown').scrollIntoView({block:'start'})");await screenshot('food-breakdown-mobile.png',false);
  await evaluate("document.querySelector('#food-breakdown .food-table-scroll').scrollLeft=200;document.querySelector('[name=i-0-grams]').value='200';document.querySelector('[name=i-0-grams]').dispatchEvent(new Event('input',{bubbles:true}))");
  assert.equal(await evaluate("document.querySelector('#food-breakdown tbody tr [data-nutrient=calories]').textContent"),'330');
  assert.equal(await evaluate("document.querySelector('#food-breakdown tfoot [data-nutrient=calories]').textContent"),'725');
  assert.ok(await evaluate("document.querySelector('#food-breakdown .food-table-scroll').scrollLeft>0"));
  const unsafeName='<img src=x onerror=alert(1)>';
  await evaluate(`document.querySelector('[name=i-0-name]').value=${JSON.stringify(unsafeName)};document.querySelector('[name=i-0-name]').dispatchEvent(new Event('input',{bubbles:true}))`);
  assert.equal(await evaluate("document.querySelector('#food-breakdown tbody th').textContent"),unsafeName);assert.equal(await evaluate("document.querySelectorAll('#food-breakdown img').length"),0);
  await evaluate(`document.querySelector('[name=i-0-name]').value=${JSON.stringify(multi.ingredients[0].name)};document.querySelector('[name=i-0-name]').dispatchEvent(new Event('input',{bubbles:true}))`);
  await auditEnglish();await evaluate("document.querySelector('#detail-form').requestSubmit()");await waitFor("!document.querySelector('#meal-dialog').open && document.querySelector('#meal-count').textContent==='1'");
  assert.ok(await evaluate("getComputedStyle(document.querySelector('.meal-components')).whiteSpace==='normal'"));
  await send('Page.reload');await waitFor("document.querySelector('#meal-count').textContent==='1'");await evaluate("document.querySelector('#meal-list [data-meal]').click()");
  assert.equal(await evaluate("document.querySelector('#food-breakdown tfoot [data-nutrient=calories]').textContent"),'725');assert.equal(await evaluate("document.querySelectorAll('#food-breakdown tbody tr').length"),4);
  await db.prepare('DELETE FROM meals WHERE id=?').bind(multiId).run();
  await send('Page.reload'); await waitFor("document.querySelector('#loading')?.hidden === true");
  await evaluate("document.querySelector('.mobile-nav [data-action=settings]').click()"); await waitFor("document.querySelector('#profile-summary').getAttribute('aria-busy') === 'false'");
  await evaluate("document.querySelector('#logout-button').click()");
  await waitFor("!!document.querySelector('#google-signin') && document.documentElement.dataset.languageReady === 'true'");
  assert.equal(await evaluate('document.documentElement.lang'),language);
  assert.ok(await evaluate('document.documentElement.scrollWidth <= innerWidth'),'Login after logout fits the viewport');
  await screenshot('login-mobile.png');
  await send('Page.navigate',{url:origin+(language === 'en' ? '/guide' : '/utmutato')});
  await waitFor("!!document.querySelector('#teljes-adag')");
  assert.ok(await evaluate(`document.querySelector('h1').textContent.includes(${JSON.stringify(expected('egész adag','whole portion'))})`));
  await send('Page.navigate',{url:pathToFileURL(resolve('dist/documentation', language === 'en' ? 'english.html' : 'index.html')).href});
  await waitFor("location.protocol === 'file:' && document.querySelector('.brand img')?.naturalWidth > 0");
  assert.ok(await evaluate("document.querySelector('#teljes-adag').textContent.includes('100%')"));
  for(const width of [320,390,768,1024,1440]) { await viewport(width,1000,width<768); assert.ok(await evaluate('document.documentElement.scrollWidth <= innerWidth'),'Standalone documentation fits '+width); }
  await viewport(1440,1100,false); await screenshot('documentation-desktop.png');
  await viewport(device === 'desktop' ? 1440 : 390, device === 'desktop' ? 1100 : 844, device !== 'desktop'); await screenshot('documentation-mobile.png',false);
  await send('Emulation.setEmulatedMedia',{media:'print'});
  assert.equal(await evaluate("getComputedStyle(document.querySelector('.toc')).display"),'none');
  await send('Emulation.setEmulatedMedia',{media:'screen'});
  const adminClient=testGoogleClient({email:'thisisnotka@gmail.com',sub:'admin-browser-fixture',name:'Akos Kovacs'});
  Object.assign(googleClient,adminClient); googleClient.callbackOrigin=origin;
  await send('Page.navigate',{url:origin+'/auth/google'});
  await waitFor("document.querySelector('#admin-link')?.hidden === false");
  const chartOwner=(await db.prepare('SELECT id FROM users WHERE google_sub=?').bind('admin-browser-fixture').first()).id;
  for(const [back,status] of [[1,'saved'],[3,'draft'],[6,'saved']]){
    const time=new Date(Date.now()-back*86400000).toISOString(),sample={name:'Grafikon próba',confidence:'medium',assumptions:'Böngészőteszt',ingredients:[ingredient]};
    await db.prepare('INSERT INTO meals(id,user_id,day,time,type,status,analysis,original_analysis,model,usage,photo,public_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(randomUUID(),chartOwner,time.slice(0,10),'12:00','Ebéd',status,JSON.stringify(sample),JSON.stringify(sample),'gemini-4-argon',JSON.stringify({passes:[{promptTokenCount:5000*back,candidatesTokenCount:1500,thoughtsTokenCount:400,cachedContentTokenCount:500}]}),'{}','chart-fixture',time,time).run();
  }
  await evaluate("document.querySelector('#admin-link').click()");
  await waitFor("document.querySelector('#admin-view')?.getAttribute('aria-busy') === 'false' && !!document.querySelector('.admin-card')");
  assert.equal(await evaluate("document.querySelector('#admin-identity').textContent"),'thisisnotka@gmail.com');
  assert.equal(await evaluate("document.querySelectorAll('.admin-chart svg[role=img]').length"),4);
  await viewport(1440,1100,false); await screenshot('admin-overview-desktop.png');
  await viewport(390,844,true); await screenshot('admin-overview-mobile.png',false);
  const adminId=(await db.prepare('SELECT id FROM users WHERE google_sub=?').bind('admin-browser-fixture').first()).id;
  const adminMeal=randomUUID(),adminAnalysis={name:'Admin tesztétkezés',confidence:'medium',assumptions:'Tesztadat',ingredients:[ingredient]},adminTime=new Date().toISOString();
  storedPhotos.set('yumetrics/'+adminMeal,'data:image/png;base64,'+readFileSync('public/badges/first.png').toString('base64'));
  await db.prepare('INSERT INTO meals(id,user_id,day,time,type,status,analysis,original_analysis,photo,public_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').bind(adminMeal,adminId,adminTime.slice(0,10),'12:00','Ebéd','draft',JSON.stringify(adminAnalysis),JSON.stringify(adminAnalysis),JSON.stringify({publicId:'yumetrics/'+adminMeal,type:'authenticated',url:'https://res.cloudinary.com/test-cloud/image/authenticated/v1/yumetrics/'+adminMeal+'.jpg'}),adminMeal,adminTime,adminTime).run();
  await db.prepare("INSERT INTO analysis_jobs(meal_id,kind,state,input_hash,error,created_at,updated_at) VALUES(?,'analyze','failed','','Provider diagnostic visible only to the owner',?,?)").bind(adminMeal,adminTime,adminTime).run();
  for(const tab of ['users','meals','jobs','costs','logs','settings','audit']){
    await evaluate(`location.hash=${JSON.stringify(tab)}`);
    await waitFor(`document.querySelector('#admin-title').textContent === ${JSON.stringify({users:'Felhasználók',meals:'Étkezések',jobs:'Feldolgozások',settings:'Beállítások',audit:'Módosítási előzmények',costs:'AI-használat és költségek',logs:'Működési napló'}[tab])} && document.querySelector('#admin-view').getAttribute('aria-busy') === 'false'`);
    assert.ok(await evaluate("document.querySelector('#admin-message').hidden"),'Admin tab loads '+tab);
    for(const width of [320,390,768,1024,1440]){await viewport(width,1000,width<768);assert.ok(await evaluate('document.documentElement.scrollWidth <= innerWidth'),'Admin '+tab+' fits '+width);}
    if(tab==='users'){
      await evaluate("document.querySelector('#user-filter [name=q]').value='teszt@example.test';document.querySelector('#user-filter').requestSubmit()");
      await waitFor("document.querySelector('#admin-view').getAttribute('aria-busy') === 'false' && document.querySelectorAll('[data-user]').length === 1");
      await evaluate("document.querySelector('[data-goal]').value='2450';document.querySelector('[data-save-user]').click()");
      await waitFor("!document.querySelector('#admin-message').hidden && document.querySelector('[data-goal]')?.value === '2450'");
    }
    if(tab==='meals'){
      await evaluate("document.querySelector('[data-meal]').click()");await waitFor("document.querySelector('#admin-detail').open");
      await waitFor("document.querySelector('#admin-meal-detail img')?.naturalWidth > 0");
      assert.ok(await evaluate("document.querySelector('#admin-meal-detail img').getAttribute('src').startsWith('/api/meals/')"));
      assert.ok(await evaluate("document.querySelector('#admin-meal-detail').textContent.includes('160')"));
      assert.equal(await evaluate("document.querySelectorAll('#admin-meal-detail table tbody tr').length"),2);
      await evaluate("document.querySelector('#close-detail').click()");
    }
    if(tab==='costs'){
      await checkHelp('ai-cost-help',false);
      assert.ok(await evaluate("document.querySelector('#admin-view').textContent.includes('Becsült AI-költség') && document.querySelectorAll('.admin-chart svg').length === 1"));
      await evaluate("document.querySelector('#cost-period [name=days]').value='7';document.querySelector('#cost-period [name=days]').dispatchEvent(new Event('change',{bubbles:true}))");
      await waitFor("location.hash.includes('days=7') && document.querySelector('#admin-view').getAttribute('aria-busy') === 'false'");
      assert.equal(await evaluate("document.querySelectorAll('.chart-data tbody tr').length"),7);
      await evaluate("document.querySelector('.chart-data').open=true");
      assert.ok(await evaluate("document.querySelector('.chart-data').textContent.includes('2026-')"));
      await evaluate("document.querySelector('.chart-data').open=false");
      await viewport(1440,1100,false);await screenshot('admin-costs-desktop.png');
      await viewport(390,844,true);await screenshot('admin-costs-mobile.png');
    }
    if(tab==='logs'){
      await evaluate("document.querySelector('#logs-filter [name=level]').value='error';document.querySelector('#logs-filter [name=level]').dispatchEvent(new Event('change',{bubbles:true}))");
      await waitFor("location.hash.includes('level=error') && document.querySelector('#admin-view').getAttribute('aria-busy') === 'false'");
      assert.ok(await evaluate("document.querySelectorAll('.admin-table tbody .admin-pill').length > 0 && [...document.querySelectorAll('.admin-table tbody .admin-pill')].every(pill=>pill.textContent === 'Hiba')"));
      await viewport(1440,1100,false);await screenshot('admin-logs-desktop.png');
      await viewport(390,844,true);await screenshot('admin-logs-mobile.png');
    }
    if(tab==='settings'){
      await evaluate("document.querySelector('[name=hourlyLimit]').value='2';document.querySelector('#admin-settings').requestSubmit()");
      await waitFor("!document.querySelector('#admin-message').hidden && document.querySelector('#admin-message').textContent.includes('Elmentettük')");
      await send('Page.reload');await waitFor("document.querySelector('[name=hourlyLimit]')?.value === '2'");
      await viewport(1440,1100,false);await screenshot('admin-settings-desktop.png');
      await viewport(390,844,true);await screenshot('admin-settings-mobile.png');
    }
  }
  await evaluate("location.hash='audit'");await evaluate("document.querySelector('#refresh').click()");
  await waitFor("document.querySelector('#admin-view').getAttribute('aria-busy') === 'false' && document.querySelectorAll('.admin-table tbody tr').length >= 2");
  await viewport(1440,1100,false);await screenshot('admin-audit-desktop.png');
  assert.deepEqual(errors,[]);

  const result = { passed: true, language, device, desktop: '1440×1100', mobile: '390×844', checkedWidths: [320, 390, 768, 1024, 1440], checks: ['no horizontal overflow', 'meal cards fit at every breakpoint', 'mandatory Google login (mock exchange)', 'no demo entry', 'mobile navigation', 'calendar selection', 'photo decode and JPEG conversion', 'two-view upload', 'full-image portion and measured weight; no consumption fraction', 'single-request mocked AI and signed Cloudinary upload', 'live portion scaling', 'USDA reference selection', '44 reference options and Hungarian substitution caveats', 'live USDA search and canonical selection (mock API)', 'separately measured edible portion', 'manual edit invalidates reference provenance', 'expanded source and nutrient controls fit at 320px', 'review form fits mobile', 'save', 'reload persistence', 'both views deleted', 'profile stored in database', 'logout', 'Hungarian dish guidance and preserved preparation facts', 'whole-pot recipe, loss confirmation and measured yield', 'recipe save/reload preserves original AI result', 'public documentation route and independent file bundle', 'documentation responsive at five widths and print styles'], providerMode: 'mocked; no real credentials or external API requests', screenshots: ['login-desktop.png', 'login-mobile.png', 'desktop.png', 'mobile.png', 'mobile-review.png', 'mobile-ingredients.png', 'mobile-recipe.png', 'documentation-desktop.png', 'documentation-mobile.png'] };
  result.checks.push('language preference survives reload and sign-out', 'language switching keeps selected photos, dirty notes, canonical meal type and unfinished recipe values', 'English interface translation audit', 'native camera file chooser and environment capture configuration (fixture image)', 'second-photo removal and replacement', 'ingredient addition and removal', 'recoverable analysis failure and retry', 'calendar month/day navigation and guide dialog', 'cancel deletion and confirm deletion');
  result.checks.push('real saved-meal profile counts and averages, then empty state after deletion', '365-day activity graph: keyboard navigation, language changes and diary navigation', 'profile fits five viewport widths without losing unsaved energy goal');
  result.screenshots.push('profile-desktop.png', 'profile-mobile.png');
  result.checks.push('7/30/365-day profile periods, per-meal averages and meal-type table; expanded details fit five viewport widths');
  result.screenshots.push('profile-details-mobile.png');
  result.checks.push('diary-growth card, today CTA from a past selection, first-badge celebration, six badges and reset after last saved meal is deleted');
  result.screenshots.push('growth-mobile.png');
  result.checks.push('packaged drink label, original decimal precision, ml amount edits, label-source preservation and invalidation after nutrient edits');
  result.checks.push('liquid ranges and measured volumes keep their units; source disclosures stay open; badge messages follow language switching');
  result.screenshots.push('packaged-label-mobile.png');
  result.checks.push('Google avatar in sidebar and profile, safe URL checks and failed-image initials fallback', 'all supplementary upload fields collapsed, valid automatic metadata and reset on reopening', 'optional review questions and notes collapsed');
  result.screenshots.push('upload-simple.png');
  result.checks.push('expanded AI methodology fits five viewport widths and links to the selected language guide');
  result.checks.push('both photos mandatory; missing and duplicate second views blocked before provider work', 'native camera chooser for both views; 2048px image preparation', 'one detailed AI request for pair checking, visual inventory and nutrient estimation');
  result.screenshots.push('methodology-desktop.png', 'methodology-mobile.png');
  result.checks.push('six generated botanical badge images load; ordinary users see no provider panel or admin link', 'owner Google identity opens admin; every tab fits five widths; user goal and application settings persist; meal details and audit log work');
  result.checks.push('redesigned culinary badge names in both languages; line and distribution charts with accessible daily data; automatic period filters; AI cost breakdown with incomplete coverage; error-only operational log filtering');
  result.checks.push('first-visit IP language defaults for Hungarian IPv4/IPv6 and foreign IPv4 override browser language; explicit language survives navigation and sign-out');
  result.checks.push('protected photos load through the application in the diary and admin; browser never requests provider photo URLs');
  result.checks.push('four named foods with separate portion nutrients and total; mixed g/ml and missing values; live edits, scroll retention, escaped names, save/reload and untruncated diary names');
  result.checks.push('contextual help in both languages, keyboard Enter/Escape and touch; viewport bounds at five widths, outside dismissal, input preservation and no AI calls');
  result.screenshots.push('context-weight-help-mobile.png','context-energy-range-help-mobile.png','context-ai-cost-help-mobile.png');
  result.screenshots.push('food-breakdown-desktop.png','food-breakdown-mobile.png');
  result.screenshots.push('admin-costs-desktop.png','admin-costs-mobile.png','admin-logs-desktop.png','admin-logs-mobile.png');
  result.screenshots.push('badges-mobile.png','admin-overview-desktop.png','admin-overview-mobile.png','admin-settings-desktop.png','admin-settings-mobile.png','admin-audit-desktop.png');
  writeFileSync(resolve(out, 'browser-check.json'), JSON.stringify(result, null, 2)); console.log(JSON.stringify(result, null, 2));
} catch (error) {
  writeFileSync(resolve(out, 'browser-check.json'), JSON.stringify({ passed: false, status: 'failed', error: error.message }, null, 2));
  writeFileSync(resolve(out, 'chrome-stderr.log'), chromeLog); console.error(chromeLog.slice(-5000)); throw error;
} finally {
  runner.stop(); ws?.close(); processHandle.kill(); await new Promise(resolve => server.close(resolve)); db.close();
}
