import { randomUUID } from 'node:crypto';
import { archiveText, archiveJson } from './ai-archive.mjs';

export const PRICE_SOURCE = 'https://opencode.ai/docs/console/models/#pricing';
export function modelPricing(model, at = new Date().toISOString()) {
  if (model === 'claude-haiku-5-5' && at >= '2026-11-13') return { currency:'USD', input:.1, output:.5, cachedInput:.01, cacheCreation:.125, longContextThreshold:100000, longContextMultiplier:5, verifiedAt:'2026-11-13', source:PRICE_SOURCE };
  if (model === 'modal/food-r1-8b' && at >= '2026-11-10') return { currency:'USD', type:'compute', second:.000542 + 2 * .0000131 + 16 * .00000222, verifiedAt:'2026-11-10', source:'https://modal.com/pricing', scope:'Modellbetöltés és elemzés; HTTP-végpont kiszolgálása, üresjárat, tárhely és indulási többlet nélkül.' };
  if (model === 'gemini-3.5-flash-lite' && at >= '2026-11-12') return { currency:'USD', input:.3, output:2.5, cachedInput:.03, verifiedAt:'2026-11-12', source:PRICE_SOURCE };
  if (model === 'gemini-3.8-flash' && at >= '2026-11-12' && at < '2027-01-01') return { currency:'USD', input:.75, output:3.75, cachedInput:.075, verifiedAt:'2026-11-12', source:PRICE_SOURCE };
  if (model === 'gemini-3.8-flash' && at >= '2026-11-09') return { currency:'USD', input:1.5, output:7.5, cachedInput:.15, verifiedAt:'2026-11-09', source:PRICE_SOURCE };
  if (model !== 'gemini-4-argon' || at < '2026-10-13') return null;
  const discount = at < '2026-12-01';
  return { currency:'USD', input:discount ? 2 : 4, output:discount ? 10 : 20, cachedInput:discount ? .1 : .2, verifiedAt:'2026-11-09', source:PRICE_SOURCE };
}
export function usageTotals(usage) {
  const passes = usage?.passes || (usage ? [usage] : []);
  if (!Array.isArray(passes) || !passes.length) return null;
  const total = { input:0, output:0, cached:0, thoughts:0 };
  for (const pass of passes) {
    const values = { input:pass?.promptTokenCount, output:pass?.candidatesTokenCount, cached:pass?.cachedContentTokenCount ?? 0, thoughts:pass?.thoughtsTokenCount ?? 0 };
    if (!Object.values(values).every(value => Number.isSafeInteger(value) && value >= 0 && value <= 1e10) || values.cached > values.input) return null;
    for (const key of Object.keys(total)) total[key] += values[key];
  }
  return total;
}
export function estimatedCost(usage, pricing) {
  const tokens = usageTotals(usage);
  if (!tokens || !pricing || pricing.type === 'compute') return null;
  let total = 0;
  for (const pass of usage.passes || [usage]) {
    const part = usageTotals(pass), created = pass.cacheCreationTokenCount ?? 0;
    if (!Number.isSafeInteger(created) || created < 0 || created + part.cached > part.input || created > 0 && !Number.isFinite(pricing.cacheCreation)) return null;
    const multiplier = part.input > (pricing.longContextThreshold ?? Infinity) ? pricing.longContextMultiplier : 1;
    total += ((part.input - part.cached - created) * pricing.input + part.cached * pricing.cachedInput + created * (pricing.cacheCreation ?? 0) + (part.output + part.thoughts) * pricing.output) * multiplier / 1e6;
  }
  return total;
}
export async function logEvent(db, {level='info', category='processing', event, message, userId=null, mealId=null, code=null}) {
  await db.prepare('INSERT INTO app_logs(id,level,category,event,message,user_id,meal_id,code,created_at) VALUES(?,?,?,?,?,?,?,?,?)').bind(randomUUID(),level,category,event,message.slice(0,1000),userId,mealId,code,new Date().toISOString()).run();
}
export async function startAiRequest(db, meal, model) {
  const record = { id:randomUUID(), mealId:meal.id, userId:meal.user_id, model, createdAt:new Date().toISOString() };
  record.pricing = modelPricing(model, record.createdAt);
  await db.prepare("INSERT INTO ai_requests(id,meal_id,user_id,model,state,pricing,created_at) VALUES(?,?,?,?,'running',?,?)").bind(record.id,record.mealId,record.userId,model,JSON.stringify(record.pricing),record.createdAt).run();
  return record;
}
export async function startModalRequest(db, meal, budgetUsd = 15) {
  if (!Number.isFinite(budgetUsd) || budgetUsd <= 0 || budgetUsd > 1000) return null;
  const model = 'modal/food-r1-8b', month = new Date().toISOString().slice(0,7) + '-01T00:00:00.000Z';
  const reservation = 90 * modelPricing(model).second;
  return db.transaction(async transaction => {
    // Serialize the shared allowance across workers without changing settings.
    await transaction.prepare('UPDATE app_settings SET revision=revision WHERE id=1').bind().run();
    const spent = await transaction.prepare('SELECT COALESCE(SUM(COALESCE(cost_usd,?)),0) AS total FROM ai_requests WHERE model=? AND created_at>=?').bind(reservation,model,month).first();
    return Number(spent.total) + reservation <= budgetUsd ? startAiRequest(transaction,meal,model) : null;
  });
}
export async function recordAiResponse(db, record, {usage, httpStatus, latencyMs, computeSeconds = null, responseText = null, responseMeta = null, responseTruncated = false}, env = {}) {
  const tokens = usageTotals(usage);
  const created = usage?.cacheCreationTokenCount ?? 0;
  const safeUsage = tokens && Number.isSafeInteger(created) && created >= 0 && created + tokens.cached <= tokens.input ? {promptTokenCount:tokens.input,candidatesTokenCount:tokens.output,cachedContentTokenCount:tokens.cached,thoughtsTokenCount:tokens.thoughts,cacheCreationTokenCount:created} : null;
  const seconds = Number.isFinite(computeSeconds) && computeSeconds >= 0 && computeSeconds <= 600 ? computeSeconds : null;
  const cost = record.pricing?.type === 'compute' ? seconds == null ? null : seconds * record.pricing.second : estimatedCost(safeUsage,record.pricing);
  const saved=archiveText(responseText,env), hasArchive=responseText!==null||responseMeta!==null;
  await db.prepare('UPDATE ai_requests SET usage=?,input_tokens=?,output_tokens=?,cached_tokens=?,thought_tokens=?,cost_usd=?,http_status=?,latency_ms=?,finished_at=?,response_text=COALESCE(?,response_text),response_meta=COALESCE(?,response_meta),response_truncated=COALESCE(?,response_truncated) WHERE id=?').bind(JSON.stringify(safeUsage && { ...safeUsage, ...(record.pricing?.type === 'compute' ? { computeSeconds:seconds } : {}) }),tokens?.input ?? null,tokens?.output ?? null,tokens?.cached ?? null,tokens?.thoughts ?? null,cost,httpStatus,latencyMs,new Date().toISOString(),saved.text,responseMeta===null?null:archiveJson(responseMeta,env),hasArchive?(responseTruncated||saved.truncated?1:0):null,record.id).run();
}
export async function recordAiRequestMeta(db, record, metadata, env) {
  await db.prepare('UPDATE ai_requests SET request_meta=? WHERE id=?').bind(archiveJson(metadata,env),record.id).run();
}
export async function recordAiResult(db, record, analysis, env) {
  await db.prepare('UPDATE ai_requests SET result_analysis=? WHERE id=?').bind(archiveJson(analysis,env),record.id).run();
}
export async function importHistoricalUsage(db) {
  // shortcut: pre-ledger deleted meals cannot be reconstructed; use the provider invoice for a complete historical total.
  for (;;) {
    const {results} = await db.prepare('SELECT m.id,m.user_id,m.model,m.usage,m.latency_ms,m.created_at,m.updated_at FROM meals m WHERE m.usage IS NOT NULL AND NOT EXISTS(SELECT 1 FROM ai_requests a WHERE a.meal_id=m.id) ORDER BY m.id LIMIT 250').bind().all();
    if (!results.length) return;
    for (const row of results) {
      let usage; try { usage = JSON.parse(row.usage); } catch { usage = null; }
      const pricing = modelPricing(row.model,row.created_at), tokens = usageTotals(usage);
      const safeUsage = tokens ? {promptTokenCount:tokens.input,candidatesTokenCount:tokens.output,cachedContentTokenCount:tokens.cached,thoughtsTokenCount:tokens.thoughts} : null;
      await db.prepare("INSERT INTO ai_requests(id,meal_id,user_id,model,state,usage,input_tokens,output_tokens,cached_tokens,thought_tokens,cost_usd,pricing,latency_ms,created_at,finished_at) VALUES(?,?,?,?,'imported',?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING").bind('legacy:'+row.id,row.id,row.user_id,row.model || 'unknown',JSON.stringify(safeUsage),tokens?.input ?? null,tokens?.output ?? null,tokens?.cached ?? null,tokens?.thoughts ?? null,estimatedCost(safeUsage,pricing),JSON.stringify(pricing),row.latency_ms,row.created_at,row.updated_at).run();
    }
  }
}
