import {readFileSync,statSync} from 'node:fs';
import {resolve,extname,sep} from 'node:path';

const DOC_TYPES={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon','.woff':'font/woff','.woff2':'font/woff2','.ttf':'font/ttf','.eot':'application/vnd.ms-fontobject','.xml':'application/xml','.gz':'application/gzip'};
export function technicalDocumentation(pathname,method,directory){
  const missing=()=>Response.json({error:'Nem található.'},{status:404});
  if(!['GET','HEAD'].includes(method))return new Response(null,{status:405,headers:{Allow:'GET, HEAD'}});
  if(pathname==='/docs')return new Response(null,{status:308,headers:{Location:'/docs/'}});
  let name;
  try{name=decodeURIComponent(pathname.slice('/docs/'.length));}catch{return missing();}
  if(!pathname.startsWith('/docs/')||name.includes('\\')||name.includes('\0')||name.split('/').some(part=>part.startsWith('.')))return missing();
  const isDirectory=!extname(name),file=resolve(directory,name+(isDirectory?(name.endsWith('/')||!name?'index.html':'/index.html'):''));
  if(!file.startsWith(resolve(directory)+sep)||!DOC_TYPES[extname(file)]||!statSync(file,{throwIfNoEntry:false})?.isFile())return missing();
  if(isDirectory&&!pathname.endsWith('/'))return new Response(null,{status:308,headers:{Location:pathname+'/'}});
  return new Response(method==='HEAD'?null:readFileSync(file),{headers:{'Content-Type':DOC_TYPES[extname(file)],'Cache-Control':'no-store'}});
}

export const SECURITY_HEADERS = {
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.googleusercontent.com; connect-src 'self'; font-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; object-src 'none'",
  'Cross-Origin-Opener-Policy': 'same-origin',
  'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Permissions-Policy': 'camera=(self), microphone=(), geolocation=()',
};
export const STATIC_FILES = { '/': ['index.html', 'text/html; charset=utf-8'], '/index.html': ['index.html', 'text/html; charset=utf-8'], '/app.mjs': ['app.mjs', 'text/javascript; charset=utf-8'], '/analysis-ui.mjs': ['analysis-ui.mjs', 'text/javascript; charset=utf-8'], '/domain.mjs': ['../lib/domain.mjs', 'text/javascript; charset=utf-8'], '/food-reference.mjs': ['../lib/food-reference.mjs', 'text/javascript; charset=utf-8'], '/styles.css': ['styles.css', 'text/css; charset=utf-8'], '/favicon.svg': ['favicon.svg', 'image/svg+xml'] };
STATIC_FILES['/context-help.mjs'] = ['context-help.mjs', 'text/javascript; charset=utf-8'];
STATIC_FILES['/cozy.css'] = ['cozy.css', 'text/css; charset=utf-8'];
STATIC_FILES['/account.css'] = ['account.css', 'text/css; charset=utf-8'];
STATIC_FILES['/login.mjs'] = ['login.mjs', 'text/javascript; charset=utf-8'];
STATIC_FILES['/hero-pork-knuckle.webp'] = ['hero-pork-knuckle.webp', 'image/webp'];
STATIC_FILES['/hungarian-food.mjs'] = ['../lib/hungarian-food.mjs', 'text/javascript; charset=utf-8'];
STATIC_FILES['/utmutato'] = ['help.html', 'text/html; charset=utf-8'];
STATIC_FILES['/help.html'] = ['help.html', 'text/html; charset=utf-8'];
STATIC_FILES['/guide'] = ['help.html', 'text/html; charset=utf-8'];
STATIC_FILES['/help-en.html'] = ['help.html', 'text/html; charset=utf-8'];
for (const [path, file] of Object.entries({ '/adatvedelem':'privacy-hu', '/privacy':'privacy-en', '/feltetelek':'terms-hu', '/terms':'terms-en' })) STATIC_FILES[path] = [`legal/${file}.html`, 'text/html; charset=utf-8'];
STATIC_FILES['/localization.mjs'] = ['localization.mjs', 'text/javascript; charset=utf-8'];
STATIC_FILES['/i18n.mjs'] = ['../lib/i18n.mjs', 'text/javascript; charset=utf-8'];
STATIC_FILES['/translations-en.mjs'] = ['../lib/translations-en.mjs', 'text/javascript; charset=utf-8'];

STATIC_FILES['/logo.svg'] = ['logo.svg', 'image/svg+xml'];
STATIC_FILES['/brand-banner.svg'] = ['brand-banner.svg', 'image/svg+xml'];
STATIC_FILES['/profile-ui.mjs'] = ['profile-ui.mjs', 'text/javascript; charset=utf-8'];
STATIC_FILES['/product-label.mjs'] = ['../lib/product-label.mjs', 'text/javascript; charset=utf-8'];
STATIC_FILES['/admin'] = ['admin.html', 'text/html; charset=utf-8'];
STATIC_FILES['/admin.html'] = ['admin.html', 'text/html; charset=utf-8'];
STATIC_FILES['/admin.mjs'] = ['admin.mjs', 'text/javascript; charset=utf-8'];
STATIC_FILES['/admin.css'] = ['admin.css', 'text/css; charset=utf-8'];
for (const id of ['first', 'three', 'seven', 'fourteen', 'thirty', 'hundred']) STATIC_FILES[`/badges/${id}.png`] = [`badges/${id}.png`, 'image/png'];

STATIC_FILES['/admin-charts.mjs'] = ['admin-charts.mjs', 'text/javascript; charset=utf-8'];
