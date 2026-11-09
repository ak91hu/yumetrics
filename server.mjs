import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';
import { Readable } from 'node:stream';
import { api, json } from './lib/api.mjs';
import { authRoute, authConfigured, currentUser } from './lib/auth.mjs';
import { openPostgresDatabase } from './lib/database.mjs';
import { startJobRunner } from './lib/jobs.mjs';
import { SECURITY_HEADERS, STATIC_FILES } from './lib/http.mjs';
import { guideMarkup, requestLanguage, translateSystemMessage } from './lib/i18n.mjs';
import { requestCountry } from './lib/geoip.mjs';
import { isAdmin } from './lib/settings.mjs';
import { logEvent, importHistoricalUsage } from './lib/telemetry.mjs';
export { openDatabase } from './lib/database.mjs';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
export function createApp({ db, env = process.env, fetcher = fetch, publicOrigin = null, googleClient, wake = () => {} } = {}) {
  return createServer(async (incoming, outgoing) => {
    let response, language = 'en';
    try {
      const origin = publicOrigin || env.APP_ORIGIN || `http://${incoming.headers.host}`;
      const url = new URL(incoming.url, origin);
      if (!['http:', 'https:'].includes(url.protocol) || url.origin !== new URL(origin).origin || (!env.APP_ORIGIN && !publicOrigin && !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))) response = json({ error: 'Érvénytelen kiszolgálócím.' }, 403);
      else if (origin.startsWith('https:') && incoming.headers.host?.toLowerCase() !== new URL(origin).host.toLowerCase() && !['/healthz', '/readyz'].includes(url.pathname)) {
        response = ['GET', 'HEAD'].includes(incoming.method)
          ? new Response(null, { status: 308, headers: { Location: url.href, 'Cache-Control': 'public, max-age=300' } })
          : json({ error: 'Érvénytelen kiszolgálócím.' }, 403);
      }
      else {
        const request = new Request(url, { method: incoming.method, headers: incoming.headers, ...(incoming.method !== 'GET' && incoming.method !== 'HEAD' ? { body: Readable.toWeb(incoming), duplex: 'half' } : {}) });
        language = requestLanguage(request, requestCountry(request, incoming.socket.remoteAddress, env.NODE_ENV === 'production'));
        if (url.pathname === '/healthz') response = json({ ok: true });
        else if (url.pathname === '/readyz') {
          if (db && authConfigured(env, db)) { await db.prepare('SELECT 1 AS ready').bind().first(); response = json({ ready: true }); }
          else response = json({ ready: false }, 503);
        } else if (url.pathname === '/api/auth-status') response = json({ configured: authConfigured(env, db) });
        else response = await authRoute(request, { db, env, googleClient });
        if (!response) {
          const user = await currentUser(request, db);
          if (url.pathname.startsWith('/api/')) response = await api(request, { db, env, userId: user?.id, user, fetcher, wake });
          else if (['/admin', '/admin.html'].includes(url.pathname) && !isAdmin(user)) response = json({ error: 'Ehhez a felülethez nincs hozzáférésed.' }, user ? 403 : 401);
          else if (STATIC_FILES[url.pathname] && ['GET', 'HEAD'].includes(incoming.method)) {
            const [name, type] = STATIC_FILES[url.pathname];
            const filename = !user && (url.pathname === '/' || url.pathname === '/index.html') ? 'login.html' : name;
            const isGuide = name === 'help.html', guideLanguage = ['/guide', '/help-en.html'].includes(url.pathname) ? 'en' : 'hu';
            const localizedPage = ['index.html', 'login.html'].includes(filename);
            const content = isGuide ? guideMarkup(readFileSync(resolve(ROOT, 'public', filename), 'utf8'), guideLanguage) : localizedPage ? readFileSync(resolve(ROOT, 'public', filename), 'utf8').replace('<html lang="hu"', `<html lang="hu" data-default-language="${language}"`) : readFileSync(resolve(ROOT, 'public', filename));
            response = new Response(incoming.method === 'HEAD' ? null : content, { headers: { 'Content-Type': type, 'Cache-Control': 'no-store', ...(isGuide || localizedPage ? { 'Content-Language': isGuide ? guideLanguage : language, Vary: 'Cookie' } : {}) } });
          } else response = json({ error: 'Nem található.' }, 404);
        }
      }
    } catch (error) {
      console.error('HTTP request failed:', error.code || error.name);
      if (db && !error.status) await logEvent(db,{level:'error',category:'server',event:'server.failed',message:'Hiba történt a kérés kiszolgálása közben.',code:error.code || error.name}).catch(()=>console.error('Operational log could not be saved'));
      response = json({ error: error.status ? error.message : 'Az alkalmazás átmenetileg nem érhető el. A korábban mentett adatok megmaradtak.' }, error.status || 503);
    }
    if (response.status >= 400 && response.headers.get('content-type')?.includes('application/json')) {
      const data = await response.json();
      if (typeof data.error === 'string') data.error = translateSystemMessage(data.error, language);
      response = new Response(JSON.stringify(data), { status: response.status, headers: response.headers });
      response.headers.set('Content-Language', language);
    }
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) response.headers.set(name, value);
    if ((publicOrigin || env.APP_ORIGIN)?.startsWith('https:')) response.headers.set('Strict-Transport-Security', 'max-age=31536000');
    const headers = Object.fromEntries(response.headers); const cookies = response.headers.getSetCookie();
    if (cookies.length) headers['set-cookie'] = cookies;
    outgoing.writeHead(response.status, headers); outgoing.end(Buffer.from(await response.arrayBuffer()));
  });
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  // An explicit local .env belongs to this app; production secrets are injected by Northflank.
  if (process.env.NODE_ENV !== 'production' && existsSync(resolve(ROOT, '.env'))) Object.assign(process.env, parseEnv(readFileSync(resolve(ROOT, '.env'), 'utf8')));
  const env = process.env, host = env.HOST || '127.0.0.1', port = Number(env.PORT || 3000);
  if (env.NODE_ENV === 'production' && (!env.DATABASE_URL || !env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.APP_ORIGIN?.startsWith('https://'))) throw new Error('Production requires DATABASE_URL, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and an HTTPS APP_ORIGIN.');
  let db;
  try { if (env.DATABASE_URL) { db = await openPostgresDatabase(env.DATABASE_URL); await importHistoricalUsage(db); } }
  catch (error) { console.error('PostgreSQL startup failed:', error.code || error.name); process.exit(1); }
  if (db) await logEvent(db,{category:'server',event:'server.starting',message:'Az alkalmazás indul; az adatbázis-kapcsolat létrejött.'});
  const runner = db ? startJobRunner({ db, env }) : null;
  const server = createApp({ db, env, wake: () => runner?.wake() });
  server.listen(port, host, () => console.log(`Yumetrics: http://${host}:${server.address().port} · Google-belépés ${authConfigured(env, db) ? 'beállítva' : 'beállításra vár'}`));
  let stopping = false;
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
    if (stopping) return; stopping = true; runner?.stop();
    const deadline = setTimeout(() => process.exit(0), 25_000); deadline.unref();
    server.close(async () => { if (!runner?.working) await db?.close(); process.exit(0); });
  });
}
