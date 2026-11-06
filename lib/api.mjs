import { AppError, check, day, metadata, totals, analysisContext, analysisReport, validateAnalysis, validateImage, validId } from './domain.mjs';
import { analyze, cloudinary, configuration } from './providers.mjs';

export function json(data, status = 200) { return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } }); }
function serialize(row) {
  const analysis = row.analysis ? JSON.parse(row.analysis) : null;
  return { id: row.id, day: row.day, time: row.time, timezone: row.timezone, type: row.type, notes: row.notes, context: row.analysis_context ? JSON.parse(row.analysis_context) : null, status: row.status, analysis, totals: analysis ? totals(analysis.ingredients) : null, report: analysis ? analysisReport(analysis) : null, photo: row.photo ? JSON.parse(row.photo) : null, model: row.model, promptVersion: row.prompt_version, error: row.error, createdAt: row.created_at, updatedAt: row.updated_at, revision: row.revision };
}
export async function readJson(request, maxBytes = 11_400_000) {
  check(request.headers.get('content-type')?.split(';')[0] === 'application/json', 'JSON kérés szükséges.', 415);
  const reader = request.body?.getReader();
  check(reader, 'Hiányzó kérés.');
  const chunks = []; let size = 0;
  for (;;) {
    const { value, done } = await reader.read(); if (done) break;
    size += value.byteLength;
    if (size > maxBytes) { await reader.cancel(); throw new AppError('A kérés túl nagy.', 413); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try {
    const parsed = JSON.parse(new TextDecoder().decode(bytes));
    check(parsed && typeof parsed === 'object' && !Array.isArray(parsed), 'JSON objektum szükséges.');
    return parsed;
  } catch { throw new AppError('Hibás JSON kérés.'); }
}
export async function api(request, { db, env, userId, fetcher = fetch }) {
  try {
    const url = new URL(request.url), path = url.pathname;
    check(userId, 'Jelentkezz be a naplód megnyitásához.', 401);
    if (!['GET', 'HEAD'].includes(request.method)) {
      const origin = request.headers.get('origin');
      check(!origin || origin === url.origin, 'Idegen oldalról érkező kérés.', 403);
      check(request.headers.get('sec-fetch-site') !== 'cross-site', 'Idegen oldalról érkező kérés.', 403);
    }
    if (path === '/api/status' && request.method === 'GET') return json({ ...configuration(env), user: userId === 'local' ? 'Saját naplóm' : 'Személyes naplóm' });
    check(db, 'Az adatbázis nincs csatlakoztatva.', 503);
    if (path === '/api/meals' && request.method === 'GET') {
      const month = url.searchParams.get('month');
      check(/^\d{4}-(0[1-9]|1[0-2])$/.test(month), 'Érvénytelen hónap.');
      day(`${month}-01`);
      const result = await db.prepare("SELECT * FROM meals WHERE user_id=? AND (day LIKE ? OR status!='saved') ORDER BY day DESC,time DESC").bind(userId, `${month}-%`).all();
      return json({ meals: result.results.map(serialize) });
    }
    if (path === '/api/analyze' && request.method === 'POST') {
      const input = await readJson(request), id = validId(input.id), meta = metadata(input);
      validateImage(input.image);
      if (input.secondImage != null) validateImage(input.secondImage);
      const context = { ...analysisContext(input.context), additionalView: Boolean(input.secondImage) };
      const config = configuration(env);
      check(config.ai && config.photos, 'Az elemzéshez állítsd be az OpenCode- és Cloudinary-kapcsolatot.', 503);
      const existing = await db.prepare('SELECT * FROM meals WHERE id=? AND user_id=?').bind(id, userId).first();
      if (existing) return json({ meal: serialize(existing) }, 200);
      const now = new Date().toISOString();
      const limit = await db.prepare("INSERT INTO analysis_attempts(id,user_id,created_at) SELECT ?,?,? WHERE (SELECT COUNT(*) FROM analysis_attempts WHERE user_id=? AND created_at>?)<20 AND (SELECT COUNT(*) FROM analysis_attempts WHERE user_id=? AND created_at>?)<50 ON CONFLICT(id) DO NOTHING").bind(id, userId, now, userId, new Date(Date.now() - 3600_000).toISOString(), userId, new Date(Date.now() - 86400_000).toISOString()).run();
      check(limit.meta.changes === 1, 'Az elemzés már folyamatban van, vagy elérted a 20/óra, 50/nap korlátot. Frissítsd a naplót.', 429);
      const publicId = `yumetrics/${id}`;
      await db.prepare('INSERT INTO meals(id,user_id,day,time,type,notes,timezone,analysis_context,public_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind(id, userId, meta.day, meta.time, meta.type, meta.notes, meta.timezone, JSON.stringify(context), publicId, now, now).run();
      try {
        const result = await analyze(input.image, meta.notes, env, fetcher, { context, secondImage: input.secondImage });
        await db.prepare('UPDATE meals SET analysis=?,original_analysis=?,model=?,prompt_version=?,usage=?,latency_ms=?,updated_at=? WHERE id=? AND user_id=?').bind(JSON.stringify(result.analysis), JSON.stringify(result.analysis), result.model, result.promptVersion, JSON.stringify(result.usage), result.latencyMs, new Date().toISOString(), id, userId).run();
        const photo = await cloudinary('upload', publicId, env, input.image, fetcher);
        if (input.secondImage) photo.additional = await cloudinary('upload', `${publicId}-angle`, env, input.secondImage, fetcher);
        await db.prepare("UPDATE meals SET photo=?,status='draft',updated_at=? WHERE id=? AND user_id=?").bind(JSON.stringify(photo), new Date().toISOString(), id, userId).run();
      } catch (error) {
        await db.prepare("UPDATE meals SET status='failed',error=?,updated_at=? WHERE id=? AND user_id=?").bind(error instanceof AppError ? error.message : 'Az elemzés megszakadt. A bejegyzés törölhető.', new Date().toISOString(), id, userId).run();
        throw error;
      }
      return json({ meal: serialize(await db.prepare('SELECT * FROM meals WHERE id=? AND user_id=?').bind(id, userId).first()) }, 201);
    }
    const match = /^\/api\/meals\/([^/]+)$/.exec(path);
    if (match) {
      const id = validId(match[1]);
      const row = await db.prepare('SELECT * FROM meals WHERE id=? AND user_id=?').bind(id, userId).first();
      check(row, 'A bejegyzés nem található.', 404);
      if (request.method === 'GET') return json({ meal: serialize(row) });
      if (request.method === 'PATCH') {
        const input = await readJson(request), meta = metadata(input), analysis = validateAnalysis(input.analysis);
        check(['draft', 'saved'].includes(row.status) && row.photo, 'Ez az elemzés még nem menthető. Töröld, és próbáld újra.', 409);
        check(Number.isInteger(input.revision) && input.revision === row.revision, 'A bejegyzés egy másik ablakban megváltozott. Töltsd be újra.', 409);
        const update = await db.prepare("UPDATE meals SET day=?,time=?,type=?,notes=?,timezone=?,analysis=?,status='saved',updated_at=?,revision=revision+1 WHERE id=? AND user_id=? AND revision=? AND status IN ('draft','saved')").bind(meta.day, meta.time, meta.type, meta.notes, meta.timezone, JSON.stringify(analysis), new Date().toISOString(), id, userId, input.revision).run();
        check(update.meta.changes === 1, 'A bejegyzés időközben megváltozott. Töltsd be újra.', 409);
        return json({ meal: serialize(await db.prepare('SELECT * FROM meals WHERE id=? AND user_id=?').bind(id, userId).first()) });
      }
      if (request.method === 'DELETE') {
        const recent = Date.now() - Date.parse(row.updated_at) < 300_000;
        check(!(row.status === 'analyzing' && recent), 'Az elemzés még fut. Várj legfeljebb öt percet a törléssel.', 409);
        // Delete the remote asset first: on failure the row remains available for retry.
        await cloudinary('destroy', row.public_id, env, null, fetcher);
        if (row.analysis_context && JSON.parse(row.analysis_context).additionalView) await cloudinary('destroy', `${row.public_id}-angle`, env, null, fetcher);
        await db.prepare('DELETE FROM meals WHERE id=? AND user_id=?').bind(id, userId).run();
        return json({ deleted: true });
      }
    }
    throw new AppError('Ismeretlen végpont vagy művelet.', 404);
  } catch (error) {
    if (!(error instanceof AppError)) console.error('API operation failed:', error?.name || 'Error');
    return json({ error: error instanceof AppError ? error.message : 'Váratlan szerverhiba. A mentett naplóbejegyzéseid megmaradtak.' }, error instanceof AppError ? error.status : 500);
  }
}
