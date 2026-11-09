import { createHash, randomUUID } from 'node:crypto';
import { AppError, check, day, metadata, totals, analysisContext, analysisReport, validateAnalysis, validateImagePair, validId } from './domain.mjs';
import { cloudinary, configuration } from './providers.mjs';
import { searchFoods, fetchFood, analysisReferences } from './food-data.mjs';
import { userProfile } from './profile-stats.mjs';
import { weeklyChallenges, refreshWeeklyChallenge } from './weekly-challenges.mjs';
import { originalLabels } from './product-label.mjs';
import { adminApi } from './admin.mjs';
import { isAdmin, runtimeSettings } from './settings.mjs';
import { logEvent } from './telemetry.mjs';
import { photoLinks, storedPhotoData } from './photos.mjs';
import { requestLimit } from './request-limits.mjs';

export function json(data, status = 200) { return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } }); }
const SELECT_MEAL = 'SELECT m.*,j.state AS job_state,j.kind AS job_kind FROM meals m LEFT JOIN analysis_jobs j ON j.meal_id=m.id';
function serialize(row) {
  const analysis = row.analysis ? JSON.parse(row.analysis) : null;
  const error = /OpenCode|Cloudinary|USDA|API-kulcs|AI-szolgáltat/i.test(row.error || '') ? 'A feldolgozás nem sikerült. Az adataid megmaradtak; később újra megpróbálhatod.' : row.error;
  return { id: row.id, day: row.day, time: row.time, timezone: row.timezone, type: row.type, notes: row.notes, context: row.analysis_context ? JSON.parse(row.analysis_context) : null, status: row.status, job: row.job_state ? { state: row.job_state, kind: row.job_kind } : null, analysis, totals: analysis ? totals(analysis.ingredients) : null, report: analysis ? analysisReport(analysis) : null, photo: row.photo ? photoLinks(JSON.parse(row.photo), row.id) : null, model: row.model, promptVersion: row.prompt_version, error, createdAt: row.created_at, updatedAt: row.updated_at, revision: row.revision };
}
export async function readJson(request, maxBytes = 11_400_000) {
  check(request.headers.get('content-type')?.split(';')[0] === 'application/json', 'A kérés adatait JSON-formátumban küldd el.', 415);
  const reader = request.body?.getReader(); check(reader, 'Hiányzó kérés.');
  const chunks = []; let size = 0;
  for (;;) { const { value, done } = await reader.read(); if (done) break; size += value.byteLength; if (size > maxBytes) { await reader.cancel(); throw new AppError('A kérés túl nagy.', 413); } chunks.push(value); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try { const value = JSON.parse(new TextDecoder().decode(bytes)); check(value && typeof value === 'object' && !Array.isArray(value), 'Az adatok formátuma hibás.'); return value; }
  catch { throw new AppError('A kérés adatait nem sikerült beolvasni.'); }
}
async function consumeAttempt(db, userId, id, env) {
  if (db.dialect === 'postgres') await db.prepare('SELECT id FROM users WHERE id=? FOR UPDATE').bind(userId).first();
  const time = new Date().toISOString();
  const result = await db.prepare('INSERT INTO analysis_attempts(id,user_id,created_at) SELECT ?,?,? WHERE (SELECT COUNT(*) FROM analysis_attempts WHERE user_id=? AND created_at>?)<? AND (SELECT COUNT(*) FROM analysis_attempts WHERE user_id=? AND created_at>?)<? ON CONFLICT(id) DO NOTHING').bind(id, userId, time, userId, new Date(Date.now() - 3600_000).toISOString(), env.hourlyLimit, userId, new Date(Date.now() - 86400_000).toISOString(), env.dailyLimit).run();
  check(result.meta.changes === 1, 'Az elemzés már folyamatban van, vagy elérted az elemzési korlátot. Próbáld később.', 429);
}
export async function api(request, { db, env, userId, user, fetcher = fetch, wake = () => {} }) {
  try {
    const url = new URL(request.url), path = url.pathname;
    check(userId, 'A napló használatához jelentkezz be a Google-fiókoddal.', 401);
    check(db, 'Az adatbázis nincs csatlakoztatva.', 503);
    await requestLimit(db, 'api', userId, 600, 60);
    if (!['GET', 'HEAD'].includes(request.method)) {
      check(!request.headers.get('origin') || request.headers.get('origin') === url.origin, 'Idegen oldalról érkező kérés.', 403);
      check(request.headers.get('sec-fetch-site') !== 'cross-site', 'Idegen oldalról érkező kérés.', 403);
    }
    if (path === '/api/admin' || path.startsWith('/api/admin/')) return await adminApi(request, { db, env, userId });
    const getMeal = id => db.prepare(`${SELECT_MEAL} WHERE m.id=? AND m.user_id=?`).bind(id, userId).first();
    const photoMatch = /^\/api\/meals\/([^/]+)\/photo\/(primary|additional)$/.exec(path);
    if (photoMatch && request.method === 'GET') {
      const row = await db.prepare('SELECT photo,user_id FROM meals WHERE id=?').bind(validId(photoMatch[1])).first();
      check(row && (row.user_id === userId || isAdmin(user)), 'A kép nem található.', 404);
      const photos = row.photo ? JSON.parse(row.photo) : null, photo = photoMatch[2] === 'primary' ? photos : photos?.additional;
      check(photo?.url, 'A kép nem található.', 404);
      const data = await storedPhotoData(photo, fetcher, env), comma = data.indexOf(',');
      return new Response(Buffer.from(data.slice(comma + 1), 'base64'), { headers: { 'Content-Type': data.slice(5, data.indexOf(';')), 'Cache-Control': 'private, no-store', 'Cross-Origin-Resource-Policy': 'same-origin' } });
    }
    if (path.startsWith('/api/foods/') && request.method === 'GET') await requestLimit(db, 'foods', userId, 30, 60);
    if (path === '/api/foods/search' && request.method === 'GET') return json({ foods: await searchFoods(url.searchParams.get('q'), env, fetcher) });
    const foodMatch = /^\/api\/foods\/(\d{1,9})$/.exec(path);
    if (foodMatch && request.method === 'GET') return json(await fetchFood(foodMatch[1], db, env, fetcher));
    if (path === '/api/status' && request.method === 'GET') return json({ user: user ? { name: user.name, email: user.email, avatarUrl: user.avatar_url, calorieGoal: user.calorie_goal, admin: isAdmin(user) } : null });
    if (path === '/api/profile' && request.method === 'GET') return json({ ...await userProfile(db, userId, url.searchParams.get('timezone') || 'Europe/Budapest'),weeklyChallenge:await weeklyChallenges(db,userId) });
    if (path === '/api/weekly-challenge' && request.method === 'POST') return json(await weeklyChallenges(db,userId,await readJson(request,4096)));
    if (path === '/api/profile' && request.method === 'PATCH') {
      const input = await readJson(request, 4096);
      check(Number.isInteger(input.calorieGoal) && input.calorieGoal >= 500 && input.calorieGoal <= 10000, 'A napi energiakeretet 500 és 10 000 kcal közötti egész számmal add meg.');
      await db.prepare('UPDATE users SET calorie_goal=?,updated_at=? WHERE id=?').bind(input.calorieGoal, new Date().toISOString(), userId).run();
      return json({ calorieGoal: input.calorieGoal });
    }
    if (path === '/api/meals' && request.method === 'GET') {
      const month = url.searchParams.get('month'); check(/^\d{4}-(0[1-9]|1[0-2])$/.test(month), 'Érvénytelen hónap.'); day(`${month}-01`);
      const rows = await db.prepare(`${SELECT_MEAL} WHERE m.user_id=? AND (m.day LIKE ? OR m.status!='saved' OR j.kind='delete') ORDER BY m.day DESC,m.time DESC`).bind(userId, `${month}-%`).all();
      return json({ meals: rows.results.map(serialize) });
    }
    if (path === '/api/analyze' && request.method === 'POST') {
      await requestLimit(db, 'uploads', userId, 12, 60);
      const input = await readJson(request), id = validId(input.id), meta = metadata(input);
      validateImagePair(input.image, input.secondImage);
      env = await runtimeSettings(db, env);
      if (!env.analysesEnabled) return json({ error: 'Az új elemzések átmenetileg szünetelnek. A naplód továbbra is elérhető.' }, 503);
      check(configuration(env).ai && configuration(env).photos, 'Az OpenCode- és Cloudinary-kapcsolat még nincs beállítva.', 503);
      check(/^[a-zA-Z0-9_-]+$/.test(env.CLOUDINARY_CLOUD_NAME), 'Hibás Cloudinary-beállítás.', 503);
      const context = { ...analysisContext(input.context), additionalView: Boolean(input.secondImage) };
      const hash = createHash('sha256').update(JSON.stringify([meta, context, input.image, input.secondImage || null])).digest('hex');
      const existing = await getMeal(id);
      if (existing) {
        const job = await db.prepare('SELECT input_hash FROM analysis_jobs WHERE meal_id=?').bind(id).first();
        check(job?.input_hash === hash, 'Ezzel az azonosítóval másik feltöltés indult. Új fotóhoz indíts új bejegyzést.', 409);
        return json({ meal: serialize(existing) }, existing.status === 'saved' || existing.status === 'draft' ? 200 : 202);
      }
      const token = randomUUID(), time = new Date().toISOString(), publicId = `yumetrics/${id}`;
      const expected = suffix => ({ publicId: publicId + suffix, type: 'authenticated', url: `https://res.cloudinary.com/${env.CLOUDINARY_CLOUD_NAME}/image/authenticated/${publicId}${suffix}.jpg`, pending: true });
      let photo = { ...expected(''), ...(input.secondImage ? { additional: expected('-angle') } : {}) };
      await db.transaction(async transaction => {
        await consumeAttempt(transaction, userId, id, env);
        await transaction.prepare('INSERT INTO meals(id,user_id,day,time,type,notes,timezone,analysis_context,public_id,photo,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').bind(id, userId, meta.day, meta.time, meta.type, meta.notes, meta.timezone, JSON.stringify(context), publicId, JSON.stringify(photo), time, time).run();
        await transaction.prepare("INSERT INTO analysis_jobs(meal_id,input_hash,state,lease_token,lease_until,created_at,updated_at) VALUES(?,?,'uploading',?,?,?,?)").bind(id, hash, token, new Date(Date.now() + 90_000).toISOString(), time, time).run();
      });
      try {
        const primary = await cloudinary('upload', publicId, env, input.image, fetcher);
        photo = { ...primary, ...(photo.additional ? { additional: photo.additional } : {}) };
        await db.prepare('UPDATE meals SET photo=?,updated_at=? WHERE id=? AND user_id=?').bind(JSON.stringify(photo), new Date().toISOString(), id, userId).run();
        if (input.secondImage) photo.additional = await cloudinary('upload', `${publicId}-angle`, env, input.secondImage, fetcher);
        await db.transaction(async transaction => {
          await transaction.prepare('UPDATE meals SET photo=?,updated_at=? WHERE id=? AND user_id=?').bind(JSON.stringify(photo), new Date().toISOString(), id, userId).run();
          await transaction.prepare("UPDATE analysis_jobs SET state='queued',lease_until=NULL,lease_token=NULL,updated_at=? WHERE meal_id=? AND state='uploading' AND lease_token=?").bind(new Date().toISOString(), id, token).run();
        });
      } catch (error) {
        await db.transaction(async transaction => {
          const claimed = await transaction.prepare("UPDATE analysis_jobs SET state='failed',error=?,updated_at=? WHERE meal_id=? AND lease_token=? AND state='uploading' RETURNING meal_id").bind('A fotófeltöltés nem fejeződött be. A már feltöltött részeket megőriztük.', new Date().toISOString(), id, token).first();
          if (claimed) await transaction.prepare("UPDATE meals SET status='failed',error=?,updated_at=? WHERE id=?").bind('A fotófeltöltés nem fejeződött be. A már feltöltött részeket megőriztük.', new Date().toISOString(), id).run();
        });
        throw error;
      }
      wake(); return json({ meal: serialize(await getMeal(id)) }, 202);
    }
    const match = /^\/api\/meals\/([^/]+)(\/retry)?$/.exec(path);
    if (match) {
      const id = validId(match[1]), row = await getMeal(id); check(row, 'A bejegyzés nem található.', 404);
      if (match[2] && request.method === 'POST') {
        env = await runtimeSettings(db, env);
        if (!env.analysesEnabled) return json({ error: 'Az új elemzések átmenetileg szünetelnek. A naplód továbbra is elérhető.' }, 503);
        check(row.job_kind === 'analyze' && row.job_state === 'failed', 'Csak sikertelen elemzés indítható újra.', 409);
        check(row.photo && JSON.parse(row.photo).additional, 'Ehhez a régi elemzéshez csak egy fotó tartozik. Indíts új bejegyzést két, eltérő szögből készült képpel.', 422);
        await db.transaction(async transaction => {
          await consumeAttempt(transaction, userId, randomUUID(), env);
          const updated = await transaction.prepare("UPDATE analysis_jobs SET state='queued',attempts=0,error=NULL,lease_token=NULL,lease_until=NULL,updated_at=? WHERE meal_id=? AND state='failed' AND kind='analyze'").bind(new Date().toISOString(), id).run();
          check(updated.meta.changes === 1, 'A bejegyzés állapota közben megváltozott. Nyisd meg újra.', 409);
          await transaction.prepare("UPDATE meals SET status='analyzing',error=NULL,updated_at=? WHERE id=?").bind(new Date().toISOString(), id).run();
        }); wake(); return json({ meal: serialize(await getMeal(id)) }, 202);
      }
      if (!match[2] && request.method === 'GET') return json({ meal: serialize(row) });
      if (!match[2] && request.method === 'PATCH') {
        const input = await readJson(request), meta = metadata(input), analysis = validateAnalysis(input.analysis, await analysisReferences(input.analysis, db), originalLabels(row.original_analysis ? JSON.parse(row.original_analysis) : row.analysis ? JSON.parse(row.analysis) : null));
        if (row.analysis && JSON.parse(row.analysis).portionScope === 'full_image') analysis.portionScope = 'full_image';
        check(['draft', 'saved'].includes(row.status) && row.photo && row.job_kind !== 'delete', 'Ez a bejegyzés még feldolgozás alatt áll, vagy a törlése már elindult. Egyelőre nem menthető.', 409);
        check(Number.isInteger(input.revision) && input.revision === row.revision, 'A bejegyzés másik ablakban megváltozott. Töltsd be újra.', 409);
        await db.transaction(async transaction=>{
          if(db.dialect==='postgres')await transaction.prepare('SELECT id FROM users WHERE id=? FOR UPDATE').bind(userId).first();
          const now=new Date();
          const changed = await transaction.prepare("UPDATE meals SET day=?,time=?,type=?,notes=?,timezone=?,analysis=?,status='saved',updated_at=?,revision=revision+1 WHERE id=? AND user_id=? AND revision=? AND status IN ('draft','saved') AND NOT EXISTS(SELECT 1 FROM analysis_jobs WHERE meal_id=? AND kind='delete')").bind(meta.day, meta.time, meta.type, meta.notes, meta.timezone, JSON.stringify(analysis), now.toISOString(), id, userId, input.revision, id).run();
          check(changed.meta.changes === 1, 'A bejegyzés közben megváltozott.', 409);
          await refreshWeeklyChallenge(transaction,userId,now,{day:meta.day,analysis});
        });
        return json({ meal: serialize(await getMeal(id)) });
      }
      if (!match[2] && request.method === 'DELETE') {
        await db.transaction(async transaction => {
          const job = await transaction.prepare('SELECT * FROM analysis_jobs WHERE meal_id=?').bind(id).first();
          if (job) {
            const changed = await transaction.prepare("UPDATE analysis_jobs SET kind='delete',state='queued',attempts=0,error=NULL,lease_token=NULL,lease_until=NULL,updated_at=? WHERE meal_id=? AND (state NOT IN ('running','uploading') OR lease_until<?)").bind(new Date().toISOString(), id, new Date().toISOString()).run();
            check(changed.meta.changes === 1, 'A feldolgozás még fut. Próbáld később a törlést.', 409);
          } else await transaction.prepare("INSERT INTO analysis_jobs(meal_id,kind,state,input_hash,created_at,updated_at) VALUES(?,'delete','queued','',?,?)").bind(id, new Date().toISOString(), new Date().toISOString()).run();
        }); wake(); return json({ deleting: true }, 202);
      }
    }
    throw new AppError('Ez a művelet vagy elérési út nem található.', 404);
  } catch (error) {
    if (!(error instanceof AppError)) console.error('API operation failed:', error.code || error.name);
    if (db && (!error.status || error.status >= 500)) await logEvent(db,{level:'error',category:'request',event:'request.failed',message:error instanceof AppError ? error.message : 'Az alkalmazás nem tudta teljesíteni a kérést.',userId,code:String(error.status || error.code || error.name)}).catch(()=>console.error('Operational log could not be saved'));
    const privateFailure = !new URL(request.url).pathname.startsWith('/api/admin') && error.status >= 500;
    const response = json({ error: error instanceof AppError && !privateFailure ? error.message : 'A műveletet most nem sikerült befejezni. A korábban mentett adatok megmaradtak.' }, error instanceof AppError ? error.status : 500);
    if (error.retryAfter) response.headers.set('Retry-After', String(error.retryAfter));
    return response;
  }
}
