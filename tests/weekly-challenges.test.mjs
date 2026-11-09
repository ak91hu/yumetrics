import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {resolve} from 'node:path';
import {mkdirSync,rmSync} from 'node:fs';
import {openDatabase,openPostgresDatabase} from '../lib/database.mjs';
import {challengeWeek,weeklyChallenges,refreshWeeklyChallenge} from '../lib/weekly-challenges.mjs';
import {validateAnalysis} from '../lib/domain.mjs';
import {api} from '../lib/api.mjs';

const ingredient={name:'Test food',grams:100,calories:170,protein:10,carbs:10,fat:10,fiber:null,sugar:null,sodium:null,saturatedFat:null,quantityUnit:'g',foodState:'prepared',sourceType:'user',weightBasis:'user'};
const analysis=()=>({name:'Test meal',confidence:'medium',assumptions:'Software test',ingredients:[{...ingredient}]});
test('challenge weeks use server-controlled Budapest Monday boundaries through DST and year changes',()=>{
  for(const [time,start,end]of[
    ['2026-11-08T22:59:59Z','2026-11-02','2026-11-08'],['2026-11-08T23:00:00Z','2026-11-09','2026-11-15'],
    ['2026-03-29T21:59:59Z','2026-03-23','2026-03-29'],['2026-03-29T22:00:00Z','2026-03-30','2026-04-05'],
    ['2026-10-25T23:00:00Z','2026-10-26','2026-11-01'],['2027-01-01T12:00:00Z','2026-12-28','2027-01-03'],
    ['2024-02-29T12:00:00Z','2024-02-26','2024-03-03'],
  ]){const week=challengeWeek(new Date(time));assert.equal(week.start,start);assert.equal(week.end,end);assert.equal(week.timeZone,'Europe/Budapest');}
});

for(const dialect of ['sqlite','postgres']){
  async function fixture(t){
    mkdirSync('work',{recursive:true});const filename=resolve('work','weekly-challenge-'+randomUUID()+'.sqlite');
    if(dialect==='postgres')assert.ok(new URL(process.env.TEST_DATABASE_URL).pathname.endsWith('_test'),'Use an isolated test database');
    const open=()=>dialect==='postgres'?openPostgresDatabase(process.env.TEST_DATABASE_URL):Promise.resolve(openDatabase(filename));
    let db=await open();const user=randomUUID(),other=randomUUID(),stamp='2026-11-09T08:00:00.000Z';
    for(const id of [user,other])await db.prepare('INSERT INTO users(id,google_sub,email,name,created_at,updated_at) VALUES(?,?,?,?,?,?)').bind(id,id,id+'@example.test','Test',stamp,stamp).run();
    const meal=async(day,{owner=user,status='saved',value=analysis(),updated='2026-11-11T12:01:00.000Z',deleting=false}={})=>{
      const id=randomUUID(),photo={publicId:'test',type:'authenticated',url:'https://res.cloudinary.com/test/image/authenticated/v1/test.jpg'};
      await db.prepare('INSERT INTO meals(id,user_id,day,time,type,status,analysis,original_analysis,photo,public_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,owner,day,'12:00','Ebéd',status,JSON.stringify(value),JSON.stringify(value),JSON.stringify(photo),id,stamp,updated).run();
      if(deleting)await db.prepare("INSERT INTO analysis_jobs(meal_id,kind,state,input_hash,created_at,updated_at) VALUES(?,'delete','queued','',?,?)").bind(id,stamp,stamp).run();
      return id;
    };
    const call=(path,method='GET',body,userId=user)=>api(new Request('http://localhost'+path,{method,headers:body?{'Content-Type':'application/json'}:{},...(body?{body:JSON.stringify(body)}:{})}),{db,env:{},userId});
    const saveOn=async(id,now)=>{
      const row=await db.prepare('SELECT user_id,day,analysis FROM meals WHERE id=?').bind(id).first();
      return db.transaction(async transaction=>{
        if(dialect==='postgres')await transaction.prepare('SELECT id FROM users WHERE id=? FOR UPDATE').bind(row.user_id).first();
        const value=validateAnalysis(JSON.parse(row.analysis));
        await transaction.prepare("UPDATE meals SET status='saved',updated_at=? WHERE id=?").bind(now.toISOString(),id).run();
        return refreshWeeklyChallenge(transaction,row.user_id,now,{day:row.day,analysis:value});
      });
    };
    t.after(async()=>{for(const id of [user,other]){await db.prepare('DELETE FROM meals WHERE user_id=?').bind(id).run();await db.prepare('DELETE FROM users WHERE id=?').bind(id).run();}await db.close();if(dialect==='sqlite')for(const suffix of ['','-wal','-shm'])rmSync(filename+suffix,{force:true});});
    return {get db(){return db;},user,other,meal,call,saveOn,reopen:async()=>{await db.close();db=await open();}};
  }
  test(`${dialect}: one choice per week, accurate saved-day progress, permanent rewards and restart persistence`,{skip:dialect==='postgres'&&!process.env.TEST_DATABASE_URL},async t=>{
    const f=await fixture(t), now=new Date('2026-11-09T12:00:00Z'),week=challengeWeek(now),choose={kind:'three_days',weekStart:week.start};
    assert.equal((await weeklyChallenges(f.db,f.user,null,now)).current,null);
    await assert.rejects(weeklyChallenges(f.db,f.user,{...choose,weekStart:'2026-11-02'},now),e=>e.status===409);
    await assert.rejects(weeklyChallenges(f.db,f.user,{...choose,userId:f.other},now),e=>e.status===400);
    const selected=await Promise.all([weeklyChallenges(f.db,f.user,choose,now),weeklyChallenges(f.db,f.user,choose,now)]);assert.equal(selected[0].current.selectedAt,selected[1].current.selectedAt);
    await assert.rejects(weeklyChallenges(f.db,f.user,{...choose,kind:'recipe'},now),e=>e.status===409);
    assert.equal((await weeklyChallenges(f.db,f.other,null,now)).current,null);
    const monday=await f.meal('2026-11-09'),duplicate=await f.meal('2026-11-09'),backdated=await f.meal('2026-11-10');
    assert.equal((await weeklyChallenges(f.db,f.user,null,now)).current.progress,0,'Reading or inserting existing diary data never awards progress');
    await f.saveOn(monday,new Date('2026-11-09T12:01:00Z'));await f.saveOn(duplicate,new Date('2026-11-09T12:02:00Z'));await f.saveOn(backdated,new Date('2026-11-09T12:03:00Z'));
    assert.equal((await weeklyChallenges(f.db,f.user,null,now)).current.progress,1,'Same-day saves and future meal dates cannot create extra active days');
    const future=await f.meal('2026-11-12'),oldWeek=await f.meal('2026-11-08'),otherMeal=await f.meal('2026-11-10',{owner:f.other});
    await f.saveOn(future,new Date('2026-11-10T12:00:00Z'));await f.saveOn(oldWeek,new Date('2026-11-10T12:00:00Z'));await f.saveOn(otherMeal,new Date('2026-11-10T12:00:00Z'));
    assert.equal((await weeklyChallenges(f.db,f.user,null,now)).current.progress,1);
    await f.saveOn(monday,new Date('2026-11-10T12:01:00Z'));await f.saveOn(duplicate,new Date('2026-11-10T12:02:00Z'));await f.reopen();
    const progress=await weeklyChallenges(f.db,f.user,null,new Date('2026-11-10T12:03:00Z'));assert.equal(progress.current.progress,2);assert.equal(progress.current.completedAt,null);
    await f.saveOn(monday,new Date('2026-11-11T12:00:00Z'));const completed=await weeklyChallenges(f.db,f.user,null,new Date('2026-11-11T12:01:00Z'));assert.equal(completed.current.progress,3);assert.equal(completed.totalRewards,1);assert.ok(completed.current.completedAt);
    await f.db.prepare('DELETE FROM meals WHERE user_id=?').bind(f.user).run();await f.reopen();
    const persisted=await weeklyChallenges(f.db,f.user,null,now);assert.equal(persisted.current.progress,3);assert.equal(persisted.totalRewards,1);assert.equal(persisted.current.completedAt,completed.current.completedAt);
    const next=await weeklyChallenges(f.db,f.user,null,new Date('2026-11-15T23:00:00Z'));assert.equal(next.current,null);assert.equal(next.totalRewards,1);
    const nextChoice=await weeklyChallenges(f.db,f.user,{kind:'recipe',weekStart:next.week.start},new Date('2026-11-15T23:00:00Z'));assert.equal(nextChoice.current.kind,'recipe');assert.equal(nextChoice.current.progress,0);assert.equal(nextChoice.totalRewards,1);
    assert.equal(Number((await f.db.prepare('SELECT COUNT(*) AS n FROM weekly_challenges WHERE user_id=?').bind(f.user).first()).n),2);
    const saturday=new Date('2026-11-14T12:00:00Z'),late=await weeklyChallenges(f.db,f.other,null,saturday);assert.equal(late.options.filter(option=>option.available).length,2);
    await assert.rejects(weeklyChallenges(f.db,f.other,{kind:'three_days',weekStart:week.start},saturday),e=>e.status===400);
    assert.equal((await weeklyChallenges(f.db,f.other,{kind:'measured',weekStart:week.start},saturday)).current.kind,'measured');
  });
  test(`${dialect}: recipe and weighed-ingredient rewards follow validated meal saves and cannot be claimed across accounts`,{skip:dialect==='postgres'&&!process.env.TEST_DATABASE_URL},async t=>{
    const f=await fixture(t),week=challengeWeek(),body={kind:'measured',weekStart:week.start};
    assert.equal((await f.call('/api/weekly-challenge','POST',body,null)).status,401);
    assert.equal((await f.call('/api/weekly-challenge','POST',{...body,kind:'invented'})).status,400);
    assert.equal((await f.call('/api/weekly-challenge','POST',body)).status,200);
    const id=await f.meal(week.today,{status:'draft',updated:'2026-01-01T00:00:00.000Z'});
    const value=analysis();value.ingredients[0].weightBasis='measured_total';
    const save=async(revision,data)=>f.call('/api/meals/'+id,'PATCH',{revision,day:week.today,time:'12:00',type:'Ebéd',notes:'Test',analysis:data});
    const firstSave=await save(0,value);assert.equal(firstSave.status,200,await firstSave.text());assert.equal((await weeklyChallenges(f.db,f.user)).current.progress,0);
    value.ingredients[0].weightBasis='measured_ingredient';value.ingredients[0].quantityUnit='ml';
    assert.equal((await save(1,value)).status,200);assert.equal((await weeklyChallenges(f.db,f.user)).current.progress,0);
    value.ingredients[0].quantityUnit='g';
    assert.equal((await save(2,value)).status,200);assert.equal((await weeklyChallenges(f.db,f.user)).totalRewards,1);
    assert.equal((await save(2,value)).status,409);assert.equal((await weeklyChallenges(f.db,f.user)).totalRewards,1);
    const other=await f.call('/api/profile?userId='+f.user,'GET',undefined,f.other);assert.equal((await other.json()).weeklyChallenge.totalRewards,0);
    assert.equal((await f.call('/api/weekly-challenge','POST',{kind:'recipe',weekStart:week.start},f.other)).status,200);
    const recipe=validateAnalysis({...analysis(),recipe:{cookedWeightG:400,eatenWeightG:100,lossesAccountedFor:true,ingredients:[{...ingredient}]}});
    const recipeId=await f.meal(week.today,{owner:f.other,status:'draft',value:recipe,updated:'2026-01-01T00:00:00.000Z'});
    assert.equal((await f.call('/api/meals/'+recipeId,'PATCH',{revision:0,day:week.today,time:'12:00',type:'Ebéd',notes:'Test',analysis:recipe},f.other)).status,200);
    assert.equal((await weeklyChallenges(f.db,f.other)).totalRewards,1);
    const before=await weeklyChallenges(f.db,f.other);await f.reopen();assert.deepEqual(await weeklyChallenges(f.db,f.other),before);
  });
}
