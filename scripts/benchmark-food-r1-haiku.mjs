import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname, extname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseEnv } from 'node:util';
import { createHash } from 'node:crypto';
import { analyze } from '../lib/providers.mjs';
import { HAIKU_MODEL } from '../lib/meal-models.mjs';
import { modalConfigured, MODAL_FOOD_MODEL } from '../lib/modal-food.mjs';
import { modelPricing, estimatedCost } from '../lib/telemetry.mjs';
import { PROMPT_VERSION, check } from '../lib/domain.mjs';
import { loadCases, evaluationPrediction, evaluationSummary } from './evaluate-nutrition.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');
const dataUrl = path => `data:${extname(path) === '.png' ? 'image/png' : 'image/jpeg'};base64,${readFileSync(path).toString('base64')}`;

export function benchmarkCharge(openCodeUsd, modalUsd, creditUsd, { usdHuf = 328.16, topupUsd = 20, tax = .27 } = {}) {
  check([creditUsd, usdHuf, topupUsd, tax].every(Number.isFinite) && creditUsd >= 0 && usdHuf > 0 && topupUsd > 0 && tax >= 0, 'Hibás díjszámítási paraméter.');
  const known = Number.isFinite(openCodeUsd) && openCodeUsd >= 0 && Number.isFinite(modalUsd) && modalUsd >= 0;
  return { openCodeUsd, modalComputeUsd: modalUsd, creditAppliedUsd: Number.isFinite(modalUsd) ? Math.min(creditUsd, modalUsd) : null,
    grossResourceHuf: known ? (openCodeUsd + modalUsd) * usdHuf : null,
    estimatedPaidHuf: known ? (openCodeUsd * (1.046 + .31 / topupUsd) + Math.max(0, modalUsd - creditUsd)) * (1 + tax) * usdHuf : null };
}

export async function runHybridBenchmark(manifestPath, { run = false, limit = 4, totalCapHuf = 12, modalCreditUsd = null, modes = ['solo', 'hybrid'], env = {}, fetcher = fetch, output } = {}) {
  check(Number.isInteger(limit) && limit >= 1 && limit <= 12 && Number.isFinite(totalCapHuf) && totalCapHuf > 0 && totalCapHuf <= 36, 'Legfeljebb 12 eset és 36 Ft tesztkeret adható meg.');
  check(Array.isArray(modes) && modes.length > 0 && new Set(modes).size === modes.length && modes.every(mode => ['solo', 'hybrid'].includes(mode)), 'Hibás tesztág.');
  const needsModal = modes.includes('hybrid');
  const raw = readFileSync(manifestPath, 'utf8'), manifest = JSON.parse(raw), cases = loadCases(manifestPath).slice(0, limit);
  // Verify the locked images before any network call. Targets never enter model input.
  for (const item of cases) {
    const source = manifest.cases.find(candidate => candidate.id === item.id);
    check(source.images?.length === item.paths.length, 'Hiányzó képlenyomat.');
    for (const [index, path] of item.paths.entries()) check(hash(readFileSync(path)) === source.images[index].sha256, 'Megváltozott tesztkép.');
  }
  const report = { status: run ? 'running' : 'prepared', manifestSha256: hash(raw), source: manifest.source, license: manifest.license,
    model: HAIKU_MODEL, helper: MODAL_FOOD_MODEL, thinking: {type:'adaptive',effort:'high',maxOutputTokens:4096}, promptVersion: PROMPT_VERSION, startedAt: new Date().toISOString(),
    implementationHashes: Object.fromEntries(['lib/providers.mjs', 'lib/meal-models.mjs', 'lib/recognition-review.mjs', 'lib/food-reference.mjs', 'lib/domain.mjs', 'scripts/benchmark-food-r1-haiku.mjs'].map(file => [file, hash(readFileSync(new URL('../' + file, import.meta.url)))])),
    plan: { cases: cases.map(item => item.id), modes, maxOpenCodeCalls: cases.length * modes.length, maxModalCalls: needsModal ? cases.length : 0, totalCapHuf, perMealTargetHuf: 3,
      modalCreditSnapshotUsd: modalCreditUsd, usdHuf: 328.16, assumedTax: .27, topupUsd: 20,
      design: 'Same images, no weight or ingredient hints from references. Alternate solo/hybrid order by case. One live Food-R1 per hybrid meal; one Haiku per branch. No repair, retry, or fresh Gemini calls.' },
    caveats: ['Small exploratory sample, not a population accuracy claim or Hungarian-food validation.',
      'Public test data may have appeared in model training; held out from local development only.',
      '3 HUF is assessed after the response, not a guaranteed pre-request cap; no countTokens call.',
      'Modal compute omits gateway, storage, idle time and platform startup overhead. Credit snapshot must be supplied from billing; monthly allowance alone is not a remaining balance.',
      'Paid HUF is an estimate using assumed tax, topup and FX, not an invoice. Failures are included; missing usage is unknown.'], rows: [] };
  const save = () => {
    report.summary = evaluationSummary(report.rows);
    report.knownPaidHuf = report.rows.reduce((sum, row) => sum + (row.billing?.estimatedPaidHuf ?? 0), 0);
    report.unknownBilling = report.rows.filter(row => row.billing?.estimatedPaidHuf == null).length;
    report.mealsWithinTarget = report.rows.filter(row => row.mode === 'hybrid' && row.predicted && row.billing?.estimatedPaidHuf != null && row.billing.estimatedPaidHuf <= 3).length;
    report.pairedComparison = report.rows.filter(row => row.mode === 'hybrid' && row.predicted).flatMap(hybrid => {
      const solo = report.rows.find(row => row.id === hybrid.id && row.mode === 'solo' && row.predicted);
      if (!solo) return [];
      const error = row => Math.abs(row.predicted.calories - row.reference.calories);
      return [{ id: hybrid.id, soloAbsoluteKcalError: error(solo), hybridAbsoluteKcalError: error(hybrid), differenceKcal: error(hybrid) - error(solo) }];
    });
    report.qualityScreen = { assessed: report.rows.filter(row => row.mode === 'hybrid' && row.predicted).length,
      within20PercentKcal: report.rows.filter(row => row.mode === 'hybrid' && row.predicted && Math.abs(row.predicted.calories - row.reference.calories) <= row.reference.calories * .2).length,
      note: 'Predeclared exploratory screen, not a validated accuracy threshold. Ingredient correctness requires separate manual review; 4 dishes cannot establish general equivalence.' };
    if (output) { mkdirSync(dirname(resolve(output)), { recursive: true }); writeFileSync(output, JSON.stringify(report, null, 2)); }
  };
  save();
  if (!run) return report;
  if (!env.OPENCODE_API_KEY || needsModal && (!modalConfigured(env) || !Number.isFinite(modalCreditUsd) || modalCreditUsd < 0)) {
    report.status = 'blocked_configuration'; report.stopReason = 'OpenCode API key, three Modal settings and verified remaining Modal credit snapshot are required. No paid calls were made.'; save(); return report;
  }
  let credit = modalCreditUsd ?? 0;
  for (const [index, item] of cases.entries()) {
    for (const mode of (index % 2 ? ['hybrid', 'solo'] : ['solo', 'hybrid']).filter(mode => modes.includes(mode))) {
      const source = manifest.cases.find(candidate => candidate.id === item.id);
      const row = { id: item.id, group: item.group, mode, reference: item.reference, expectedFoods: source.expectedFoods,
        requestMeta: [], providerResponse: null, modalResponse: null };
      // Durable started entry prevents silent reruns after a process/network interruption.
      row.state = 'started'; report.rows.push(row); save();
      try {
        const result = await analyze(dataUrl(item.paths[0]), '', { ...env, OPENCODE_MODEL: HAIKU_MODEL, AI_MAX_OUTPUT_TOKENS: 4096, MODAL_MONTHLY_BUDGET_USD: mode === 'hybrid' ? 15 : 0 }, fetcher, {
          recognitionBefore: mode === 'hybrid', secondImage: item.paths[1] ? dataUrl(item.paths[1]) : undefined, context: { language: 'hu' },
          onOpenCodeStart: metadata => { row.requestMeta.push(metadata); save(); },
          onResponse: data => { row.providerResponse = data; save(); },
          onModalStart: metadata => { row.requestMeta.push(metadata); save(); },
          onModalResponse: data => { row.modalResponse = data; save(); },
        });
        Object.assign(row, { state: 'completed', predicted: evaluationPrediction(result.analysis, item.reference), analysis: result.analysis, usage: result.usage, latencyMs: result.latencyMs });
      } catch (error) { row.state = 'failed'; row.error = error.status ? error.message : 'Provider or benchmark failure'; }
      const tokenEstimateUsd = row.providerResponse ? estimatedCost(row.providerResponse.usage, modelPricing(HAIKU_MODEL)) : null;
      const providerCost = row.providerResponse?.usage?.cost;
      const reportedUsd = Number.isFinite(providerCost) && providerCost >= 0 ? providerCost : null;
      const openCodeUsd = reportedUsd ?? tokenEstimateUsd;
      const seconds = row.modalResponse?.computeSeconds;
      const modalUsd = mode === 'solo' ? 0 : Number.isFinite(seconds) && seconds >= 0 ? seconds * modelPricing(MODAL_FOOD_MODEL).second : null;
      row.billing = benchmarkCharge(openCodeUsd, modalUsd, credit);
      Object.assign(row.billing, { tokenEstimateUsd, providerReportedUsd: reportedUsd, openCodeCostSource: reportedUsd == null ? 'token_price_estimate' : row.providerResponse.usage.costIsEstimate ? 'provider_estimate' : 'provider_reported_charge' });
      if (row.billing.creditAppliedUsd != null) credit -= row.billing.creditAppliedUsd;
      // Include billed failures in the summary used by the existing evaluation module.
      if (row.providerResponse?.usage && openCodeUsd != null) row.providerResponse.usage.cost = openCodeUsd;
      save();
      if (row.billing.estimatedPaidHuf == null || row.billing.estimatedPaidHuf > 3 || report.knownPaidHuf >= totalCapHuf || row.state !== 'completed' || mode === 'hybrid' && row.usage?.recognition.state !== 'used') {
        report.status = 'stopped'; report.stopReason = 'Unknown billing, exceeded target/cap, rejected analysis or unavailable helper; no automatic retry.'; save(); return report;
      }
    }
  }
  report.status = 'completed'; report.finishedAt = new Date().toISOString(); save(); return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const args = process.argv.slice(2), filename = args.find(arg => !arg.startsWith('--'));
    check(filename && args.every(arg => arg === filename || arg === '--run' || /^--(?:limit|total-cap-huf|modal-credit-usd)=\d+(?:\.\d+)?$/.test(arg)), 'Használat: node scripts/benchmark-food-r1-haiku.mjs cases.json [--run] [--limit=4] [--total-cap-huf=12] [--modal-credit-usd=ELLENŐRZÖTT_EGYENLEG]');
    const option = (name, fallback) => { const value = args.find(arg => arg.startsWith(`--${name}=`)); return value ? Number(value.split('=')[1]) : fallback; };
    const env = { ...(existsSync('.env') ? parseEnv(readFileSync('.env', 'utf8')) : {}), ...process.env };
    const output = resolve('outputs', `food-r1-haiku-${Date.now()}.json`);
    const report = await runHybridBenchmark(filename, { run: args.includes('--run'), limit: option('limit', 4), totalCapHuf: option('total-cap-huf', 12), modalCreditUsd: option('modal-credit-usd', null), env, output });
    // Callbacks contain only provider-redacted public text and hashed image metadata.
    console.log(JSON.stringify({ status: report.status, cases: report.plan.cases, knownPaidHuf: report.knownPaidHuf, output }));
  } catch (error) { console.error(error.status ? error.message : 'A benchmark futtatása nem sikerült.'); process.exitCode = 1; }
}
