import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { randomBytes, timingSafeEqual, createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import { api, json, readJson } from './lib/api.mjs';
import { SECURITY_HEADERS, STATIC_FILES } from './lib/http.mjs';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
export function openDatabase(filename) {
  const sqlite = new DatabaseSync(filename);
  sqlite.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY);');
  const journal = JSON.parse(readFileSync(new URL('./drizzle/meta/_journal.json', import.meta.url), 'utf8'));
  for (const { tag: name } of journal.entries) {
    if (!sqlite.prepare('SELECT name FROM schema_migrations WHERE name=?').get(name)) {
      sqlite.exec('BEGIN IMMEDIATE');
      try {
        sqlite.exec(readFileSync(new URL(`./drizzle/${name}.sql`, import.meta.url), 'utf8'));
        sqlite.prepare('INSERT INTO schema_migrations(name) VALUES(?)').run(name);
        sqlite.exec('COMMIT');
      } catch (error) { sqlite.exec('ROLLBACK'); throw error; }
    }
  }
  return {
    prepare(sql) {
      const statement = sqlite.prepare(sql);
      return { bind(...args) { return {
        async first() { return statement.get(...args) || null; },
        async all() { return { results: statement.all(...args) }; },
        async run() { const result = statement.run(...args); return { meta: { changes: result.changes } }; },
      }; } };
    }, close() { sqlite.close(); },
  };
}
const hash = value => createHash('sha256').update(value).digest();
export function createApp({ db, env = process.env, fetcher = fetch, publicOrigin = null } = {}) {
  const sessions = new Map(), failures = new Map();
  return createServer(async (incoming, outgoing) => {
    try {
      const origin = publicOrigin || `http://${incoming.headers.host}`;
      const url = new URL(incoming.url, origin);
      if (!publicOrigin && !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) {
        outgoing.writeHead(403); outgoing.end('Invalid host'); return;
      }
      const request = new Request(url, { method: incoming.method, headers: incoming.headers, ...(incoming.method !== 'GET' && incoming.method !== 'HEAD' ? { body: Readable.toWeb(incoming), duplex: 'half' } : {}) });
      let response;
      const cookie = incoming.headers.cookie?.match(/(?:^|;\s*)yumetrics_session=([a-f0-9]{64})(?:;|$)/)?.[1];
      const currentTime = Date.now();
      for (const [key, expiry] of sessions) if (expiry < currentTime) sessions.delete(key);
      for (const [key, value] of failures) if (value.expires < currentTime) failures.delete(key);
      const userId = !env.APP_PASSWORD || (cookie && sessions.has(cookie)) ? 'local' : null;
      if (url.pathname === '/api/login' && incoming.method === 'POST') {
        if (request.headers.get('origin') && request.headers.get('origin') !== url.origin || request.headers.get('sec-fetch-site') === 'cross-site') response = json({ error: 'Idegen oldalról érkező kérés.' }, 403);
        else {
          const ip = incoming.socket.remoteAddress, attempt = failures.get(ip) || { count: 0, expires: currentTime + 900_000 };
          if (attempt.count >= 5) response = json({ error: 'Túl sok belépési kísérlet. Próbáld 15 perc múlva.' }, 429);
          else {
            let password; try { password = (await readJson(request, 4096)).password; } catch { /* Invalid input is handled as failed authentication. */ }
            if (!env.APP_PASSWORD || typeof password !== 'string' || !timingSafeEqual(hash(password), hash(env.APP_PASSWORD))) {
              attempt.count++; failures.set(ip, attempt); response = json({ error: 'Hibás jelszó.' }, 401);
            } else {
              failures.delete(ip);
              const token = randomBytes(32).toString('hex'); sessions.set(token, currentTime + 7 * 86400_000);
              if (sessions.size > 100) sessions.delete(sessions.keys().next().value);
              response = json({ ok: true });
              response.headers.set('Set-Cookie', `yumetrics_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800${url.protocol === 'https:' ? '; Secure' : ''}`);
            }
          }
        }
      } else if (url.pathname === '/api/logout' && incoming.method === 'POST') {
        if (cookie) sessions.delete(cookie);
        response = json({ ok: true }); response.headers.set('Set-Cookie', 'yumetrics_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
      } else if (url.pathname.startsWith('/api/')) response = await api(request, { db, env, userId, fetcher });
      else if (STATIC_FILES[url.pathname] && ['GET', 'HEAD'].includes(incoming.method)) {
        const [name, type] = STATIC_FILES[url.pathname];
        response = new Response(incoming.method === 'HEAD' ? null : readFileSync(resolve(ROOT, 'public', name)), { headers: { 'Content-Type': type, 'Cache-Control': 'no-cache' } });
      } else response = json({ error: 'Nem található.' }, 404);
      for (const [name, value] of Object.entries(SECURITY_HEADERS)) response.headers.set(name, value);
      outgoing.writeHead(response.status, Object.fromEntries(response.headers)); outgoing.end(Buffer.from(await response.arrayBuffer()));
    } catch (error) {
      console.error('HTTP operation failed:', error.name);
      if (!outgoing.headersSent) outgoing.writeHead(500, { 'Content-Type': 'application/json', ...SECURITY_HEADERS });
      outgoing.end('{"error":"Váratlan szerverhiba."}');
    }
  });
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const host = process.env.HOST || '127.0.0.1', port = Number(process.env.PORT || 3000);
  if (!['127.0.0.1', 'localhost', '::1'].includes(host) && (!process.env.APP_PASSWORD || !process.env.APP_ORIGIN)) throw new Error('Hálózati eléréshez APP_PASSWORD és APP_ORIGIN szükséges.');
  if (process.env.APP_ORIGIN && !/^https?:\/\//.test(process.env.APP_ORIGIN)) throw new Error('Az APP_ORIGIN teljes HTTP(S) eredet legyen.');
  mkdirSync(resolve(ROOT, 'data'), { recursive: true });
  const db = openDatabase(process.env.DATABASE_PATH || resolve(ROOT, 'data/yumetrics.sqlite'));
  const server = createApp({ db, publicOrigin: process.env.APP_ORIGIN ? new URL(process.env.APP_ORIGIN).origin : null });
  server.listen(port, host, () => console.log(`Yumetrics: http://${host}:${server.address().port}${process.env.APP_PASSWORD ? ' (jelszóval védett)' : ' (csak helyi elérés)'}`));
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => { db.close(); process.exit(); }));
}
