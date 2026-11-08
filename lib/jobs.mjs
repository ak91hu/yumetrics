import { randomUUID } from 'node:crypto';
import { analyze, cloudinary } from './providers.mjs';
import { AppError, check, validateImage } from './domain.mjs';

const now = () => new Date().toISOString();
export async function storedPhotoData(photo, fetcher = fetch) {
  const url = new URL(photo.url);
  check(url.protocol === 'https:' && url.hostname === 'res.cloudinary.com' && url.pathname.includes('/image/upload/'), 'A tárolt képhivatkozás nem megfelelő.', 502);
  let response;
  try { response = await fetcher(url.href, { redirect: 'error', signal: AbortSignal.timeout(25_000) }); }
  catch { throw new AppError('A tartósan tárolt képet most nem lehet betölteni. Később újrapróbálhatod.', 502); }
  check(response.ok, 'A fotófeltöltés nem fejeződött be vagy a kép nem érhető el. Válaszd ki újra a fotót egy új bejegyzéshez.', 502);
  const reader = response.body.getReader(), chunks = []; let size = 0;
  for (;;) { const part = await reader.read(); if (part.done) break; size += part.value.length; if (size > 4_200_000) { await reader.cancel(); throw new AppError('A tárolt kép túl nagy.', 413); } chunks.push(Buffer.from(part.value)); }
  const mime = response.headers.get('content-type')?.split(';')[0], data = `data:${mime};base64,${Buffer.concat(chunks).toString('base64')}`;
  validateImage(data); return data;
}
export async function processNextJob({ db, env, fetcher = fetch }) {
  const time = now(), token = randomUUID();
  // A crashed worker may already have sent its AI request; require an explicit retry.
  await db.transaction(async transaction => {
    const interrupted = await transaction.prepare("UPDATE analysis_jobs SET state='failed',error=?,lease_token=NULL,lease_until=NULL,updated_at=? WHERE kind='analyze' AND state='running' AND lease_until<? RETURNING meal_id").bind('Az elemzés megszakadt. Új AI-kérés csak kézi újrapróbáláskor indul.', time, time).all();
    for (const row of interrupted.results) await transaction.prepare("UPDATE meals SET status='failed',error=?,updated_at=? WHERE id=?").bind('Az elemzés megszakadt. Új AI-kérés csak kézi újrapróbáláskor indul.', time, row.meal_id).run();
  });
  const exhausted = await db.prepare("UPDATE analysis_jobs SET state='failed',error=?,updated_at=? WHERE state IN ('running','uploading') AND lease_until<? AND attempts>=3 RETURNING meal_id").bind('Az elemzés ismételten megszakadt. A tárolt képekből újrapróbálható.', time, time).all();
  for (const row of exhausted.results) await db.prepare("UPDATE meals SET status='failed',error=? WHERE id=?").bind('Az elemzés megszakadt. A tárolt képek és az adatok megmaradtak.', row.meal_id).run();
  const job = await db.prepare("UPDATE analysis_jobs SET state='running',lease_token=?,lease_until=?,attempts=attempts+1,updated_at=? WHERE meal_id=(SELECT meal_id FROM analysis_jobs WHERE (state='queued' OR (state IN ('running','uploading') AND lease_until<?)) AND attempts<3 ORDER BY created_at LIMIT 1) AND (state='queued' OR (state IN ('running','uploading') AND lease_until<?)) RETURNING *").bind(token, new Date(Date.now() + 90_000).toISOString(), time, time, time).first();
  if (!job) return false;
  const heartbeat = setInterval(() => {
    db.prepare("UPDATE analysis_jobs SET lease_until=?,updated_at=? WHERE meal_id=? AND lease_token=? AND state='running'").bind(new Date(Date.now() + 90_000).toISOString(), now(), job.meal_id, token).run().catch(() => console.error('Job heartbeat: database unavailable'));
  }, 15_000); heartbeat.unref();
  try {
    const meal = await db.prepare('SELECT * FROM meals WHERE id=?').bind(job.meal_id).first();
    if (!meal) return true;
    const photo = meal.photo ? JSON.parse(meal.photo) : null, context = JSON.parse(meal.analysis_context || '{}');
    if (job.kind === 'delete') {
      if (photo?.url) check(new URL(photo.url).pathname.startsWith(`/${env.CLOUDINARY_CLOUD_NAME}/`), 'A törléshez az eredeti Cloudinary-fiókot kell beállítani.', 503);
      await cloudinary('destroy', meal.public_id, env, null, fetcher);
      if (context.additionalView) await cloudinary('destroy', `${meal.public_id}-angle`, env, null, fetcher);
      await db.transaction(async transaction => {
        const ownsLease = await transaction.prepare("UPDATE analysis_jobs SET state='done',updated_at=? WHERE meal_id=? AND lease_token=? AND state='running' RETURNING meal_id").bind(now(), job.meal_id, token).first();
        if (ownsLease) await transaction.prepare('DELETE FROM meals WHERE id=?').bind(meal.id).run();
      });
    } else {
      check(photo, 'A feltöltés nem fejeződött be. Kérlek, válaszd ki újra a képet egy új bejegyzéshez.', 422);
      const image = await storedPhotoData(photo, fetcher), secondImage = photo.additional ? await storedPhotoData(photo.additional, fetcher) : null;
      delete photo.pending; if (photo.additional) delete photo.additional.pending;
      await db.prepare("UPDATE meals SET photo=? WHERE id=? AND EXISTS(SELECT 1 FROM analysis_jobs WHERE meal_id=? AND lease_token=? AND state='running')").bind(JSON.stringify(photo), meal.id, meal.id, token).run();
      const result = await analyze(image, meal.notes, env, fetcher, { context, secondImage });
      await db.transaction(async transaction => {
        const ownsLease = await transaction.prepare("UPDATE analysis_jobs SET state='done',error=NULL,lease_until=NULL,updated_at=? WHERE meal_id=? AND lease_token=? AND state='running' RETURNING meal_id").bind(now(), job.meal_id, token).first();
        if (!ownsLease) return;
        await transaction.prepare("UPDATE meals SET analysis=?,original_analysis=?,model=?,prompt_version=?,usage=?,latency_ms=?,status='draft',error=NULL,updated_at=? WHERE id=?").bind(JSON.stringify(result.analysis), JSON.stringify(result.analysis), result.model, result.promptVersion, JSON.stringify(result.usage), result.latencyMs, now(), meal.id).run();
      });
    }
  } catch (error) {
    const message = error instanceof AppError ? error.message : 'A feldolgozás megszakadt. A már tárolt adatokat megőriztük; újrapróbálhatod.';
    await db.transaction(async transaction => {
      const ownsLease = await transaction.prepare("UPDATE analysis_jobs SET state='failed',error=?,lease_until=NULL,updated_at=? WHERE meal_id=? AND lease_token=? AND state='running' RETURNING meal_id").bind(message, now(), job.meal_id, token).first();
      if (ownsLease) await transaction.prepare("UPDATE meals SET status='failed',error=?,updated_at=? WHERE id=?").bind(message, now(), job.meal_id).run();
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
