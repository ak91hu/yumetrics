import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {readdirSync,readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {STATIC_FILES} from '../lib/http.mjs';
const root=fileURLToPath(new URL('..',import.meta.url));
const python=process.env.MKDOCS_PYTHON || 'python';
execFileSync(python,['-c','from babel.messages.frontend import main; main()','compile','--directory','docs/theme/locales','--locale','hu'],{cwd:root,stdio:'inherit'});
execFileSync(python,['-m','mkdocs','build','--strict'],{cwd:root,stdio:'inherit'});
for(const file of readdirSync(resolve(root,'public/technical-docs'),{recursive:true}).filter(file=>file.endsWith('.html'))){
  const html=readFileSync(resolve(root,'public/technical-docs',file),'utf8');
  assert.ok(!/<script\b(?![^>]*\bsrc=)[^>]*>/i.test(html),'Inline script violates CSP: '+file);
  assert.ok(!/<script\b[^>]*\bsrc=["'](?:https?:)?\/\//i.test(html),'External documentation script: '+file);
}

// Render the public legal pages from the reviewed Markdown, keeping one source for each language.
const legalPages=Object.entries(STATIC_FILES).filter(([, [file]])=>file.startsWith('legal/')).map(([url,[file]])=>({url,file,source:file.slice('legal/'.length,-'.html'.length).toUpperCase()+'.md'}));
const rendered=JSON.parse(execFileSync(python,['-c','import json,sys,markdown; from pathlib import Path; print(json.dumps({name:markdown.markdown((Path("docs/legal")/name).read_text(encoding="utf-8"),extensions=["tables","toc"]) for name in sys.argv[1:]}))',...legalPages.map(page=>page.source)],{cwd:root,encoding:'utf8'}));
mkdirSync(resolve(root,'public/legal'),{recursive:true});
for(const page of legalPages){
  const english=page.source.endsWith('-EN.md'),language=english?'en':'hu';
  const sibling=legalPages.find(other=>other.source===page.source.replace(english?'-EN.md':'-HU.md',english?'-HU.md':'-EN.md'));
  const title=page.source.startsWith('PRIVACY')?(english?'Privacy notice':'Adatkezelési tájékoztató'):(english?'Terms of use and liability':'Felhasználási és felelősségi feltételek');
  const back=english?'Back to Yumetrics':'Vissza a Yumetricshez';
  const content=rendered[page.source].replace(/href="([^"#]+\.md)(#[^"]*)?"/g,(_,name,fragment='')=>`href="${legalPages.find(other=>other.source===name)?.url||'https://github.com/ak91hu/yumetrics/blob/main/docs/legal/'+name}${fragment}"`)
    .replaceAll('<table>',`<div class="legal-table" role="region" tabindex="0" aria-label="${english?'Horizontally scrollable table':'Vízszintesen görgethető táblázat'}"><table>`).replaceAll('</table>','</table></div>');
  assert.ok(!/<script\b/i.test(content),'Legal Markdown must not include scripts: '+page.source);
  writeFileSync(resolve(root,'public',page.file),`<!doctype html><html lang="${language}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><meta name="theme-color" content="#536847"><title>${title} · Yumetrics</title><link rel="icon" href="/favicon.svg"><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/cozy.css"><link rel="stylesheet" href="/account.css"></head><body class="legal-page"><a class="skip-link" href="#main">${english?'Skip to content':'Ugrás a tartalomra'}</a><header class="legal-header"><a class="brand" href="/" aria-label="${back}"><img class="brand-wordmark" src="/logo.svg" width="190" height="48" alt="Yumetrics"></a><nav class="legal-languages" aria-label="Language / Nyelv"><a href="${english?sibling.url:page.url}" lang="hu" hreflang="hu"${english?'':' aria-current="page"'}>Magyar</a><a href="${english?page.url:sibling.url}" lang="en" hreflang="en"${english?' aria-current="page"':''}>English</a></nav></header><main id="main" class="legal-content" tabindex="-1">${content}<a class="legal-back" href="/">← ${back}</a></main><footer class="site-footer"><span class="footer-brand">yumetrics</span><nav class="footer-links" aria-label="${english?'Useful links':'Hasznos hivatkozások'}"><a href="${english?'/guide':'/utmutato'}">${english?'Guide and methodology':'Útmutató és módszertan'}</a><span class="footer-separator" aria-hidden="true">·</span><a href="/docs/">${english?'Technical documentation':'Technikai dokumentáció'}</a><span class="footer-separator" aria-hidden="true">·</span><a href="${english?'/privacy':'/adatvedelem'}">${english?'Privacy notice':'Adatkezelési tájékoztató'}</a></nav></footer></body></html>`);
}
