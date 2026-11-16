import { randomBytes, randomUUID, createHash } from 'node:crypto';
import nodemailer from 'nodemailer';
import { renderWeeklyReport } from './weekly-report-email.mjs';
export { renderWeeklyReport } from './weekly-report-email.mjs';
import { check, totals, TYPES } from './domain.mjs';
import { profileToday } from './profile-stats.mjs';

const ZONE = 'Europe/Budapest', DAY = 86400_000;
const shift = (day, amount) => new Date(Date.parse(day + 'T12:00:00Z') + amount * DAY).toISOString().slice(0, 10);
const round = n => Math.round(n * 10) / 10;

// Wall-clock rules avoid fixed UTC offsets at daylight-saving boundaries.
export function reportWeek(now = new Date(), preview = false) {
  const today = profileToday(ZONE, now), weekday = new Date(today + 'T12:00:00Z').getUTCDay();
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: ZONE, hour: '2-digit', hourCycle: 'h23' }).format(now));
  let end = shift(today, -weekday);
  if (preview) end = shift(today, (7 - weekday) % 7);
  else if (weekday === 0 && hour < 20) end = shift(end, -7);
  // Convert Sunday 20:00 Budapest to an instant, including summer time.
  const noon = new Date(end + 'T12:00:00Z');
  const localHour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: ZONE, hour:'2-digit', hourCycle:'h23' }).format(noon));
  const due = new Date(Date.parse(end + 'T20:00:00Z') - (localHour - 12) * 3600_000).toISOString();
  const time = new Intl.DateTimeFormat('en-GB',{timeZone:ZONE,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(now);
  return { start: shift(end, -6), end, previousStart: shift(end, -13), previousEnd: shift(end, -7), due, timeZone: ZONE, cutoff: '20:00',
    ...(preview ? { through:{day:today,time}, previousThrough:{day:shift(today,-7),time} } : {}) };
}

export function smtpConfigured(env) {
  return Boolean(env.SMTP_HOST?.trim() && env.SMTP_USER?.trim() && env.SMTP_PASS?.trim() && env.SMTP_FROM?.trim());
}
export function createReportMailer(env) {
  check(smtpConfigured(env), 'Az emailküldés még nincs beállítva.', 503);
  const port = Number(env.SMTP_PORT || 587), secure = env.SMTP_SECURE === 'true';
  check([587,465,2525].includes(port) && secure === (port === 465), 'Hibás SMTP-port vagy titkosítás.', 503);
  const transport = nodemailer.createTransport({ host: env.SMTP_HOST, port, secure, requireTLS: !secure,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS }, connectionTimeout: 10000, greetingTimeout: 10000,
    socketTimeout: 20000, attachDataUrls: true, disableFileAccess: true, disableUrlAccess: true, logger: false, debug: false });
  return { send: payload => transport.sendMail(payload), close: () => transport.close() };
}

export async function reportPreferences(db, userId, env) {
  const row = await db.prepare('SELECT enabled,language FROM weekly_report_preferences WHERE user_id=?').bind(userId).first();
  return { enabled: row?.enabled === 1, language: row?.language || 'hu', available: smtpConfigured(env) && env.WEEKLY_REPORTS_ENABLED === 'true', timeZone: ZONE, schedule: 'Sunday 20:00' };
}
export async function saveReportPreferences(db, userId, input, now = new Date()) {
  check(typeof input.enabled === 'boolean' && ['hu','en'].includes(input.language), 'Hibás heti emailbeállítás.');
  const stamp = now.toISOString();
  await db.prepare(`INSERT INTO weekly_report_preferences(user_id,enabled,language,enabled_at,updated_at,unsubscribe_token) VALUES(?,?,?,?,?,?)
    ON CONFLICT(user_id) DO UPDATE SET enabled=excluded.enabled,language=excluded.language,
    enabled_at=CASE WHEN weekly_report_preferences.enabled=0 AND excluded.enabled=1 THEN excluded.enabled_at ELSE weekly_report_preferences.enabled_at END,updated_at=excluded.updated_at`)
    .bind(userId,input.enabled?1:0,input.language,stamp,stamp,randomBytes(32).toString('hex')).run();
}

export function summarizeWeek(meals, start, end, cutoff = '20:00', through = null) {
  const nutrients = ['calories','protein','carbs','fat'];
  const days = Array.from({length:7},(_,i)=>({ day:shift(start,i), mealCount:0, ...Object.fromEntries(nutrients.map(k=>[k,0])) }));
  const types = TYPES.map(type=>({type,mealCount:0,calories:0}));
  for (const meal of meals) {
    if (meal.day < start || meal.day > end || meal.day === end && meal.time >= cutoff) continue;
    if (through && (meal.day > through.day || meal.day === through.day && meal.time > through.time)) continue;
    const value = totals(JSON.parse(meal.analysis).ingredients), daily = days.find(d=>d.day===meal.day), type = types.find(t=>t.type===meal.type);
    for (const key of nutrients) { check(Number.isFinite(value[key]) && value[key]>=0,'Hibás mentett tápérték.',503); daily[key] += value[key]; }
    daily.mealCount++; if(type){type.mealCount++;type.calories += value.calories;}
  }
  const logged = days.filter(d=>d.mealCount), sums = Object.fromEntries(nutrients.map(k=>[k,round(days.reduce((s,d)=>s+d[k],0))]));
  return { start, end, days:days.map(d=>({...d,...Object.fromEntries(nutrients.map(k=>[k,d.mealCount?round(d[k]):null]))})),
    totals:sums, loggedDays:logged.length, mealCount:days.reduce((s,d)=>s+d.mealCount,0),
    average:Object.fromEntries(nutrients.map(k=>[k,logged.length?round(sums[k]/logged.length):null])),
    types:types.map(t=>({...t,calories:round(t.calories)})) };
}
export async function weeklyReportData(db, userId, week) {
  return db.transaction(async tx => {
    if(db.dialect==='postgres')await tx.prepare('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY').bind().run();
    const user = await tx.prepare('SELECT name,email,calorie_goal FROM users WHERE id=?').bind(userId).first();
    check(user,'A felhasználói fiók nem található.',404);
    const meals = (await tx.prepare(`SELECT m.day,m.time,m.type,m.analysis FROM meals m WHERE m.user_id=? AND m.status='saved' AND m.day>=? AND m.day<=?
      AND NOT EXISTS(SELECT 1 FROM analysis_jobs j WHERE j.meal_id=m.id AND j.kind='delete') ORDER BY m.day,m.time,m.id`).bind(userId,week.previousStart,week.end).all()).results;
    return {user,week,current:summarizeWeek(meals,week.start,week.end,week.cutoff,week.through),previous:summarizeWeek(meals,week.previousStart,week.previousEnd,week.cutoff,week.previousThrough)};
  });
}
export function reportTrend(current, previous) {
  if (current == null || previous == null) return null;
  return { difference:round(current-previous), percent:previous>0?round((current-previous)/previous*100):null };
}

export async function unsubscribeReport(request, db) {
  const url=new URL(request.url),token=url.searchParams.get('token');
  if(!db||!token||!/^[a-f0-9]{64}$/.test(token))return new Response('Invalid link',{status:400});
  const row=await db.prepare('SELECT user_id FROM weekly_report_preferences WHERE unsubscribe_token=?').bind(token).first();
  if(!row)return new Response('Invalid link',{status:400});
  if(request.method==='POST'){
    await db.prepare('UPDATE weekly_report_preferences SET enabled=0,updated_at=? WHERE user_id=?').bind(new Date().toISOString(),row.user_id).run();
    return new Response('<!doctype html><meta charset="utf-8"><title>Yumetrics</title><p>Leiratkoztál a heti emailekről. / Weekly emails disabled.</p>',{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
  }
  if(request.method!=='GET')return new Response(null,{status:405,headers:{Allow:'GET, POST'}});
  return new Response(`<!doctype html><meta charset="utf-8"><title>Yumetrics</title><h1>Heti emailek / Weekly emails</h1><form method="post" action="/email/weekly/unsubscribe?token=${token}"><button type="submit">Leiratkozom / Unsubscribe</button></form>`,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
}

export async function runWeeklyReports({ db, env, now=new Date(), mailer, shouldContinue=()=>true }) {
  if(env.WEEKLY_REPORTS_ENABLED!=='true'||!smtpConfigured(env))return;
  const week=reportWeek(now),stamp=now.toISOString();
  await db.prepare("UPDATE weekly_report_deliveries SET state='skipped',payload=NULL,error='report_expired' WHERE state='pending' AND week_start<?").bind(week.start).run();
  const users=(await db.prepare(`SELECT p.user_id FROM weekly_report_preferences p JOIN users u ON u.id=p.user_id WHERE p.enabled=1 AND u.blocked=0 AND p.enabled_at<=?
    AND NOT EXISTS(SELECT 1 FROM weekly_report_deliveries d WHERE d.user_id=p.user_id AND d.week_start=?) ORDER BY p.user_id LIMIT 50`).bind(week.due,week.start).all()).results;
  for(const {user_id} of users)await db.prepare("INSERT INTO weekly_report_deliveries(user_id,week_start,state,next_attempt_at) VALUES(?,?,'pending',?) ON CONFLICT(user_id,week_start) DO NOTHING").bind(user_id,week.start,stamp).run();
  // An expired SMTP lease is ambiguous: the relay may already have accepted the email.
  // Do not automatically resend it; SMTP has no exactly-once/idempotency guarantee.
  await db.prepare("UPDATE weekly_report_deliveries SET state='failed',payload=NULL,error='smtp_delivery_unknown',lease_token=NULL,lease_until=NULL WHERE state='sending' AND lease_until<=?").bind(stamp).run();
  const rows=(await db.prepare("SELECT user_id,week_start FROM weekly_report_deliveries WHERE state='pending' AND week_start=? AND next_attempt_at<=? ORDER BY next_attempt_at,user_id LIMIT 10").bind(week.start,stamp).all()).results;
  for(const row of rows){
    if(!shouldContinue())break;
    const token=randomUUID();
    const claimed=await db.prepare("UPDATE weekly_report_deliveries SET state='sending',lease_token=?,lease_until=?,attempts=attempts+1,first_attempt_at=COALESCE(first_attempt_at,?) WHERE user_id=? AND week_start=? AND state='pending' AND next_attempt_at<=? RETURNING *")
      .bind(token,new Date(now.getTime()+300000).toISOString(),stamp,row.user_id,row.week_start,stamp).first();
    if(!claimed)continue;
    try{
      const recipient=await db.prepare('SELECT u.email,p.language,p.unsubscribe_token FROM users u JOIN weekly_report_preferences p ON p.user_id=u.id WHERE u.id=? AND u.blocked=0 AND p.enabled=1').bind(row.user_id).first();
      if(!recipient){await db.prepare("UPDATE weekly_report_deliveries SET state='skipped',payload=NULL,lease_token=NULL,lease_until=NULL WHERE user_id=? AND week_start=? AND lease_token=?").bind(row.user_id,row.week_start,token).run();continue;}
      let payload=claimed.payload?JSON.parse(claimed.payload):null;
      if(!payload){
        const data=await weeklyReportData(db,row.user_id,week);
        if(!data.current.mealCount){await db.prepare("UPDATE weekly_report_deliveries SET state='skipped',error='no_saved_meals',lease_token=NULL,lease_until=NULL WHERE user_id=? AND week_start=? AND lease_token=?").bind(row.user_id,row.week_start,token).run();continue;}
        const origin=new URL(env.APP_ORIGIN).origin,unsubscribeUrl=`${origin}/email/weekly/unsubscribe?token=${recipient.unsubscribe_token}`;
        const report=renderWeeklyReport(data,{language:recipient.language,origin,unsubscribeUrl});
        const hash=createHash('sha256').update(`${row.user_id}/${week.start}`).digest('hex');
        payload={from:env.SMTP_FROM,to:recipient.email,...report,messageId:`<weekly-${hash}@${new URL(origin).hostname}>`,headers:{'List-Unsubscribe':`<${unsubscribeUrl}>`,'List-Unsubscribe-Post':'List-Unsubscribe=One-Click'}};
        await db.prepare('UPDATE weekly_report_deliveries SET payload=? WHERE user_id=? AND week_start=? AND lease_token=?').bind(JSON.stringify(payload),row.user_id,row.week_start,token).run();
      }
      // Opt-out and account changes are rechecked immediately before handing off to SMTP.
      const allowed=await db.prepare('SELECT u.email FROM users u JOIN weekly_report_preferences p ON p.user_id=u.id WHERE u.id=? AND u.blocked=0 AND p.enabled=1').bind(row.user_id).first();
      if(!allowed||allowed.email!==payload.to){await db.prepare("UPDATE weekly_report_deliveries SET state='skipped',payload=NULL,lease_token=NULL,lease_until=NULL WHERE user_id=? AND week_start=? AND lease_token=?").bind(row.user_id,row.week_start,token).run();continue;}
      const sent=await mailer.send(payload);
      if(!sent.accepted?.length)throw Object.assign(new Error('SMTP rejected recipient'),{code:'EENVELOPE',responseCode:550});
      await db.prepare("UPDATE weekly_report_deliveries SET state='sent',sent_at=?,provider_id=?,payload=NULL,error=NULL,lease_token=NULL,lease_until=NULL WHERE user_id=? AND week_start=? AND lease_token=?").bind(stamp,sent.messageId||payload.messageId,row.user_id,row.week_start,token).run();
    }catch(error){
      const safeToRetry=error.responseCode ? error.responseCode>=400&&error.responseCode<500 : ['CONN','EHLO','HELO','STARTTLS','AUTH','MAIL FROM','RCPT TO'].includes(error.command);
      const retry=safeToRetry&&claimed.attempts<5;
      await db.prepare('UPDATE weekly_report_deliveries SET state=?,next_attempt_at=?,error=?,payload=CASE WHEN ?=1 THEN payload ELSE NULL END,lease_token=NULL,lease_until=NULL WHERE user_id=? AND week_start=? AND lease_token=?')
        .bind(retry?'pending':'failed',new Date(now.getTime()+Math.min(60,5*2**(claimed.attempts-1))*60000).toISOString(),safeToRetry?'smtp_rejected_or_unavailable':'smtp_delivery_unknown',retry?1:0,row.user_id,row.week_start,token).run();
    }
  }
}

export function startWeeklyReportRunner({db,env,mailer,now=()=>new Date()}) {
  if(env.WEEKLY_REPORTS_ENABLED!=='true'||!smtpConfigured(env))return null;
  mailer ||= createReportMailer(env);
  let working=false,stopped=false;
  const tick=async()=>{if(working||stopped)return;working=true;try{await runWeeklyReports({db,env,mailer,now:now(),shouldContinue:()=>!stopped});}catch{console.error('Weekly report processing failed');}finally{working=false;if(stopped)mailer.close?.();}};
  const timer=setInterval(tick,60000);timer.unref();void tick();
  return {get working(){return working;},stop(){stopped=true;clearInterval(timer);if(!working)mailer.close?.();}};
}
