import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { createApp, openDatabase } from '../server.mjs';

const chrome = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const out = resolve('outputs'); mkdirSync(out, { recursive: true });
writeFileSync(resolve(out, 'browser-check.json'), JSON.stringify({ passed: false, status: 'running' }));
const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a2ioAAAAASUVORK5CYII=';
const photoFile = resolve(out, 'upload-fixture.png'); writeFileSync(photoFile, Buffer.from(png, 'base64'));
const ingredient = { name: 'Teszt avokádó', grams: 100, calories: 160, protein: 2, carbs: 1.8, fat: 14.7, fiber: 6.7, sugar: .7, sodium: 7 };
let providerCalls = 0;
const db = openDatabase(':memory:');
const server = createApp({ db, env: { OPENCODE_API_KEY: 'browser-test', CLOUDINARY_CLOUD_NAME: 'test-cloud', CLOUDINARY_API_KEY: 'browser-test', CLOUDINARY_API_SECRET: 'browser-test' }, fetcher: async (url, options) => {
  providerCalls++;
  if (url.startsWith('https://opencode.ai/')) return Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify({ isFood: true, name: 'Tesztétkezés', confidence: 'medium', assumptions: 'Automatizált teszt: nem valódi AI-elemzés.', ingredients: [ingredient] }) }] } }] });
  if (url.endsWith('/upload')) return Response.json({ public_id: options.body.get('public_id'), secure_url: `https://res.cloudinary.com/test-cloud/image/upload/v1/${options.body.get('public_id')}.jpg`, width: 1, height: 1, bytes: 68, version: 1, format: 'jpg' });
  if (url.endsWith('/destroy')) return Response.json({ result: 'ok' });
  throw new Error('Unexpected provider URL');
} });
server.listen(0, '127.0.0.1'); await once(server, 'listening');
const origin = `http://127.0.0.1:${server.address().port}`;
const processHandle = spawn(chrome, ['--headless=new', '--disable-gpu', '--disable-software-rasterizer', '--remote-debugging-port=0', `--user-data-dir=${resolve(out, `chrome-profile-${Date.now()}`)}`, '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--disable-background-networking', '--hide-scrollbars', 'about:blank'], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
let ws, pending = new Map(), nextId = 0, sessionId, errors = [], chromeLog = '';
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
  await send('Runtime.enable'); await send('Page.enable');
  async function evaluate(expression) {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  }
  async function waitFor(expression) {
    const started = Date.now();
    while (Date.now() - started < 12_000) { if (await evaluate(expression)) return; await new Promise(resolve => setTimeout(resolve, 100)); }
    throw new Error(`Browser condition not met: ${expression}`);
  }
  async function screenshot(name, full = true) { const result = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: full }); writeFileSync(resolve(out, name), Buffer.from(result.data, 'base64')); }
  async function viewport(width, height, mobile) { await send('Emulation.setDeviceMetricsOverride', { width, height, screenWidth: width, screenHeight: height, deviceScaleFactor: 1, mobile }); await send('Emulation.setTouchEmulationEnabled', { enabled: mobile }); }
  await viewport(1440, 1100, false); await send('Page.navigate', { url: origin });
  await waitFor("document.querySelector('#loading')?.hidden === true");
  assert.equal(await evaluate("document.querySelector('#meal-count').textContent"), '0');
  assert.ok(await evaluate('document.documentElement.scrollWidth <= innerWidth'));
  await evaluate("document.querySelector('#demo-button').click()");
  await waitFor("document.querySelector('#meal-count').textContent === '2'");
  await screenshot('desktop.png');
  await evaluate("document.querySelector('[data-meal=demo-breakfast]').click()");
  assert.ok(await evaluate("document.querySelector('#meal-dialog').open && document.querySelector('#ingredient-list').children.length === 3"));
  assert.ok(await evaluate("document.querySelector('.detail-fields').disabled"));
  await evaluate("document.querySelector('#meal-dialog [data-close]').click()");
  for (const width of [320, 390, 768, 1024]) {
    await viewport(width, 844, width < 768);
    assert.ok(await evaluate('document.documentElement.scrollWidth <= innerWidth'), `No page overflow at ${width}px`);
    assert.ok(await evaluate("document.querySelector('.meal-card').getBoundingClientRect().right <= document.querySelector('main').getBoundingClientRect().right"), `Meal cards fit at ${width}px`);
  }
  await viewport(390, 844, true);
  assert.ok(await evaluate('document.documentElement.scrollWidth <= innerWidth'));
  assert.equal(await evaluate("getComputedStyle(document.querySelector('.sidebar')).display"), 'none');
  assert.equal(await evaluate("getComputedStyle(document.querySelector('.mobile-nav')).display"), 'flex');
  await screenshot('mobile.png');
  await evaluate("document.querySelector('.mobile-nav [data-action=calendar]').click()");
  assert.equal(await evaluate('document.activeElement.id'), 'calendar');
  await evaluate("document.querySelector('#calendar-grid .has-meal:not(.selected)').click()");
  await waitFor("document.querySelector('#meal-count').textContent === '1'");
  await evaluate("document.querySelector('[data-action=today]').click()");
  await waitFor("document.querySelector('#meal-count').textContent === '2'");
  await evaluate("document.querySelector('#demo-button').click()");
  await waitFor("document.querySelector('#meal-count').textContent === '0'");
  await evaluate("document.querySelector('.mobile-nav [data-action=upload]').click()");
  const doc = await send('DOM.getDocument'); const fileInput = await send('DOM.querySelector', { nodeId: doc.root.nodeId, selector: '#photo-input' });
  await send('DOM.setFileInputFiles', { nodeId: fileInput.nodeId, files: [photoFile] });
  await waitFor("!document.querySelector('#photo-preview').hidden");
  assert.ok((await evaluate("document.querySelector('#photo-preview').src")).startsWith('data:image/jpeg;base64,'));
  await evaluate("document.querySelector('#upload-form').requestSubmit()");
  await waitFor("document.querySelector('#meal-dialog').open");
  assert.equal(await evaluate("document.querySelector('#detail-calories').textContent"), '160');
  await evaluate("document.querySelector('[name=i-0-grams]').value='200'; document.querySelector('[name=i-0-grams]').dispatchEvent(new Event('input',{bubbles:true}))");
  assert.equal(await evaluate("document.querySelector('#detail-calories').textContent"), '320');
  const reviewWidth = await evaluate("({scroll:document.querySelector('#meal-detail').scrollWidth,client:document.querySelector('#meal-detail').clientWidth})");
  assert.ok(reviewWidth.scroll <= reviewWidth.client, `Review form fits mobile dialog: ${JSON.stringify(reviewWidth)}`);
  await screenshot('mobile-review.png', false);
  await evaluate("document.querySelector('#detail-form').requestSubmit()");
  await waitFor("document.querySelector('#meal-count').textContent === '1' && !document.querySelector('#meal-dialog').open");
  assert.equal(await evaluate("document.querySelector('#calorie-total').textContent"), '320');
  await send('Page.reload'); await waitFor("document.querySelector('#meal-count').textContent === '1'");
  await evaluate("document.querySelector('#meal-list [data-meal]').click()");
  await evaluate("document.querySelector('#delete-meal').click(); document.querySelector('#confirm-delete').click()");
  await waitFor("document.querySelector('#meal-count').textContent === '0' && !document.querySelector('#meal-dialog').open");
  assert.equal(providerCalls, 3); assert.deepEqual(errors, []);
  const result = { passed: true, desktop: '1440×1100', mobile: '390×844', checkedWidths: [320, 390, 768, 1024, 1440], checks: ['no horizontal overflow', 'meal cards fit at every breakpoint', 'demo isolation', 'readonly sample details', 'mobile navigation', 'calendar selection', 'photo decode and JPEG conversion', 'mock AI and signed Cloudinary upload', 'live portion scaling', 'review form fits mobile', 'save', 'reload persistence', 'delete'], providerMode: 'mocked; no real credentials or external API requests', screenshots: ['desktop.png', 'mobile.png', 'mobile-review.png'] };
  writeFileSync(resolve(out, 'browser-check.json'), JSON.stringify(result, null, 2)); console.log(JSON.stringify(result, null, 2));
} catch (error) {
  writeFileSync(resolve(out, 'browser-check.json'), JSON.stringify({ passed: false, status: 'failed', error: error.message }, null, 2));
  writeFileSync(resolve(out, 'chrome-stderr.log'), chromeLog); console.error(chromeLog.slice(-5000)); throw error;
} finally {
  ws?.close(); processHandle.kill(); await new Promise(resolve => server.close(resolve)); db.close();
}
