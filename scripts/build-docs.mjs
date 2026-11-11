import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {readdirSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('..',import.meta.url));
const python=process.env.MKDOCS_PYTHON || 'python';
execFileSync(python,['-c','from babel.messages.frontend import main; main()','compile','--directory','docs/theme/locales','--locale','hu'],{cwd:root,stdio:'inherit'});
execFileSync(python,['-m','mkdocs','build','--strict'],{cwd:root,stdio:'inherit'});
for(const file of readdirSync(resolve(root,'public/technical-docs'),{recursive:true}).filter(file=>file.endsWith('.html'))){
  const html=readFileSync(resolve(root,'public/technical-docs',file),'utf8');
  assert.ok(!/<script\b(?![^>]*\bsrc=)[^>]*>/i.test(html),'Inline script violates CSP: '+file);
  assert.ok(!/<script\b[^>]*\bsrc=["'](?:https?:)?\/\//i.test(html),'External documentation script: '+file);
}
