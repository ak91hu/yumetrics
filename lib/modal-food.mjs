import { AppError, PROMPT_VERSION } from './domain.mjs';
import { readAiResponse, imageHashes } from './ai-archive.mjs';

export const MODAL_FOOD_MODEL = 'modal/food-r1-8b';
export const FOOD_R1_REVISION = 'c70e0d6585b1e81923432df46014d6ce32855e3f';
export function modalConfigured(env) {
  return Boolean(env.MODAL_FOOD_URL && env.MODAL_PROXY_TOKEN_ID && env.MODAL_PROXY_TOKEN_SECRET);
}
export function foodCandidates(answer) {
  if (typeof answer !== 'string' || answer.length > 3000) return null;
  let value;
  try { value = JSON.parse(answer.replace(/^```(?:json)?\s*|\s*```$/g, '')); } catch { return null; }
  if (!value || !Array.isArray(value.foods) || value.foods.length > 20 || !value.foods.every(name => typeof name === 'string' && /^[\p{L}\p{M}\p{N} .,'’()/+-]{1,80}$/u.test(name) && name.trim())) return null;
  return [...new Set(value.foods.map(name => name.trim()))];
}
export async function recognizeFoods(images, env, fetcher, options = {}) {
  if (!modalConfigured(env)) return { state: 'disabled' };
  if (!/^https:\/\/[a-z0-9-]+(?:\.[a-z0-9-]+)?\.modal\.run\/recognize$/.test(env.MODAL_FOOD_URL)) throw new AppError('Hibás Modal-végpontbeállítás.', 503);
  if (await options.onModalStart?.({provider:'modal',promptVersion:PROMPT_VERSION,modelRevision:FOOD_R1_REVISION,imageHashes:imageHashes(images)}) === false) return { state:'budget', model:MODAL_FOOD_MODEL };
  const started = Date.now();
  let response, result, candidates = null, archive={responseMeta:{provider:'modal',networkError:true}};
  try {
    response = await fetcher(env.MODAL_FOOD_URL, {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(60_000),
      headers: { 'Content-Type': 'application/json', 'Modal-Key': env.MODAL_PROXY_TOKEN_ID, 'Modal-Secret': env.MODAL_PROXY_TOKEN_SECRET },
      body: JSON.stringify({ images }),
    });
    const received=await readAiResponse(response,env,'modal');result=received.payload;archive=received.archive;
    if (response.ok && result?.model === 'zy12123/Food-R1' && result.revision === FOOD_R1_REVISION && result.truncated === false) candidates = foodCandidates(result.answer);
  } catch { /* The independent OpenCode analysis remains available when the optional recognizer fails. */ }
  const identityMatches = result?.model === 'zy12123/Food-R1' && result.revision === FOOD_R1_REVISION;
  const usage = identityMatches && Number.isSafeInteger(result.input_tokens) && result.input_tokens >= 0 && Number.isSafeInteger(result.output_tokens) && result.output_tokens >= 0 ? { promptTokenCount: result.input_tokens, candidatesTokenCount: result.output_tokens } : null;
  const computeSeconds = response?.ok && identityMatches && Number.isFinite(result?.compute_seconds) && result.compute_seconds >= 0 && result.compute_seconds <= 600 ? result.compute_seconds : null;
  await options.onModalResponse?.({ usage, computeSeconds, httpStatus: response?.status ?? null, latencyMs: Date.now() - started, valid: candidates !== null,...archive });
  return candidates === null ? { state: 'failed', model: MODAL_FOOD_MODEL } : { state: 'used', model: MODAL_FOOD_MODEL, candidates };
}
