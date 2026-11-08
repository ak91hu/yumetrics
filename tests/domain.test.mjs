import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { request } from 'node:http';
import { createApp } from '../server.mjs';

test('the HTTPS primary domain receives aliases without losing paths, queries or OAuth callbacks', async t => {
  const server = createApp({ env: { APP_ORIGIN: 'https://yumetrics.app' } });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const call = (path, options = {}) => new Promise((resolve, reject) => {
    const outgoing = request(origin + path, options, incoming => {
      const chunks = []; incoming.on('data', chunk => chunks.push(chunk));
      incoming.on('end', () => resolve(new Response(Buffer.concat(chunks), { status: incoming.statusCode, headers: incoming.headers })));
    });
    outgoing.on('error', reject); outgoing.end();
  });
  for (const host of ['www.yumetrics.app', 'http--yumetrics--dmg6gnvmmd7s.code.run']) {
    for (const path of ['/?lang=en', '/guide', '/auth/google/callback?state=one-use&code=code%2Bvalue', '/?redirect=https://evil.test']) {
      const response = await call(path, { headers: { Host: host } });
      assert.equal(response.status, 308);
      assert.equal(response.headers.get('location'), 'https://yumetrics.app' + path);
      assert.equal(response.headers.get('set-cookie'), null);
    }
  }
  const primary = await call('/', { headers: { Host: 'yumetrics.app', 'X-Forwarded-Host': 'evil.test' } });
  assert.equal(primary.status, 200); assert.equal(primary.headers.get('location'), null);
  assert.equal(primary.headers.get('strict-transport-security'), 'max-age=31536000');
  const head = await call('/guide', { method: 'HEAD', headers: { Host: 'www.yumetrics.app' } });
  assert.equal(head.status, 308); assert.equal(await head.text(), '');
  const post = await call('/api/logout', { method: 'POST', headers: { Host: 'www.yumetrics.app' } });
  assert.equal(post.status, 403); assert.equal(post.headers.get('location'), null);
  const health = await call('/healthz', { headers: { Host: 'internal-service:3000' } });
  assert.equal(health.status, 200); assert.equal(health.headers.get('location'), null);
  const readiness = await call('/readyz', { headers: { Host: 'internal-service:3000' } });
  assert.equal(readiness.status, 503); assert.equal(readiness.headers.get('location'), null);
});
