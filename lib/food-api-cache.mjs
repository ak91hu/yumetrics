import { createHash } from 'node:crypto';

const stores = new WeakMap();
const MAX_BYTES = 20 * 1024 * 1024;
const LIMITS = { usda: [1000, 3600_000], off: [14, 60_000], cnf: [30, 60_000], slv: [30, 60_000], matvare: [10, 60_000] };
const ALLOWED = new Set(['api.nal.usda.gov', 'food-nutrition.canada.ca', 'dataportal.livsmedelsverket.se', 'www.matvaretabellen.no', 'world.openfoodfacts.org']);

// Shared per process; the database also shares cache/quota across workers and restarts.
export function foodApiClient(env, fetcher, db, now = Date.now) {
  let store = stores.get(fetcher);
  if (!store) stores.set(fetcher, store = { cache: new Map(), pending: new Map(), limits: new Map() });
  const stats = { requests: 0, cacheHits: 0, sources: {} }, deadline = now() + 12000;
  let cleaned = false;
  async function reserve(source) {
    const [limit, period] = LIMITS[source], bucket = Math.floor(now() / period), key = `${source}:${bucket}`;
    if (db) return db.transaction(async tx => {
      const row = await tx.prepare('INSERT INTO food_api_limits(bucket,requests,expires_at) VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET requests=food_api_limits.requests+1 WHERE food_api_limits.requests<? RETURNING requests').bind(key, new Date((bucket + 2) * period).toISOString(), limit).first();
      return Boolean(row);
    });
    const used = store.limits.get(key) || 0;
    if (used >= limit) return false;
    store.limits.set(key, used + 1);
    if (store.limits.size > 100) for (const old of store.limits.keys()) if (old !== key) store.limits.delete(old);
    return true;
  }
  async function load(source, url, key, { body, ttl = 86400_000 }) {
    if (db) {
      if (!cleaned) {
        cleaned = true;
        await db.prepare('DELETE FROM food_api_cache WHERE expires_at<=?').bind(new Date(now()).toISOString()).run();
        await db.prepare('DELETE FROM food_api_limits WHERE expires_at<=?').bind(new Date(now()).toISOString()).run();
      }
      const saved = await db.prepare('SELECT value,expires_at FROM food_api_cache WHERE cache_key=? AND expires_at>?').bind(key, new Date(now()).toISOString()).first();
      if (saved) {
        try { const value = JSON.parse(saved.value); stats.cacheHits++; store.cache.set(key, { value, expires: Math.min(Date.parse(saved.expires_at), now() + 60000) }); return value; } catch { /* Fetch a corrupt entry again. */ }
      }
    }
    if (now() >= deadline || stats.requests >= 16 || !await reserve(source) || now() >= deadline || stats.requests >= 16) { stats.sources[source] = 'limited'; return null; }
    stats.requests++;
    let value = null;
    try {
      const response = await fetcher(url.href, {
        method: body ? 'POST' : 'GET', redirect: 'error',
        headers: { Accept: 'application/json', 'User-Agent': 'Yumetrics/1.0 (https://yumetrics.app)', ...(body ? { 'Content-Type': 'application/json' } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(Math.max(1, Math.min(5000, deadline - now()))),
      });
      if (!response.ok) throw Error('Food API unavailable');
      if (Number(response.headers.get('content-length')) > MAX_BYTES) throw Error('Food API response too large');
      const reader = response.body.getReader(), chunks = []; let bytes = 0;
      try {
        for (;;) { const part = await reader.read(); if (part.done) break; bytes += part.value.byteLength; if (bytes > MAX_BYTES) throw Error('Food API response too large'); chunks.push(part.value); }
      } catch (error) { await reader.cancel().catch(() => {}); throw error; }
      value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      stats.sources[source] = 'available';
    } catch { stats.sources[source] = 'unavailable'; }
    const duration = value === null ? 5 * 60_000 : ttl;
    store.cache.set(key, { value, expires: now() + duration });
    while (store.cache.size > 160) store.cache.delete(store.cache.keys().next().value);
    if (db) await db.prepare('INSERT INTO food_api_cache(cache_key,value,expires_at) VALUES(?,?,?) ON CONFLICT(cache_key) DO UPDATE SET value=excluded.value,expires_at=excluded.expires_at').bind(key, JSON.stringify(value), new Date(now() + duration).toISOString()).run();
    return value;
  }
  async function get(source, rawUrl, options = {}) {
    const url = new URL(rawUrl);
    if (url.protocol !== 'https:' || !ALLOWED.has(url.hostname) || url.username || url.password) throw Error('Invalid food API destination');
    const key = source + ':' + createHash('sha256').update(url.href + (options.body ? JSON.stringify(options.body) : '')).digest('hex');
    const hit = store.cache.get(key);
    if (hit?.expires > now()) { stats.cacheHits++; return hit.value; }
    if (store.pending.has(key)) { stats.cacheHits++; return store.pending.get(key); }
    // Register before the first database await, so simultaneous requests share
    // both the durable-cache read and the network request.
    const pending = load(source, url, key, options);
    store.pending.set(key, pending);
    try { return await pending; } finally { store.pending.delete(key); }
  }
  return { get, stats, available: () => now() < deadline && stats.requests < 16 };
}
