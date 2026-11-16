export const BACKUP_ORIGIN = 'https://yumetrics-backup.ak91hu.workers.dev';
const UPSTREAM = 'https://yumetrics.app';
const BRIDGE = 'https://ak91hu.github.io/yumetrics/oauth.html';
const COOKIE_NAMES = new Set(['__Host-yumetrics_session','__Host-yumetrics_oauth','yumetrics_language']);
const METHODS = new Set(['GET','HEAD','POST','PATCH','DELETE','OPTIONS']);

function unavailable(method) {
  const html='<!doctype html><html lang="hu"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Yumetrics · Tartalék elérés</title><body style="margin:0;background:#f3f5ef;color:#35472f;font:16px/1.6 Arial,sans-serif"><main style="max-width:520px;margin:10vh auto;padding:28px"><p style="font-weight:bold;font-size:26px">yumetrics</p><h1 style="font-size:28px">A napló most nem érhető el.</h1><p>A tartalék cím működik, de a központi alkalmazás most nem válaszol. A korábban mentett adataidat ez az oldal nem módosítja.</p><p>Próbáld újra néhány perc múlva.</p><a href="/" style="display:inline-block;padding:12px 18px;background:#40543a;color:white;border-radius:8px;text-decoration:none">Újrapróbálom</a><p style="font-size:13px">Ez a tartalék bejárat ugyanazt a naplót éri el; külön adatmásolatot nem tárol.</p></main></body></html>';
  return new Response(method==='HEAD'?null:html,{status:503,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Retry-After':'60','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'"}});
}

export function createBackupProxy(fetcher = fetch) {
  return {
    async fetch(request) {
      const incoming=new URL(request.url);
      if(incoming.origin!==BACKUP_ORIGIN)return new Response('Invalid host',{status:403});
      if(!METHODS.has(request.method))return new Response('Method not allowed',{status:405,headers:{Allow:[...METHODS].join(', ')}});
      if(!['GET','HEAD'].includes(request.method)){
        const origin=request.headers.get('Origin');
        if(origin&&origin!==BACKUP_ORIGIN||request.headers.get('Sec-Fetch-Site')==='cross-site')return new Response('Cross-site request rejected',{status:403});
      }
      const headers=new Headers(request.headers);
      for(const name of [...headers.keys()])if(/^(host|authorization|oai-|x-forwarded-|forwarded$|cf-)/i.test(name))headers.delete(name);
      const cookies=(request.headers.get('Cookie')||'').split(';').map(s=>s.trim()).filter(s=>COOKIE_NAMES.has(s.slice(0,s.indexOf('='))));
      if(cookies.length)headers.set('Cookie',cookies.join('; '));else headers.delete('Cookie');
      if(headers.has('Origin'))headers.set('Origin',UPSTREAM);
      headers.delete('Referer');
      if(headers.has('Sec-Fetch-Site'))headers.set('Sec-Fetch-Site','same-origin');
      const target=new URL(UPSTREAM);target.pathname=incoming.pathname;target.search=incoming.search;
      try {
        const upstream=await fetcher(new Request(target,{method:request.method,headers,redirect:'manual',signal:AbortSignal.timeout(30000),
          ...(!['GET','HEAD'].includes(request.method)?{body:request.body,duplex:'half'}:{})}));
        if(upstream.status>=500)return unavailable(request.method);
        const responseHeaders=new Headers(upstream.headers);
        responseHeaders.set('Cache-Control','no-store');responseHeaders.delete('Alt-Svc');
        const location=responseHeaders.get('Location');
        if(location){
          const destination=new URL(location,UPSTREAM);
          if(incoming.pathname==='/auth/google'&&destination.origin==='https://accounts.google.com'&&destination.searchParams.get('redirect_uri')===BRIDGE){
            const state=destination.searchParams.get('state');
            if(/^[a-f0-9]{64}$/.test(state||''))destination.searchParams.set('state','backup.'+state);
            responseHeaders.set('Location',destination.href);
          }else if([UPSTREAM,'https://www.yumetrics.app','https://http--yumetrics--dmg6gnvmmd7s.code.run'].includes(destination.origin)){
            responseHeaders.set('Location',BACKUP_ORIGIN+destination.pathname+destination.search+destination.hash);
          }
        }
        return new Response(upstream.body,{status:upstream.status,statusText:upstream.statusText,headers:responseHeaders});
      }catch{return unavailable(request.method);}
    }
  };
}
export default createBackupProxy();
