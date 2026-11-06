import { api, json } from './lib/api.mjs';
import { SECURITY_HEADERS } from './lib/http.mjs';
import { assets } from './assets.mjs';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    let response;
    if (url.pathname.startsWith('/api/')) {
      // Sites dispatch authenticates and injects this header; do not expose a raw Worker origin.
      response = await api(request, { db: env.DB, env, userId: request.headers.get('oai-authenticated-user-id') });
    } else if (assets[url.pathname] && ['GET', 'HEAD'].includes(request.method)) {
      const { content, type } = assets[url.pathname];
      response = new Response(request.method === 'HEAD' ? null : content, { headers: { 'Content-Type': type, 'Cache-Control': 'no-cache' } });
    } else response = json({ error: 'Nem található.' }, 404);
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) response.headers.set(name, value);
    return response;
  },
};
