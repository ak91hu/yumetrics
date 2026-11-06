import { readFileSync, mkdirSync, copyFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { STATIC_FILES } from '../lib/http.mjs';

const root = fileURLToPath(new URL('..', import.meta.url)), out = resolve(root, 'dist');
for (const folder of ['server/lib', '.openai/drizzle/meta']) mkdirSync(resolve(out, folder), { recursive: true });
for (const name of ['api', 'domain', 'http', 'providers']) copyFileSync(resolve(root, `lib/${name}.mjs`), resolve(out, `server/lib/${name}.mjs`));
copyFileSync(resolve(root, 'worker/index.mjs'), resolve(out, 'server/index.js'));
const assets = Object.fromEntries(Object.entries(STATIC_FILES).map(([path, [file, type]]) => [path, { type, content: readFileSync(resolve(root, 'public', file), 'utf8') }]));
writeFileSync(resolve(out, 'server/assets.mjs'), `export const assets = ${JSON.stringify(assets)};\n`);
const journal = JSON.parse(readFileSync(resolve(root, 'drizzle/meta/_journal.json'), 'utf8'));
for (const name of [...journal.entries.map(entry => `${entry.tag}.sql`), 'meta/_journal.json']) copyFileSync(resolve(root, 'drizzle', name), resolve(out, '.openai/drizzle', name));
const manifest = JSON.parse(readFileSync(resolve(root, '.openai/hosting.json'), 'utf8'));
writeFileSync(resolve(out, '.openai/hosting.json'), JSON.stringify(manifest, null, 2));
console.log('Elkészült a függőségmentes Worker: dist/server/index.js');
