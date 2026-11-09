import { randomUUID } from 'node:crypto';

export const PRICE_SOURCE = 'https://opencode.ai/docs/console/models/#pricing';
export function modelPricing(model, at = new Date().toISOString()) {
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
  return tokens && pricing ? ((tokens.input - tokens.cached) * pricing.input + tokens.cached * pricing.cachedInput + (tokens.output + tokens.thoughts) * pricing.output) / 1e6 : null;
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
export async function recordAiResponse(db, record, {usage, httpStatus, latencyMs}) {
  const tokens = usageTotals(usage);
  const safeUsage = tokens ? {promptTokenCount:tokens.input,candidatesTokenCount:tokens.output,cachedContentTokenCount:tokens.cached,thoughtsTokenCount:tokens.thoughts} : null;
  await db.prepare('UPDATE ai_requests SET usage=?,input_tokens=?,output_tokens=?,cached_tokens=?,thought_tokens=?,cost_usd=?,http_status=?,latency_ms=?,finished_at=? WHERE id=?').bind(JSON.stringify(safeUsage),tokens?.input ?? null,tokens?.output ?? null,tokens?.cached ?? null,tokens?.thoughts ?? null,estimatedCost(safeUsage,record.pricing),httpStatus,latencyMs,new Date().toISOString(),record.id).run();
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
