import { randomBytes, randomUUID, createHash, timingSafeEqual } from 'node:crypto';
import { OAuth2Client } from 'google-auth-library';
import { check, AppError } from './domain.mjs';
import { json } from './api.mjs';

export const tokenHash = value => createHash('sha256').update(value).digest('hex');
const random = () => randomBytes(32).toString('hex');
const equal = (a, b) => typeof a === 'string' && typeof b === 'string' && timingSafeEqual(Buffer.from(tokenHash(a)), Buffer.from(tokenHash(b)));
export const cookieValue = (request, name) => request.headers.get('cookie')?.split(';').map(part => part.trim()).find(part => part.startsWith(`${name}=`))?.slice(name.length + 1) || null;
const cookieName = (name, origin) => `${origin.startsWith('https:') ? '__Host-' : ''}${name}`;
const cookie = (name, value, seconds, origin, path = '/') => `${cookieName(name, origin)}=${value}; HttpOnly; SameSite=Lax; Path=${origin.startsWith('https:') ? '/' : path}; Max-Age=${seconds}${origin.startsWith('https:') ? '; Secure' : ''}`;
const redirect = location => new Response(null, { status: 303, headers: { Location: location, 'Cache-Control': 'no-store' } });
export function authConfigured(env, db) { return Boolean(db && env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.APP_ORIGIN); }
export async function currentUser(request, db) {
  const token = cookieValue(request, cookieName('yumetrics_session', request.url));
  if (!db || !token || !/^[a-f0-9]{64}$/.test(token)) return null;
  return db.prepare('SELECT u.id,u.name,u.email,u.avatar_url,u.calorie_goal FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?').bind(tokenHash(token), new Date().toISOString()).first();
}
export async function authRoute(request, { db, env, googleClient }) {
  const url = new URL(request.url), origin = new URL(env.APP_ORIGIN || request.url).origin;
  if (url.pathname === '/api/logout' && request.method === 'POST') {
    check(!request.headers.get('origin') || request.headers.get('origin') === origin, 'Idegen oldalról érkező kérés.', 403);
    check(request.headers.get('sec-fetch-site') !== 'cross-site', 'Idegen oldalról érkező kérés.', 403);
    const token = cookieValue(request, cookieName('yumetrics_session', origin));
    if (db && token) await db.prepare('DELETE FROM sessions WHERE token_hash=?').bind(tokenHash(token)).run();
    const response = json({ ok: true }); response.headers.set('Set-Cookie', cookie('yumetrics_session', '', 0, origin)); return response;
  }
  if (!url.pathname.startsWith('/auth/google')) return null;
  check(authConfigured(env, db), 'A bejelentkezés még nincs beállítva. A szükséges Google- és adatbázis-kapcsolatot az alkalmazás üzemeltetője tudja beállítani.', 503);
  const redirectUri = env.GOOGLE_REDIRECT_URI || `${origin}/auth/google/callback`;
  const callbackUrl = new URL(redirectUri);
  check((callbackUrl.protocol === 'https:' || callbackUrl.origin === origin && ['localhost', '127.0.0.1', '[::1]'].includes(callbackUrl.hostname)) && !callbackUrl.username && !callbackUrl.password && !callbackUrl.search && !callbackUrl.hash, 'Hibás Google-visszairányítási cím.', 503);
  const client = googleClient || new OAuth2Client({ clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET, redirectUri });
  if (url.pathname === '/auth/google' && request.method === 'GET') {
    const state = random(), nonce = random(), verifier = randomBytes(48).toString('base64url');
    const now = Date.now();
    await db.prepare('DELETE FROM oauth_states WHERE expires_at<?').bind(new Date(now).toISOString()).run();
    await db.prepare('INSERT INTO oauth_states(state_hash,nonce,verifier,expires_at) VALUES(?,?,?,?)').bind(tokenHash(state), nonce, verifier, new Date(now + 600_000).toISOString()).run();
    const response = redirect(client.generateAuthUrl({ scope: ['openid', 'email', 'profile'], access_type: 'online', prompt: 'select_account', state, nonce, code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256' }));
    response.headers.set('Set-Cookie', cookie('yumetrics_oauth', state, 600, origin, '/auth')); return response;
  }
  if (url.pathname === '/auth/google/callback' && request.method === 'GET') {
    try {
      const state = url.searchParams.get('state');
      check(equal(state, cookieValue(request, cookieName('yumetrics_oauth', origin))), 'A bejelentkezést nem sikerült ellenőrizni. Indítsd újra a belépést.', 401);
      const pending = await db.prepare('DELETE FROM oauth_states WHERE state_hash=? AND expires_at>? RETURNING nonce,verifier').bind(tokenHash(state), new Date().toISOString()).first();
      check(pending && !url.searchParams.has('error') && url.searchParams.get('code'), 'A belépés lejárt vagy megszakadt.', 401);
      const { tokens } = await client.getToken({ code: url.searchParams.get('code'), codeVerifier: pending.verifier, redirect_uri: redirectUri });
      const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: env.GOOGLE_CLIENT_ID });
      const identity = ticket.getPayload();
      check(identity && ['accounts.google.com', 'https://accounts.google.com'].includes(identity.iss) && identity.aud === env.GOOGLE_CLIENT_ID && identity.email_verified === true && equal(identity.nonce, pending.nonce), 'Nem sikerült ellenőrizni, hogy a Google-fiók valóban hozzád tartozik. Próbálj újra bejelentkezni.', 401);
      check(typeof identity.sub === 'string' && identity.sub.length > 0 && identity.sub.length <= 255 && typeof identity.email === 'string' && identity.email.length > 0 && identity.email.length <= 320, 'Hiányos Google-fiókadatok.', 401);
      const token = random(), now = new Date().toISOString();
      await db.transaction(async transaction => {
        const user = await transaction.prepare('INSERT INTO users(id,google_sub,email,name,avatar_url,created_at,updated_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(google_sub) DO UPDATE SET email=excluded.email,name=excluded.name,avatar_url=excluded.avatar_url,updated_at=excluded.updated_at RETURNING id').bind(randomUUID(), identity.sub, identity.email, String(identity.name || identity.email).slice(0, 200), typeof identity.picture === 'string' ? identity.picture.slice(0, 2000) : null, now, now).first();
        await transaction.prepare('INSERT INTO sessions(token_hash,user_id,expires_at,created_at) VALUES(?,?,?,?)').bind(tokenHash(token), user.id, new Date(Date.now() + 30 * 86400_000).toISOString(), now).run();
        await transaction.prepare('DELETE FROM sessions WHERE expires_at<?').bind(now).run();
      });
      const response = redirect('/'); response.headers.append('Set-Cookie', cookie('yumetrics_session', token, 30 * 86400, origin)); response.headers.append('Set-Cookie', cookie('yumetrics_oauth', '', 0, origin, '/auth')); return response;
    } catch (error) {
      console.error('Google sign-in failed:', error instanceof AppError ? 'invalid_identity_or_state' : error.name);
      const response = redirect('/?login=failed'); response.headers.set('Set-Cookie', cookie('yumetrics_oauth', '', 0, origin, '/auth')); return response;
    }
  }
  return json({ error: 'Nem található.' }, 404);
}
