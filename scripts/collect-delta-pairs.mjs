// Collects δ calibration pairs on weighed plates: fast result (vision + Jev + code), the
// independent Food-R1 /estimate total and the weighed truth. Feed the output to
//   node scripts/calibrate-jev.mjs --delta-pairs outputs/delta-pairs.json --write
// Usage: node scripts/collect-delta-pairs.mjs work/nutrition5k-haiku-v2/cases.json [more cases.json…]
// Needs OPENCODE_API_KEY, MODAL_FOOD_URL, MODAL_PROXY_TOKEN_ID/SECRET (JEV_API, USDA_API_KEY optional).
// Paid: one vision call per plate plus one Food-R1 GPU call. It checks /estimate before spending.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { analyze } from '../lib/providers.mjs';
import { estimateFood, modalConfigured } from '../lib/modal-food.mjs';
import { analysisReport } from '../lib/domain.mjs';

const env = process.env, files = process.argv.slice(2).filter(arg => !arg.startsWith('--'));
const out = process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : 'outputs/delta-pairs.json';
if (!files.length) throw Error('Give at least one cases.json with weighed plates.');
if (!env.OPENCODE_API_KEY || !modalConfigured(env)) throw Error('OPENCODE_API_KEY and the Modal settings are required.');
const probe = await fetch(env.MODAL_FOOD_URL.replace(/\/recognize$/, '/estimate'), { method: 'POST', headers: { 'Content-Type': 'application/json', 'Modal-Key': env.MODAL_PROXY_TOKEN_ID, 'Modal-Secret': env.MODAL_PROXY_TOKEN_SECRET }, body: '{"images":[]}', signal: AbortSignal.timeout(60_000) });
if (probe.status === 404) throw Error('The deployed Modal app has no /estimate yet: run `modal deploy scripts/modal_foodr1.py` first. Nothing was spent.');
const dataUrl = file => `data:image/${file.endsWith('.png') ? 'png' : 'jpeg'};base64,` + readFileSync(file).toString('base64');
const pairs = existsSync(out) ? JSON.parse(readFileSync(out, 'utf8')) : [], seen = new Set(pairs.map(pair => pair.id));
for (const file of files) {
  const set = JSON.parse(readFileSync(file, 'utf8')), base = dirname(resolve(file));
  for (const plate of set.cases) {
    if (seen.has(plate.id) || !plate.reference?.measured || !Number.isFinite(plate.reference.calories)) continue;
    const image = dataUrl(resolve(base, plate.image)), secondImage = plate.secondImage ? dataUrl(resolve(base, plate.secondImage)) : null;
    try {
      const fast = await analyze(image, plate.notes || '', env, fetch, { secondImage, context: plate.context || {} });
      const second = await estimateFood([image, ...(secondImage ? [secondImage] : [])], env, fetch);
      if (second.state !== 'used') { console.error(plate.id, 'Food-R1:', second.state); continue; }
      const pair = { id: plate.id, source: set.source, fastKcal: analysisReport(fast.analysis).total.calories, foodR1Kcal: second.totalKcal, truthKcal: plate.reference.calories, path: fast.usage.pipeline?.path ?? null };
      pairs.push(pair); seen.add(plate.id); console.error(JSON.stringify(pair));
      writeFileSync(out, JSON.stringify(pairs, null, 2));
    } catch (error) { console.error(plate.id, 'failed:', error.message); }
  }
}
console.log(`${pairs.length} pairs in ${out}`);
