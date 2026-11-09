import {check} from './domain.mjs';
import {profileToday} from './profile-stats.mjs';

export const WEEKLY_CHALLENGES = [
  {id:'three_days',title:'Három nap, egy jó ritmus',description:'Naplózz három különböző napon ezen a héten.',target:3,reward:'Ritmustaláló'},
  {id:'recipe',title:'A hét első saját receptje',description:'Ments el egy saját receptből számolt étkezést ezen a héten.',target:1,reward:'Receptalkotó'},
  {id:'measured',title:'Mérlegre vele!',description:'Ments el egy étkezést legalább egy külön lemért, grammban megadott összetevővel.',target:1,reward:'Mértékmester'},
];
export function challengeWeek(now = new Date()) {
  const today=profileToday('Europe/Budapest',now), day=Date.parse(today+'T00:00:00Z');
  const weekday=(new Date(day).getUTCDay()+6)%7,start=day-weekday*86400000;
  return {start:new Date(start).toISOString().slice(0,10),end:new Date(start+6*86400000).toISOString().slice(0,10),today,timeZone:'Europe/Budapest',daysRemaining:7-weekday};
}

// Writers hold the user's row lock so concurrent saves and selections cannot duplicate rewards.
export async function refreshWeeklyChallenge(db,userId,now = new Date(),saved=null) {
  const week=challengeWeek(now), row=await db.prepare('SELECT kind,selected_at,completed_at,progress,last_day FROM weekly_challenges WHERE user_id=? AND week_start=?').bind(userId,week.start).first();
  if(!row)return null;
  const definition=WEEKLY_CHALLENGES.find(item=>item.id===row.kind);
  if(row.completed_at)return {kind:row.kind,selectedAt:row.selected_at,completedAt:row.completed_at,progress:definition.target};
  let progress=Number(row.progress);
  if(saved&&saved.day>=week.start&&saved.day<=week.today&&now.toISOString()>=row.selected_at){
    if(row.kind==='three_days'&&(!row.last_day||row.last_day<week.today))progress++;
    if(row.kind==='recipe'&&saved.analysis.recipe)progress=1;
    if(row.kind==='measured'&&saved.analysis.ingredients.some(item=>item.weightBasis==='measured_ingredient'&&(item.quantityUnit||'g')==='g'))progress=1;
  }
  const completedAt=progress>=definition.target?now.toISOString():null;
  if(progress!==Number(row.progress))await db.prepare('UPDATE weekly_challenges SET progress=?,last_day=?,completed_at=? WHERE user_id=? AND week_start=? AND completed_at IS NULL').bind(progress,week.today,completedAt,userId,week.start).run();
  return {kind:row.kind,selectedAt:row.selected_at,completedAt,progress};
}

export async function weeklyChallenges(db,userId,choice=null,now = new Date()) {
  const week=challengeWeek(now);
  return db.transaction(async transaction=>{
    const account=await transaction.prepare('SELECT id FROM users WHERE id=?'+(db.dialect==='postgres'?' FOR UPDATE':'')).bind(userId).first();
    check(account,'A felhasználói fiók nem található.',404);
    if(choice){
      check(Object.keys(choice).length===2&&typeof choice.kind==='string'&&WEEKLY_CHALLENGES.some(item=>item.id===choice.kind),'Válassz a három heti kihívás közül.');
      check(choice.weekStart===week.start,'Közben új hét kezdődött. Frissítsd a kihívásokat, és válassz újra.',409);
      const selected=await transaction.prepare('SELECT kind FROM weekly_challenges WHERE user_id=? AND week_start=?').bind(userId,week.start).first();
      check(!selected||selected.kind===choice.kind,'Erre a hétre már választottál kihívást. A következő héten választhatsz másikat.',409);
      check(selected||choice.kind!=='three_days'||week.daysRemaining>=3,'A háromnapos kihívást péntekig indíthatod el. Erre a hétre válassz másik feladatot.');
      if(!selected)await transaction.prepare('INSERT INTO weekly_challenges(user_id,week_start,kind,selected_at) VALUES(?,?,?,?)').bind(userId,week.start,choice.kind,now.toISOString()).run();
    }
    const current=await refreshWeeklyChallenge(transaction,userId,now);
    const rewards=(await transaction.prepare('SELECT week_start,kind,completed_at FROM weekly_challenges WHERE user_id=? AND completed_at IS NOT NULL ORDER BY week_start DESC LIMIT 12').bind(userId).all()).results;
    const total=Number((await transaction.prepare('SELECT COUNT(*) AS total FROM weekly_challenges WHERE user_id=? AND completed_at IS NOT NULL').bind(userId).first()).total);
    return {week,options:WEEKLY_CHALLENGES.map(item=>({...item,available:item.id!=='three_days'||week.daysRemaining>=3})),current,rewards:rewards.map(row=>({weekStart:row.week_start,kind:row.kind,completedAt:row.completed_at})),totalRewards:total};
  });
}
