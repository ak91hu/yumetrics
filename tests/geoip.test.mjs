import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { requestCountry } from '../lib/geoip.mjs';
import { requestLanguage } from '../lib/i18n.mjs';
import { createApp } from '../server.mjs';

test('offline country lookup handles IPv4, IPv6, mapped addresses and untrusted headers', () => {
  const request = new Request('http://localhost', { headers: { 'X-Envoy-External-Address': '84.2.44.1', 'X-Forwarded-For': '84.2.44.1' } });
  assert.equal(requestCountry(request, '8.8.8.8'), 'US');
  assert.equal(requestCountry(request, '8.8.8.8', true), 'HU');
  for (const address of ['84.2.44.1', '::ffff:84.2.44.1', '2001:4c48::1']) assert.equal(requestCountry(new Request('http://localhost'), address), 'HU');
  for (const address of ['127.0.0.1', '::1', '10.0.0.1', 'not-an-ip', undefined]) assert.equal(requestCountry(new Request('http://localhost'), address), null);
  assert.notEqual(requestCountry(new Request('http://localhost'), '2001:4860:4860::8888'), 'HU');
  assert.equal(requestCountry(new Request('http://localhost', { headers: { 'X-Envoy-External-Address': 'invalid', 'X-Forwarded-For': '84.2.44.1' } }), '127.0.0.1', true), null);
});

test('country selects only the initial language; valid explicit choices take precedence', () => {
  for (const country of ['HU', 'US', 'RO', 'SK', 'RS', 'UA', 'AT', 'HR', 'SI', null]) {
    const headers = { 'Accept-Language': country === 'HU' ? 'en-US' : 'hu-HU' };
    assert.equal(requestLanguage(new Request('http://localhost', { headers }), country), country === 'HU' ? 'hu' : 'en');
    for (const language of ['hu', 'en']) {
      assert.equal(requestLanguage(new Request('http://localhost', { headers: { Cookie: 'yumetrics_language=' + language } }), country), language);
      assert.equal(requestLanguage(new Request('http://localhost?lang=' + language, { headers: { Cookie: 'yumetrics_language=' + (language === 'hu' ? 'en' : 'hu') } }), country), language);
    }
    assert.equal(requestLanguage(new Request('http://localhost?lang=fr', { headers: { Cookie: 'yumetrics_language=invalid' } }), country), country === 'HU' ? 'hu' : 'en');
  }
});

test('public pages receive the IP default without adding cookies or changing protected routes', async t => {
  const server = createApp({ env: { NODE_ENV: 'production' } });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const origin = `http://127.0.0.1:${server.address().port}`;
  for (const [address, language] of [['84.2.44.1', 'hu'], ['2001:4c48::1', 'hu'], ['8.8.8.8', 'en'], ['unknown', 'en']]) {
    const headers = { 'X-Envoy-External-Address': address, 'X-Forwarded-For': '84.2.44.1' };
    const page = await fetch(origin, { headers });
    assert.equal(page.headers.get('Content-Language'), language);
    assert.equal(page.headers.get('Set-Cookie'), null);
    assert.equal(page.headers.get('Cache-Control'), 'no-store');
    assert.ok((await page.text()).includes(`data-default-language="${language}"`));
    const error = await fetch(origin + '/api/meals', { headers });
    assert.equal(error.status, 401); assert.equal(error.headers.get('Content-Language'), language);
    assert.equal((await fetch(origin + '/admin', { headers })).status, 401);
    const guide = await fetch(origin + '/guide', { headers });
    assert.equal(guide.headers.get('Content-Language'), 'en');
    const chosen = await fetch(origin, { headers: { ...headers, Cookie: 'yumetrics_language=en' } });
    assert.ok((await chosen.text()).includes('data-default-language="en"'));
  }
});
