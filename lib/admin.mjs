import { randomUUID } from 'node:crypto';
import { check, totals, validId } from './domain.mjs';
import { json, readJson } from './api.mjs';
import { appSettings, isAdmin, validateSettings } from './settings.mjs';
import { configuration } from './providers.mjs';

const timestamp = () => new Date().toISOString();
async function audit(db, actor, action, target, details) {
  await db.prepare('INSERT INTO admin_audit(id,actor_id,action,target,details,created_at) VALUES(?,?,?,?,?,?)').bind(randomUUID(), actor, action, target, JSON.stringify(details), timestamp()).run();
}
function pagination(url) {
  const page = Number(url.searchParams.get('page') || 1);
  check(Number.isInteger(page) && page >= 1 && page <= 100000, 'Hibás oldalszám.');
  return { page, offset: (page - 1) * 25 };
}
async function list(db, sql, args, countSql, url) {
  const { page, offset } = pagination(url);
  const { results } = await db.prepare(sql + ' LIMIT 25 OFFSET ?').bind(...args, offset).all();
  const total = Number((await db.prepare(countSql).bind(...args).first()).total);
  return json({ items: results, total, page, pageSize: 25 });
}
export async function adminApi(request, { db, env, userId }) {
  const actor = await db.prepare('SELECT id,email,blocked FROM users WHERE id=?').bind(userId).first();
  check(isAdmin(actor) && !actor.blocked, 'Ehhez a felülethez nincs hozzáférésed.', 403);
  const url = new URL(request.url), path = url.pathname.replace('/api/admin', '');
  if (path === '/settings' && request.method === 'GET') return json({ ...await appSettings(db, env), services: configuration(env), google: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET), database: db.dialect, origin: env.APP_ORIGIN, redirectUri: env.GOOGLE_REDIRECT_URI || `${env.APP_ORIGIN}/auth/google/callback` });
  if (path === '/settings' && request.method === 'PATCH') {
    const input = await readJson(request, 8192), settings = validateSettings(input.settings);
    check(Number.isInteger(input.revision) && input.revision >= 0, 'Hiányzó beállításverzió.');
    await db.transaction(async transaction => {
      const before = await appSettings(transaction, env);
      const result = await transaction.prepare('UPDATE app_settings SET value=?,revision=revision+1 WHERE id=1 AND revision=?').bind(JSON.stringify(settings), input.revision).run();
      check(result.meta.changes === 1, 'A beállítások közben megváltoztak. Frissítsd az oldalt.', 409);
      await audit(transaction, userId, 'settings.update', 'application', { before: before.settings, after: settings });
    });
    return json(await appSettings(db, env));
  }
  if (path === '/overview' && request.method === 'GET') {
    const days = Number(url.searchParams.get('days') || 30);
    check([7,30,365].includes(days), 'Hibás időszak.');
    const today = timestamp().slice(0,10), start = new Date(Date.parse(today + 'T00:00:00Z') - (days-1)*86400000).toISOString();
    const tokenSum = key => db.dialect === 'postgres'
      ? `(SELECT SUM(COALESCE((p->>'${key}')::bigint,0)) FROM jsonb_array_elements(COALESCE(CAST(m.usage AS jsonb)->'passes','[]'::jsonb)) p)`
      : `(SELECT SUM(COALESCE(json_extract(p.value,'$.${key}'),0)) FROM json_each(m.usage,'$.passes') p)`;
    const counts = await db.prepare("SELECT (SELECT COUNT(*) FROM users) AS users,(SELECT COUNT(*) FROM users WHERE blocked=1) AS blocked_users,(SELECT COUNT(*) FROM sessions WHERE expires_at>?) AS sessions,(SELECT COUNT(*) FROM meals) AS meals,(SELECT COUNT(*) FROM meals WHERE status='saved') AS saved_meals,(SELECT COUNT(*) FROM food_records) AS cached_foods").bind(timestamp()).first();
    const activity = await db.prepare('SELECT COUNT(*) AS meals,COUNT(DISTINCT user_id) AS active_users,AVG(latency_ms) AS average_latency_ms,SUM(CASE WHEN usage IS NOT NULL THEN 1 ELSE 0 END) AS usage_records FROM meals WHERE created_at>=?').bind(start).first();
    const tokens = await db.prepare(`SELECT COALESCE(SUM(${tokenSum('promptTokenCount')}),0) AS input_tokens,COALESCE(SUM(${tokenSum('candidatesTokenCount')}),0) AS output_tokens,COALESCE(SUM(${tokenSum('cachedContentTokenCount')}),0) AS cached_tokens,COALESCE(SUM(${tokenSum('thoughtsTokenCount')}),0) AS thought_tokens FROM meals m WHERE created_at>=?`).bind(start).first();
    const groups = async (sql, ...args) => (await db.prepare(sql).bind(...args).all()).results;
    return json({ days, start, today, generatedAt: timestamp(), counts, activity, tokens,
      attempts: Number((await db.prepare('SELECT COUNT(*) AS total FROM analysis_attempts WHERE created_at>=?').bind(start).first()).total),
      newUsers: Number((await db.prepare('SELECT COUNT(*) AS total FROM users WHERE created_at>=?').bind(start).first()).total),
      daily: await groups('SELECT SUBSTR(created_at,1,10) AS day,COUNT(*) AS meals,COUNT(DISTINCT user_id) AS users FROM meals WHERE created_at>=? GROUP BY SUBSTR(created_at,1,10) ORDER BY day', start),
      registrations: await groups('SELECT SUBSTR(created_at,1,10) AS day,COUNT(*) AS users FROM users WHERE created_at>=? GROUP BY SUBSTR(created_at,1,10) ORDER BY day', start),
      statuses: await groups('SELECT status,COUNT(*) AS count FROM meals WHERE created_at>=? GROUP BY status', start),
      types: await groups("SELECT type,COUNT(*) AS count FROM meals WHERE status='saved' AND created_at>=? GROUP BY type", start),
      models: await groups('SELECT model,prompt_version,COUNT(*) AS count,AVG(latency_ms) AS average_latency_ms FROM meals WHERE model IS NOT NULL AND created_at>=? GROUP BY model,prompt_version', start),
      jobs: await groups('SELECT kind,state,COUNT(*) AS count FROM analysis_jobs GROUP BY kind,state'),
    });
  }
  if (path === '/users' && request.method === 'GET') {
    const q = url.searchParams.get('q') || ''; check(q.length <= 200, 'Túl hosszú keresés.');
    const args = [`%${q.toLowerCase()}%`, `%${q.toLowerCase()}%`], where = ' WHERE LOWER(u.email) LIKE ? OR LOWER(u.name) LIKE ?';
    return list(db, `SELECT u.id,u.name,u.email,u.calorie_goal,u.blocked,u.created_at,(SELECT COUNT(*) FROM meals m WHERE m.user_id=u.id) AS meals,(SELECT COUNT(*) FROM sessions s WHERE s.user_id=u.id AND s.expires_at>'${timestamp()}') AS sessions FROM users u${where} ORDER BY u.created_at DESC,u.id`, args, 'SELECT COUNT(*) AS total FROM users u' + where, url);
  }
  const userMatch = /^\/users\/([^/]+)(\/revoke-sessions)?$/.exec(path);
  if (userMatch && ['PATCH','POST'].includes(request.method)) {
    const id = validId(userMatch[1]);
    const target = await db.prepare('SELECT id,email,calorie_goal,blocked FROM users WHERE id=?').bind(id).first();
    check(target, 'A felhasználó nem található.', 404);
    check(!isAdmin(target), 'Az adminisztrátori fiók itt nem módosítható.', 403);
    if (userMatch[2] && request.method === 'POST') {
      await db.transaction(async transaction => {
        await transaction.prepare('DELETE FROM sessions WHERE user_id=?').bind(id).run();
        await audit(transaction,userId,'sessions.revoke',id,{});
      });
      return json({ ok: true });
    }
    if (!userMatch[2] && request.method === 'PATCH') {
      const input = await readJson(request,4096);
      check(Object.keys(input).every(key => ['blocked','calorieGoal'].includes(key)) && typeof input.blocked === 'boolean' && Number.isInteger(input.calorieGoal) && input.calorieGoal >= 500 && input.calorieGoal <= 10000, 'Hibás felhasználói beállítások.');
      await db.transaction(async transaction => {
        await transaction.prepare('UPDATE users SET blocked=?,calorie_goal=?,updated_at=? WHERE id=?').bind(input.blocked ? 1 : 0,input.calorieGoal,timestamp(),id).run();
        if (input.blocked) await transaction.prepare('DELETE FROM sessions WHERE user_id=?').bind(id).run();
        await audit(transaction,userId,'user.update',id,{ before:{blocked:Boolean(target.blocked),calorieGoal:target.calorie_goal},after:input });
      });
      return json({ ok: true });
    }
  }
  if (path === '/meals' && request.method === 'GET') {
    const conditions = [], args = [], status = url.searchParams.get('status'), owner = url.searchParams.get('userId');
    if (status) { check(['saved','draft','failed','analyzing'].includes(status), 'Hibás állapot.'); conditions.push('m.status=?'); args.push(status); }
    if (owner) { conditions.push('m.user_id=?'); args.push(validId(owner)); }
    const where = conditions.length ? ' WHERE ' + conditions.join(' AND ') : '';
    return list(db,'SELECT m.id,m.user_id,m.day,m.time,m.type,m.status,m.model,m.latency_ms,m.error,m.created_at,u.email FROM meals m JOIN users u ON u.id=m.user_id' + where + ' ORDER BY m.created_at DESC,m.id',args,'SELECT COUNT(*) AS total FROM meals m' + where,url);
  }
  const mealMatch = /^\/meals\/([^/]+)$/.exec(path);
  if (mealMatch && request.method === 'GET') {
    const meal = await db.prepare('SELECT m.*,u.email FROM meals m JOIN users u ON u.id=m.user_id WHERE m.id=?').bind(validId(mealMatch[1])).first();
    check(meal,'A bejegyzés nem található.',404);
    for (const key of ['analysis','original_analysis','photo','analysis_context','usage']) meal[key] = meal[key] ? JSON.parse(meal[key]) : null;
    if (meal.analysis) meal.totals = totals(meal.analysis.ingredients);
    return json({ meal });
  }
  if (path === '/jobs' && request.method === 'GET') {
    const state = url.searchParams.get('state'), args = [];
    if (state) { check(['queued','running','uploading','failed','done'].includes(state),'Hibás feladatállapot.'); args.push(state); }
    const where = state ? ' WHERE j.state=?' : '';
    return list(db,'SELECT j.meal_id,j.kind,j.state,j.attempts,j.error,j.lease_until,j.created_at,j.updated_at,u.email FROM analysis_jobs j JOIN meals m ON m.id=j.meal_id JOIN users u ON u.id=m.user_id' + where + ' ORDER BY j.updated_at DESC,j.meal_id',args,'SELECT COUNT(*) AS total FROM analysis_jobs j' + where,url);
  }
  if (path === '/audit' && request.method === 'GET') return list(db,'SELECT a.action,a.target,a.details,a.created_at,u.email FROM admin_audit a JOIN users u ON u.id=a.actor_id ORDER BY a.created_at DESC,a.id',[],'SELECT COUNT(*) AS total FROM admin_audit',url);
  check(false,'Ez a művelet vagy elérési út nem található.',404);
}
