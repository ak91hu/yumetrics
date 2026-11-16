import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import nodemailer from 'nodemailer';
import { openDatabase, openPostgresDatabase } from '../lib/database.mjs';
import { api } from '../lib/api.mjs';
import { createApp } from '../server.mjs';
import { reportWeek, reportTrend, summarizeWeek, weeklyReportData, renderWeeklyReport, saveReportPreferences, reportPreferences, runWeeklyReports, unsubscribeReport, createReportMailer, startWeeklyReportRunner } from '../lib/weekly-reports.mjs';

const now=new Date('2026-11-15T19:00:00Z');
const env={WEEKLY_REPORTS_ENABLED:'true',SMTP_HOST:'smtp-relay.brevo.com',SMTP_PORT:'587',SMTP_SECURE:'false',SMTP_USER:'login',SMTP_PASS:'test-secret',SMTP_FROM:'Yumetrics <reports@example.test>',APP_ORIGIN:'https://yumetrics.app'};
const analysis=JSON.stringify({ingredients:[{grams:150,calories:200,protein:10,carbs:20,fat:8}]});
const before=new Date('2026-11-09T10:00:00Z');
test('Sunday 20:00 Budapest scheduling observes DST, year boundaries and delayed restarts',()=>{
  for(const [stamp,start,due] of [
    ['2026-11-15T18:59:59Z','2026-11-02','2026-11-08T19:00:00.000Z'],
    ['2026-11-15T19:00:00Z','2026-11-09','2026-11-15T19:00:00.000Z'],
    ['2026-11-16T06:00:00Z','2026-11-09','2026-11-15T19:00:00.000Z'],
    ['2026-03-29T18:00:00Z','2026-03-23','2026-03-29T18:00:00.000Z'],
    ['2026-10-25T19:00:00Z','2026-10-19','2026-10-25T19:00:00.000Z'],
    ['2027-01-03T19:00:00Z','2026-12-28','2027-01-03T19:00:00.000Z'],
  ]){const week=reportWeek(new Date(stamp));assert.equal(week.start,start);assert.equal(week.due,due);}
  assert.equal(reportWeek(new Date('2026-11-11T12:00:00Z'),true).start,'2026-11-09');
});
test('missing days remain unknown, zero-calorie meals remain logged and trends never divide by zero',()=>{
  const meals=[{day:'2026-11-09',time:'12:00',type:'Ebéd',analysis},{day:'2026-11-15',time:'19:59',type:'Vacsora',analysis},
    {day:'2026-11-15',time:'20:00',type:'Vacsora',analysis}];
  const result=summarizeWeek(meals,'2026-11-09','2026-11-15');
  assert.equal(result.totals.calories,600);assert.equal(result.loggedDays,2);assert.equal(result.average.calories,300);assert.equal(result.days[1].calories,null);
  const zero=summarizeWeek([{...meals[0],analysis:JSON.stringify({ingredients:[{grams:100,calories:0,protein:0,carbs:0,fat:0}]})}],'2026-11-09','2026-11-15');
  assert.equal(zero.days[0].calories,0);assert.equal(zero.loggedDays,1);
  assert.deepEqual(reportTrend(300,200),{difference:100,percent:50});assert.deepEqual(reportTrend(300,0),{difference:300,percent:null});assert.equal(reportTrend(null,100),null);
});

for(const dialect of ['sqlite','postgres']){
  async function fixture(t){
    if(dialect==='postgres')assert.ok(new URL(process.env.TEST_DATABASE_URL).pathname.endsWith('_test'));
    const db=dialect==='sqlite'?openDatabase(':memory:'):await openPostgresDatabase(process.env.TEST_DATABASE_URL);
    const user=randomUUID(),other=randomUUID();
    for(const id of [user,other])await db.prepare('INSERT INTO users(id,google_sub,email,name,created_at,updated_at) VALUES(?,?,?,?,?,?)').bind(id,id,`${id}@example.test`,'<Test & Person>',before.toISOString(),before.toISOString()).run();
    t.after(async()=>{for(const id of [user,other]){await db.prepare('DELETE FROM analysis_jobs WHERE meal_id IN (SELECT id FROM meals WHERE user_id=?)').bind(id).run();await db.prepare('DELETE FROM meals WHERE user_id=?').bind(id).run();await db.prepare('DELETE FROM users WHERE id=?').bind(id).run();}await db.close();});
    const meal=async(day,{owner=user,status='saved',deleting=false,time='12:00'}={})=>{
      const id=randomUUID();await db.prepare('INSERT INTO meals(id,user_id,day,time,type,status,analysis,public_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(id,owner,day,time,'Ebéd',status,analysis,id,before.toISOString(),before.toISOString()).run();
      if(deleting)await db.prepare("INSERT INTO analysis_jobs(meal_id,kind,state,input_hash,created_at,updated_at) VALUES(?,'delete','queued','',?,?)").bind(id,before.toISOString(),before.toISOString()).run();
    };
    const delivery=()=>db.prepare('SELECT * FROM weekly_report_deliveries WHERE user_id=?').bind(user).first();
    const enable=()=>saveReportPreferences(db,user,{enabled:true,language:'hu'},before);
    return {db,user,other,meal,enable,delivery};
  }
  const skip=dialect==='postgres'&&!process.env.TEST_DATABASE_URL;
  test(`${dialect}: reports are owner-scoped, saved-only, deletion-aware and bilingual without remote chart services`,{skip},async t=>{
    const f=await fixture(t);await f.meal('2026-11-09');await f.meal('2026-11-02');await f.meal('2026-11-10',{status:'draft'});await f.meal('2026-11-11',{owner:f.other});await f.meal('2026-11-12',{deleting:true});await f.meal('2026-11-15',{time:'20:01'});
    const data=await weeklyReportData(f.db,f.user,reportWeek(now));
    assert.equal(data.current.mealCount,1);assert.equal(data.previous.mealCount,1);assert.equal(data.current.totals.calories,300);
    for(const language of ['hu','en']){const report=renderWeeklyReport(data,{language,origin:env.APP_ORIGIN,preview:true});assert.ok(report.html.includes('&lt;Test &amp; Person&gt;'));assert.ok(!report.html.includes('<script'));assert.match(report.html,/<img src="data:image\/png;base64,[A-Za-z0-9+/=]+"[^>]+alt="Yumetrics"/);assert.doesNotMatch(report.html,/<img[^>]+src="https?:/);assert.match(report.text,/300/);assert.match(report.html,/bgcolor/);assert.ok(report.html.includes(language==='en'?'No entries':'Nincs bejegyzés'));}
  });
  test(`${dialect}: opt-in, concurrent workers and restarts yield one relay handoff per week`,{skip},async t=>{
    const f=await fixture(t),messages=[],mailer={send:async payload=>{messages.push(payload);return {accepted:[payload.to],messageId:'relay-id'};}};
    await f.meal('2026-11-09');assert.equal((await reportPreferences(f.db,f.user,env)).enabled,false);
    await runWeeklyReports({db:f.db,env,now,mailer});assert.equal(messages.length,0);
    await f.enable();await Promise.all([runWeeklyReports({db:f.db,env,now,mailer}),runWeeklyReports({db:f.db,env,now,mailer})]);
    await runWeeklyReports({db:f.db,env,now:new Date('2026-11-16T12:00:00Z'),mailer});
    assert.equal(messages.length,1);assert.equal((await f.delivery()).state,'sent');assert.equal((await f.delivery()).payload,null);
    assert.match(messages[0].messageId,/^<weekly-/);assert.ok(messages[0].headers['List-Unsubscribe-Post']);
  });
  test(`${dialect}: a stale concurrent queue read cannot bypass the SMTP retry delay`,{skip,timeout:5000},async t=>{
    const f=await fixture(t);await f.enable();await f.meal('2026-11-09');
    let readers=0,claims=0,calls=0,releaseReaders,releaseClaim;
    const bothRead=new Promise(resolve=>{releaseReaders=resolve;}),failureSaved=new Promise(resolve=>{releaseClaim=resolve;});
    const wrapped={...f.db,prepare(sql){const statement=f.db.prepare(sql);return {bind(...args){const bound=statement.bind(...args);return {...bound,
      async all(){const result=await bound.all();if(sql.startsWith('SELECT user_id,week_start FROM weekly_report_deliveries')){if(++readers===2)releaseReaders();await bothRead;}return result;},
      async first(){if(sql.startsWith("UPDATE weekly_report_deliveries SET state='sending'")){if(++claims===2)await failureSaved;}return bound.first();},
      async run(){const result=await bound.run();if(sql.startsWith('UPDATE weekly_report_deliveries SET state=?'))releaseClaim();return result;}
    };}};}};
    const mailer={send:async()=>{calls++;throw Object.assign(new Error('temporary rejection'),{responseCode:451});}};
    await Promise.all([runWeeklyReports({db:wrapped,env,now,mailer}),runWeeklyReports({db:wrapped,env,now,mailer})]);
    assert.equal(calls,1);assert.equal((await f.delivery()).attempts,1);assert.equal((await f.delivery()).state,'pending');
  });
  test(`${dialect}: preview excludes future meals and compares the same elapsed part of last week`,{skip},async t=>{
    const f=await fixture(t),week=reportWeek(new Date('2026-11-11T12:00:00Z'),true);
    for(const day of ['2026-11-09','2026-11-13','2026-11-02','2026-11-06'])await f.meal(day);
    await f.meal('2026-11-11',{time:'13:01'});await f.meal('2026-11-04',{time:'13:01'});
    const data=await weeklyReportData(f.db,f.user,week);
    assert.equal(data.current.mealCount,1);assert.equal(data.previous.mealCount,1);assert.equal(data.current.days[4].calories,null);
    const email=renderWeeklyReport(data,{origin:env.APP_ORIGIN,preview:true});assert.ok(email.html.includes('Ez a hét még tart'));
  });
  test(`${dialect}: permanent SMTP rejection is final and graceful shutdown finishes only the in-flight email`,{skip},async t=>{
    const f=await fixture(t);await f.enable();await f.meal('2026-11-09');
    await runWeeklyReports({db:f.db,env,now,mailer:{send:async()=>{throw Object.assign(new Error('recipient rejected'),{command:'RCPT TO',responseCode:550});}}});
    assert.equal((await f.delivery()).state,'failed');
    await f.db.prepare('DELETE FROM weekly_report_deliveries WHERE user_id=?').bind(f.user).run();
    let releaseSend,started,closed=0;
    const sending=new Promise(resolve=>{started=resolve;}),finish=new Promise(resolve=>{releaseSend=resolve;});
    const runner=startWeeklyReportRunner({db:f.db,env,now:()=>now,mailer:{send:async payload=>{started();await finish;return {accepted:[payload.to]};},close(){closed++;}}});
    t.after(()=>runner.stop());
    await sending;runner.stop();assert.equal(closed,0);releaseSend();
    for(let i=0;runner.working&&i<100;i++)await new Promise(resolve=>setTimeout(resolve,5));
    assert.equal(runner.working,false);assert.equal(closed,1);assert.equal((await f.delivery()).state,'sent');
  });
  test(`${dialect}: no current meals, blocked accounts and recently subscribed users do not receive historical reports`,{skip},async t=>{
    const f=await fixture(t),mailer={send:()=>{throw new Error('Must not send');}};await f.enable();await runWeeklyReports({db:f.db,env,now,mailer});assert.equal((await f.delivery()).state,'skipped');
    await f.meal('2026-11-09');await saveReportPreferences(f.db,f.other,{enabled:true,language:'en'},new Date('2026-11-16T00:00:00Z'));
    await f.meal('2026-11-09',{owner:f.other});await runWeeklyReports({db:f.db,env,now:new Date('2026-11-16T12:00:00Z'),mailer});
    assert.equal(await f.db.prepare('SELECT * FROM weekly_report_deliveries WHERE user_id=?').bind(f.other).first(),null);
    await f.db.prepare("UPDATE weekly_report_preferences SET enabled_at=? WHERE user_id=?").bind(before.toISOString(),f.other).run();
    await f.db.prepare('UPDATE users SET blocked=1 WHERE id=?').bind(f.other).run();
    await runWeeklyReports({db:f.db,env,now,mailer});assert.equal(await f.db.prepare('SELECT * FROM weekly_report_deliveries WHERE user_id=?').bind(f.other).first(),null);
  });
  test(`${dialect}: explicit temporary SMTP rejection retries; ambiguous timeout and expired lease never resend`,{skip},async t=>{
    const f=await fixture(t);await f.enable();await f.meal('2026-11-09');let calls=0;
    const mailer={send:async()=>{calls++;throw Object.assign(new Error('secret must not be stored'),{responseCode:451});}};
    await runWeeklyReports({db:f.db,env,now,mailer});assert.equal((await f.delivery()).state,'pending');assert.equal(calls,1);
    const later=new Date(now.getTime()+6*60000);mailer.send=async()=>{calls++;throw Object.assign(new Error('test SMTP secret'),{command:'DATA',code:'ETIMEDOUT'});};
    await runWeeklyReports({db:f.db,env,now:later,mailer});assert.equal((await f.delivery()).state,'failed');assert.equal((await f.delivery()).error,'smtp_delivery_unknown');assert.equal((await f.delivery()).payload,null);
    await runWeeklyReports({db:f.db,env,now:new Date(later.getTime()+60000),mailer});assert.equal(calls,2);
    await f.db.prepare("UPDATE weekly_report_deliveries SET state='sending',lease_until=?,payload='{}'").bind(now.toISOString()).run();
    await runWeeklyReports({db:f.db,env,now:later,mailer});assert.equal((await f.delivery()).state,'failed');assert.equal(calls,2);
  });
  test(`${dialect}: unsubscribe GET does not mutate; POST disables emails and pending retries respect opt-out`,{skip},async t=>{
    const f=await fixture(t);await f.enable();await f.meal('2026-11-09');
    const token=(await f.db.prepare('SELECT unsubscribe_token FROM weekly_report_preferences WHERE user_id=?').bind(f.user).first()).unsubscribe_token;
    const link=env.APP_ORIGIN+'/email/weekly/unsubscribe?token='+token;
    assert.equal((await unsubscribeReport(new Request(link),f.db)).status,200);assert.equal((await reportPreferences(f.db,f.user,env)).enabled,true);
    await runWeeklyReports({db:f.db,env,now,mailer:{send:async()=>{throw Object.assign(new Error('busy'),{responseCode:451});}}});
    assert.equal((await unsubscribeReport(new Request(link,{method:'POST'}),f.db)).status,200);
    await runWeeklyReports({db:f.db,env,now:new Date(now.getTime()+360000),mailer:{send:()=>{throw new Error('must not send');}}});
    assert.equal((await f.delivery()).state,'skipped');assert.equal((await f.delivery()).payload,null);
    assert.equal((await unsubscribeReport(new Request(link.replace(token,'a'.repeat(64))),f.db)).status,400);
  });
  test(`${dialect}: authenticated preferences reject invalid input and cross-site changes; preview has restrictive CSP`,{skip},async t=>{
    const f=await fixture(t);
    const call=(path,method='GET',body,headers={})=>api(new Request(env.APP_ORIGIN+path,{method,headers:{'Content-Type':'application/json',...headers},...(body?{body:JSON.stringify(body)}:{})}),{db:f.db,env,userId:f.user});
    assert.equal((await call('/api/weekly-report/preferences','PATCH',{enabled:'yes',language:'hu'})).status,400);
    assert.equal((await call('/api/weekly-report/preferences','PATCH',{enabled:true,language:'hu'},{Origin:'https://evil.test'})).status,403);
    assert.equal((await call('/api/weekly-report/preferences','PATCH',{enabled:true,language:'en'})).status,200);
    assert.equal((await (await call('/api/weekly-report/preferences')).json()).language,'en');
    const preview=await call('/api/weekly-report/preview?lang=en');assert.equal(preview.status,200);assert.match(preview.headers.get('content-security-policy'),/default-src 'none'/);assert.match(await preview.text(),/Preview/);
    const unauth=await api(new Request(env.APP_ORIGIN+'/api/weekly-report/preview'),{db:f.db,env});assert.equal(unauth.status,401);
    const server=createApp({db:f.db,env:{}});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
    const response=await fetch(`http://127.0.0.1:${server.address().port}/email/weekly/unsubscribe?token=invalid`);assert.equal(response.status,400);
  });
}
test('SMTP encryption config rejects mismatched ports without making a connection',()=>{
  assert.throws(()=>createReportMailer({...env,SMTP_PORT:'465',SMTP_SECURE:'false'}));
  assert.throws(()=>createReportMailer({...env,SMTP_PASS:''}));
  createReportMailer(env).close();
});

test('email logo becomes an inline PNG MIME part without external image requests',async()=>{
  const week=reportWeek(now),current=summarizeWeek([{day:week.start,time:'12:00',type:'Ebéd',analysis}],week.start,week.end);
  const previous=summarizeWeek([],week.previousStart,week.previousEnd);
  const report=renderWeeklyReport({week,current,previous,user:{name:'Ákos',calorie_goal:2000}},{origin:env.APP_ORIGIN});
  const transport=nodemailer.createTransport({streamTransport:true,buffer:true,attachDataUrls:true,disableFileAccess:true,disableUrlAccess:true});
  const result=await transport.sendMail({from:'test@example.test',to:'owner@example.test',...report});
  const mime=result.message.toString();
  assert.match(mime,/Content-Type: multipart\/related/);assert.match(mime,/Content-Type: image\/png/);assert.match(mime,/Content-ID: </);assert.doesNotMatch(mime,/src=3D"data:/);
  assert.ok(report.html.includes('Napi átlagod'));assert.ok(!report.html.includes('Naplózási lefedettség'));
});
