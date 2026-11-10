import { randomUUID } from 'node:crypto';
import { analyze, cloudinary } from './providers.mjs';
import { AppError, check } from './domain.mjs';
import { runtimeSettings } from './settings.mjs';
import { startAiRequest, startModalRequest, recordAiResponse, recordAiRequestMeta, recordAiResult, logEvent } from './telemetry.mjs';

import { storedPhotoData, securePhoto } from './photos.mjs';
export { storedPhotoData } from './photos.mjs';

const now = () => new Date().toISOString();
export async function processNextJob({ db, env, fetcher = fetch }) {
  const time = now(), token = randomUUID();
  // A crashed worker may already have sent its AI request; require an explicit retry.
  await db.transaction(async transaction => {
    const interrupted = await transaction.prepare("UPDATE analysis_jobs SET state='failed',error=?,lease_token=NULL,lease_until=NULL,updated_at=? WHERE kind='analyze' AND state='running' AND lease_until<? RETURNING meal_id").bind('Az elemzés megszakadt. Új AI-kérés csak kézi újrapróbáláskor indul.', time, time).all();
    for (const row of interrupted.results) {
      await transaction.prepare("UPDATE meals SET status='failed',error=?,updated_at=? WHERE id=?").bind('Az elemzés megszakadt. Új AI-kérés csak kézi újrapróbáláskor indul.', time, row.meal_id).run();
      await transaction.prepare("UPDATE ai_requests SET state='interrupted',finished_at=? WHERE meal_id=? AND state='running'").bind(time,row.meal_id).run();
      await logEvent(transaction,{level:'warning',event:'analysis.interrupted',message:'Az elemzés futás közben megszakadt. Új kérés csak kézi újrapróbáláskor indul.',mealId:row.meal_id});
    }
  });
  const exhausted = await db.prepare("UPDATE analysis_jobs SET state='failed',error=?,updated_at=? WHERE state IN ('running','uploading') AND lease_until<? AND attempts>=3 RETURNING meal_id").bind('Az elemzés ismételten megszakadt. A tárolt képekből újrapróbálható.', time, time).all();
  for (const row of exhausted.results) await db.prepare("UPDATE meals SET status='failed',error=? WHERE id=?").bind('Az elemzés megszakadt. A tárolt képek és az adatok megmaradtak.', row.meal_id).run();
  const job = await db.prepare("UPDATE analysis_jobs SET state='running',lease_token=?,lease_until=?,attempts=attempts+1,updated_at=? WHERE meal_id=(SELECT meal_id FROM analysis_jobs WHERE (state='queued' OR (state IN ('running','uploading') AND lease_until<?)) AND attempts<3 ORDER BY created_at LIMIT 1) AND (state='queued' OR (state IN ('running','uploading') AND lease_until<?)) RETURNING *").bind(token, new Date(Date.now() + 90_000).toISOString(), time, time, time).first();
  if (!job) return false;
  const heartbeat = setInterval(() => {
    const time = now();
    db.prepare("UPDATE analysis_jobs SET lease_until=?,updated_at=? WHERE meal_id=? AND lease_token=? AND state='running' AND lease_until>?").bind(new Date(Date.now() + 90_000).toISOString(), time, job.meal_id, token, time).run().catch(() => console.error('Job heartbeat: database unavailable'));
  }, 15_000); heartbeat.unref();
  let meal, aiRequest, modalRequest;
  try {
    meal = await db.prepare('SELECT * FROM meals WHERE id=?').bind(job.meal_id).first();
    if (!meal) return true;
    await logEvent(db,{event:job.kind+'.started',message:job.kind === 'delete' ? 'Elindult a bejegyzés és a fotók törlése.' : 'Elindult a fotók feldolgozása.',userId:meal.user_id,mealId:meal.id});
    let photo = meal.photo ? JSON.parse(meal.photo) : null, context = JSON.parse(meal.analysis_context || '{}');
    if (job.kind === 'delete') {
      if (photo?.url) check(new URL(photo.url).pathname.startsWith(`/${env.CLOUDINARY_CLOUD_NAME}/`), 'A törléshez az eredeti Cloudinary-fiókot kell beállítani.', 503);
      await cloudinary('destroy', meal.public_id, env, null, fetcher, photo?.type || 'upload');
      if (context.additionalView) await cloudinary('destroy', `${meal.public_id}-angle`, env, null, fetcher, photo?.additional?.type || 'upload');
      await db.transaction(async transaction => {
        const ownsLease = await transaction.prepare("UPDATE analysis_jobs SET state='done',updated_at=? WHERE meal_id=? AND lease_token=? AND state='running' RETURNING meal_id").bind(now(), job.meal_id, token).first();
        if (ownsLease) {
          await transaction.prepare('DELETE FROM meals WHERE id=?').bind(meal.id).run();
          await logEvent(transaction,{event:'delete.completed',message:'A bejegyzést és a fotókat töröltük.',userId:meal.user_id,mealId:meal.id});
        }
      });
    } else {
      check(photo, 'A feltöltés nem fejeződött be. Kérlek, válaszd ki újra a képet egy új bejegyzéshez.', 422);
      const additional = photo.additional;
      photo = await securePhoto(photo, env, fetcher);
      if (additional) photo.additional = await securePhoto(additional, env, fetcher);
      const image = await storedPhotoData(photo, fetcher, env), secondImage = photo.additional ? await storedPhotoData(photo.additional, fetcher, env) : null;
      delete photo.pending; if (photo.additional) delete photo.additional.pending;
      await db.prepare("UPDATE meals SET photo=? WHERE id=? AND EXISTS(SELECT 1 FROM analysis_jobs WHERE meal_id=? AND lease_token=? AND state='running')").bind(JSON.stringify(photo), meal.id, meal.id, token).run();
      const effectiveEnv = await runtimeSettings(db, env);
      aiRequest = await db.transaction(async transaction => {
        const time = now();
        const ownsLease = await transaction.prepare("UPDATE analysis_jobs SET lease_until=?,updated_at=? WHERE meal_id=? AND lease_token=? AND state='running' AND lease_until>? RETURNING meal_id").bind(new Date(Date.now() + 90_000).toISOString(), time, meal.id, token, time).first();
        return ownsLease ? startAiRequest(transaction,meal,effectiveEnv.OPENCODE_MODEL) : null;
      });
      if (!aiRequest) return true;
      const result = await analyze(image, meal.notes, effectiveEnv, fetcher, {
        context, secondImage, onResponse: data => recordAiResponse(db,aiRequest,data,effectiveEnv),
        onOpenCodeStart: async metadata => {
          const time = now();
          const ownsLease = await db.prepare("UPDATE analysis_jobs SET lease_until=?,updated_at=? WHERE meal_id=? AND lease_token=? AND state='running' AND lease_until>? RETURNING meal_id").bind(new Date(Date.now()+90_000).toISOString(),time,meal.id,token,time).first();
          check(ownsLease,'A feldolgozás megszakadt; új kérés nem indult.',409);
          await recordAiRequestMeta(db,aiRequest,metadata,effectiveEnv);
        },
        onModalStart: async metadata => {
          modalRequest = await startModalRequest(db,meal,Number(effectiveEnv.MODAL_MONTHLY_BUDGET_USD ?? 15));
          if (!modalRequest) await logEvent(db,{level:'warning',event:'recognition.budget',message:'Az ételfelismerő segéd belső havi kerete nem enged új hívást; az OpenCode-elemzés folytatódik.',userId:meal.user_id,mealId:meal.id});
          if (modalRequest) await recordAiRequestMeta(db,modalRequest,metadata,effectiveEnv);
          return Boolean(modalRequest);
        },
        onModalResponse: async data => {
          await recordAiResponse(db,modalRequest,data,effectiveEnv);
          await db.prepare("UPDATE ai_requests SET state=?,finished_at=? WHERE id=? AND state='running'").bind(data.valid ? 'completed' : 'failed',now(),modalRequest.id).run();
          if (!data.valid) await logEvent(db,{level:'warning',event:'recognition.fallback',message:'Az ételfelismerő segéd nem adott használható választ; az önálló OpenCode-elemzés folytatódik.',userId:meal.user_id,mealId:meal.id});
        },
      });
      await recordAiResult(db,aiRequest,result.analysis,effectiveEnv);
      await db.prepare("UPDATE ai_requests SET state='completed',finished_at=? WHERE id=? AND state='running'").bind(now(),aiRequest.id).run();
      await db.transaction(async transaction => {
        const ownsLease = await transaction.prepare("UPDATE analysis_jobs SET state='done',error=NULL,lease_until=NULL,updated_at=? WHERE meal_id=? AND lease_token=? AND state='running' RETURNING meal_id").bind(now(), job.meal_id, token).first();
        if (!ownsLease) return;
        await transaction.prepare("UPDATE meals SET analysis=?,original_analysis=?,model=?,prompt_version=?,usage=?,latency_ms=?,status='draft',error=NULL,updated_at=? WHERE id=?").bind(JSON.stringify(result.analysis), JSON.stringify(result.analysis), result.model, result.promptVersion, JSON.stringify(result.usage), result.latencyMs, now(), meal.id).run();
        await logEvent(transaction,{event:'analysis.completed',message:'Elkészült az elemzés; az étkezés ellenőrzésre és mentésre vár.',userId:meal.user_id,mealId:meal.id});
      });
    }
  } catch (error) {
    const message = error instanceof AppError ? error.message : 'A feldolgozás megszakadt. A mentett adatok megmaradtak; újra megpróbálhatod.';
    await db.transaction(async transaction => {
      if (aiRequest) await transaction.prepare("UPDATE ai_requests SET state='failed',finished_at=? WHERE id=? AND state='running'").bind(now(),aiRequest.id).run();
      if (modalRequest) await transaction.prepare("UPDATE ai_requests SET state='failed',finished_at=? WHERE id=? AND state='running'").bind(now(),modalRequest.id).run();
      const ownsLease = await transaction.prepare("UPDATE analysis_jobs SET state='failed',error=?,lease_until=NULL,updated_at=? WHERE meal_id=? AND lease_token=? AND state='running' RETURNING meal_id").bind(message, now(), job.meal_id, token).first();
      if (ownsLease) await transaction.prepare("UPDATE meals SET status='failed',error=?,updated_at=? WHERE id=?").bind(error.status >= 500 ? 'A feldolgozás nem sikerült. Az adataid megmaradtak; később újra megpróbálhatod.' : message, now(), job.meal_id).run();
      if (ownsLease) await logEvent(transaction,{level:'error',event:job.kind+'.failed',message,userId:meal?.user_id,mealId:job.meal_id,code:error.status ? String(error.status) : error.code || error.name});
    }).catch(() => console.error('Job result could not be committed; lease recovery will resume it.'));
  } finally { clearInterval(heartbeat); }
  return true;
}
export function startJobRunner(options) {
  let stopped = false, working = false;
  const tick = async () => {
    if (stopped || working) return;
    working = true;
    try { while (!stopped && await processNextJob(options)) { /* Drain durable work without overlapping this runner. */ } }
    catch (error) { console.error('Job runner unavailable:', error.code || error.name); }
    finally { working = false; }
  };
  const timer = setInterval(tick, 2500); timer.unref(); tick();
  return { wake: tick, stop() { stopped = true; clearInterval(timer); }, get working() { return working; } };
}
