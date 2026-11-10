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
async function recordActivity(db,userId,week,day,recipe,measured){
  await db.prepare('INSERT INTO weekly_activity(user_id,week_start,activity_day,recipe,measured) VALUES(?,?,?,?,?) ON CONFLICT(user_id,week_start,activity_day) DO UPDATE SET recipe=CASE WHEN weekly_activity.recipe=1 OR excluded.recipe=1 THEN 1 ELSE 0 END,measured=CASE WHEN weekly_activity.measured=1 OR excluded.measured=1 THEN 1 ELSE 0 END').bind(userId,week.start,day,recipe?1:0,measured?1:0).run();
}
async function weekActivity(db,userId,week,now) {
  const recorded=(await db.prepare('SELECT activity_day,recipe,measured FROM weekly_activity WHERE user_id=? AND week_start=? AND activity_day<=?').bind(userId,week.start,week.today).all()).results;
  const history=new Map(recorded.map(row=>[row.activity_day,{recipe:Number(row.recipe),measured:Number(row.measured)}]));
  // shortcut: pre-ledger overwritten or deleted saves are unrecoverable; retain all new save days.
  const rows=(await db.prepare("SELECT m.analysis,m.updated_at FROM meals m WHERE m.user_id=? AND m.status='saved' AND m.day>=? AND m.day<=? AND m.updated_at<=? AND NOT EXISTS(SELECT 1 FROM analysis_jobs j WHERE j.meal_id=m.id AND j.kind='delete')").bind(userId,week.start,week.today,now.toISOString()).all()).results;
  const days=new Set(history.keys());let recipe=recorded.some(row=>Number(row.recipe))?1:0,measured=recorded.some(row=>Number(row.measured))?1:0;
  for(const row of rows){
    const time=new Date(row.updated_at);if(!Number.isFinite(time.getTime()))continue;
    const day=profileToday(week.timeZone,time);if(day<week.start||day>week.today)continue;
    let analysis;try{analysis=JSON.parse(row.analysis);}catch{continue;}
    if(!Array.isArray(analysis?.ingredients))continue;
    const hasRecipe=Boolean(analysis.recipe),hasMeasured=analysis.ingredients.some(item=>item.weightBasis==='measured_ingredient'&&(item.quantityUnit||'g')==='g');
    days.add(day);if(hasRecipe)recipe=1;if(hasMeasured)measured=1;
    const previous=history.get(day);
    if(!previous||hasRecipe&&!previous.recipe||hasMeasured&&!previous.measured){
      await recordActivity(db,userId,week,day,hasRecipe,hasMeasured);
      history.set(day,{recipe:previous?.recipe||Number(hasRecipe),measured:previous?.measured||Number(hasMeasured)});
    }
  }
  return {three_days:Math.min(3,days.size),recipe,measured,lastDay:[...days].sort().at(-1)||null,todayCounted:days.has(week.today)};
}
export async function refreshWeeklyChallenge(db,userId,now = new Date(),saved=null,activity=null) {
  const week=challengeWeek(now);
  if(saved&&saved.day>=week.start&&saved.day<=week.today)await recordActivity(db,userId,week,week.today,Boolean(saved.analysis.recipe),saved.analysis.ingredients.some(item=>item.weightBasis==='measured_ingredient'&&(item.quantityUnit||'g')==='g'));
  const row=await db.prepare('SELECT kind,selected_at,completed_at,progress,last_day FROM weekly_challenges WHERE user_id=? AND week_start=?').bind(userId,week.start).first();
  if(!row)return null;
  const definition=WEEKLY_CHALLENGES.find(item=>item.id===row.kind);
  if(row.completed_at)return {kind:row.kind,selectedAt:row.selected_at,completedAt:row.completed_at,progress:definition.target};
  activity??=await weekActivity(db,userId,week,now);
  let progress=Number(row.progress);
  if(saved&&saved.day>=week.start&&saved.day<=week.today&&now.toISOString()>=row.selected_at){
    if(row.kind==='three_days'&&(!row.last_day||row.last_day<week.today))progress++;
    if(row.kind==='recipe'&&saved.analysis.recipe)progress=1;
    if(row.kind==='measured'&&saved.analysis.ingredients.some(item=>item.weightBasis==='measured_ingredient'&&(item.quantityUnit||'g')==='g'))progress=1;
  }
  progress=Math.max(progress,activity[row.kind]);
  const lastDay=[row.last_day,activity.lastDay,saved&&saved.day>=week.start&&saved.day<=week.today?week.today:null].filter(Boolean).sort().at(-1)||null;
  const completedAt=progress>=definition.target?now.toISOString():null;
  if(progress!==Number(row.progress)||lastDay!==row.last_day)await db.prepare('UPDATE weekly_challenges SET progress=?,last_day=?,completed_at=? WHERE user_id=? AND week_start=? AND completed_at IS NULL').bind(progress,lastDay,completedAt,userId,week.start).run();
  return {kind:row.kind,selectedAt:row.selected_at,completedAt,progress};
}

export async function weeklyChallenges(db,userId,choice=null,now = new Date()) {
  const week=challengeWeek(now);
  return db.transaction(async transaction=>{
    const account=await transaction.prepare('SELECT id FROM users WHERE id=?'+(db.dialect==='postgres'?' FOR UPDATE':'')).bind(userId).first();
    check(account,'A felhasználói fiók nem található.',404);
    const activity=await weekActivity(transaction,userId,week,now);
    const threeDaysAvailable=activity.three_days+week.daysRemaining-(activity.todayCounted?1:0)>=3;
    if(choice){
      check(Object.keys(choice).length===2&&typeof choice.kind==='string'&&WEEKLY_CHALLENGES.some(item=>item.id===choice.kind),'Válassz a három heti kihívás közül.');
      check(choice.weekStart===week.start,'Közben új hét kezdődött. Frissítsd a kihívásokat, és válassz újra.',409);
      const selected=await transaction.prepare('SELECT kind FROM weekly_challenges WHERE user_id=? AND week_start=?').bind(userId,week.start).first();
      check(!selected||selected.kind===choice.kind,'Erre a hétre már választottál kihívást. A következő héten választhatsz másikat.',409);
      check(selected||choice.kind!=='three_days'||threeDaysAvailable,'A hátralévő napokkal együtt sem teljesíthető már a háromnapos kihívás. Erre a hétre válassz másik feladatot.');
      if(!selected)await transaction.prepare('INSERT INTO weekly_challenges(user_id,week_start,kind,selected_at) VALUES(?,?,?,?)').bind(userId,week.start,choice.kind,now.toISOString()).run();
    }
    const current=await refreshWeeklyChallenge(transaction,userId,now,null,activity);
    const rewards=(await transaction.prepare('SELECT week_start,kind,completed_at FROM weekly_challenges WHERE user_id=? AND completed_at IS NOT NULL ORDER BY week_start DESC LIMIT 12').bind(userId).all()).results;
    const total=Number((await transaction.prepare('SELECT COUNT(*) AS total FROM weekly_challenges WHERE user_id=? AND completed_at IS NOT NULL').bind(userId).first()).total);
    return {week,options:WEEKLY_CHALLENGES.map(item=>({...item,available:item.id!=='three_days'||threeDaysAvailable})),current,rewards:rewards.map(row=>({weekStart:row.week_start,kind:row.kind,completedAt:row.completed_at})),totalRewards:total};
  });
}
