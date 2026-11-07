import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { authRoute } from '../lib/auth.mjs';
import { openDatabase } from '../lib/database.mjs';
import { testGoogleClient } from './fixtures.mjs';

test('external HTTPS callback keeps the original redirect URI at both Google steps and verifies the app state', async t => {
  const db = openDatabase(':memory:'); t.after(() => db.close());
  const env = { APP_ORIGIN: 'https://app.example.test', GOOGLE_CLIENT_ID: 'test-client', GOOGLE_CLIENT_SECRET: 'test-secret', GOOGLE_REDIRECT_URI: 'https://ak91hu.github.io/yumetrics/oauth.html' };
  const direct = await authRoute(new Request(env.APP_ORIGIN + '/auth/google'), { db, env });
  assert.equal(new URL(direct.headers.get('location')).searchParams.get('redirect_uri'), env.GOOGLE_REDIRECT_URI);
  const client = testGoogleClient(), exchange = client.getToken;
  client.getToken = async options => { assert.equal(options.redirect_uri, env.GOOGLE_REDIRECT_URI); return exchange(options); };
  const start = await authRoute(new Request(env.APP_ORIGIN + '/auth/google'), { db, env, googleClient: client });
  const query = new URL(start.headers.get('location')).search;
  const result = await authRoute(new Request(env.APP_ORIGIN + '/auth/google/callback' + query, { headers: { Cookie: start.headers.get('set-cookie').split(';')[0] } }), { db, env, googleClient: client });
  assert.equal(result.headers.get('location'), '/');
  assert.ok(result.headers.getSetCookie().some(value => value.startsWith('__Host-yumetrics_session=')));
  await assert.rejects(authRoute(new Request(env.APP_ORIGIN + '/auth/google'), { db, env: { ...env, GOOGLE_REDIRECT_URI: 'http://evil.test/callback' } }), error => error.status === 503);
});

test('static callback only forwards to the fixed app, clears the address and stores no data', () => {
  const script = readFileSync(new URL('../docs/oauth.js', import.meta.url), 'utf8'), state = 'a'.repeat(64);
  let destination, cleared, message = {};
  const context = query => ({ URL, location: { href: 'https://ak91hu.github.io/yumetrics/oauth.html' + query, replace: value => { destination = value; } }, history: { replaceState: (...args) => { cleared = args[2]; } }, document: { getElementById: () => message } });
  vm.runInNewContext(script, context(`?state=${state}&code=one-use&redirect=https://evil.test`));
  assert.equal(destination, `https://http--yumetrics--dmg6gnvmmd7s.code.run/auth/google/callback?state=${state}&code=one-use`);
  assert.equal(cleared, '/yumetrics/oauth.html');
  destination = undefined;
  vm.runInNewContext(script, context('?state=invalid&code=test'));
  assert.equal(destination, undefined); assert.ok(message.textContent.includes('Yumetrics'));
  assert.ok(!/localStorage|sessionStorage|fetch\(|document.cookie/.test(script));
});
