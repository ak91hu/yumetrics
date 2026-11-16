import { readFileSync } from 'node:fs';

const logo = 'data:image/png;base64,' + readFileSync(new URL('../public/email-logo.png', import.meta.url)).toString('base64');
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function renderWeeklyReport(data, { language='hu', origin, unsubscribeUrl=null, preview=false } = {}) {
  const en=language==='en', tr=(hu,english)=>en?english:hu;
  const n=value=>value==null?'—':new Intl.NumberFormat(en?'en-GB':'hu-HU',{maximumFractionDigits:1}).format(value);
  const date=d=>new Intl.DateTimeFormat(en?'en-GB':'hu-HU',{month:'short',day:'numeric',timeZone:'UTC'}).format(new Date(d+'T12:00:00Z'));
  const weekday=d=>new Intl.DateTimeFormat(en?'en-GB':'hu-HU',{weekday:'short',timeZone:'UTC'}).format(new Date(d+'T12:00:00Z'));
  const {current:c,previous:p,user}=data;
  const subject=tr(`Így alakult a heted · ${date(c.start)} – ${date(c.end)} · Yumetrics`,`Your week in review · ${date(c.start)} – ${date(c.end)} · Yumetrics`);
  const change=(a,b)=>{
    if(a==null||b==null)return tr('Az összehasonlításhoz még nincs elég adat.','There is not enough data to compare yet.');
    const delta=Math.round((a-b)*10)/10;
    if(delta===0)return tr('Ugyanannyi, mint az előző héten.','The same as last week.');
    const percent=b>0?` (${n(Math.abs(delta)/b*100)}%)`:'';
    return en?`${n(Math.abs(delta))} kcal${percent} ${delta>0?'more':'less'} than last week.`:
      `${n(Math.abs(delta))} kcal-val${percent} ${delta>0?'több':'kevesebb'}, mint az előző héten.`;
  };
  const totalChange=change(c.loggedDays?c.totals.calories:null,p.loggedDays?p.totals.calories:null);
  const averageChange=change(c.average.calories,p.average.calories);
  const coverage=tr(`${c.loggedDays} napon összesen ${c.mealCount} étkezést mentettél.`,`${c.mealCount} meals saved across ${c.loggedDays} days.`);
  const previousCoverage=tr(`Előző héten: ${p.loggedDays} nap, ${p.mealCount} étkezés.`,`Last week: ${p.loggedDays} days, ${p.mealCount} meals.`);
  const periodNote=preview?tr('Ez a hét még tart: csak a mai nap eddigi bejegyzéseit vettük figyelembe. Az előző hétnél is ugyaneddig a napig és időpontig számoltunk. A vasárnapi email este 8-kor készül, magyarországi idő szerint.',
    'This week is still in progress: only entries up to the current time are included. Last week uses the same weekday and time. Your weekly email is prepared on Sunday at 8 pm, Europe/Budapest.'):
    tr('A hétfőtől vasárnap este 8-ig elmentett étkezéseidet néztük meg. Az előző hétnél is eddig az időpontig számoltunk. Az időpontok magyarországi idő szerint értendők.',
    'This report covers meals saved from Monday to Sunday at 8 pm. Last week uses the same cutoff. All times are in Europe/Budapest.');
  const note=tr('Az email azt mutatja, amit beírtál a naplóba. Ha egy napra nem mentettél étkezést, nem tudjuk, mennyit ettél. Az átlagot csak azokra a napokra számoljuk, amelyekre van bejegyzés. A kalóriaértékek becslések; a változásból nem lehet testsúlyváltozásra következtetni.',
    'This email reflects what you recorded. If a day has no entries, we do not know how much you ate. Averages include only days with entries. Calories are estimates; these changes do not tell us whether your weight changed.');
  const scale=Math.max(1,...c.days.map(d=>d.calories||0),...p.days.map(d=>d.calories||0));
  const bar=(value,color)=>{
    if(value==null)return `<span style="color:#758171;font-size:12px">${tr('Nincs bejegyzés','No entries')}</span>`;
    if(value===0)return '<span style="color:#758171;font-size:12px">0 kcal</span>';
    const width=Math.max(1,Math.round(value/scale*100));
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="table-layout:fixed"><tr><td width="${width}%" height="12" bgcolor="${color}" style="background:${color};border-radius:4px;line-height:12px;font-size:1px">&nbsp;</td>${width<100?`<td width="${100-width}%"></td>`:''}</tr></table>`;
  };
  const dailyRows=c.days.map((d,i)=>`<tr><td style="width:56px;padding:12px 8px 12px 0;vertical-align:top"><strong style="font-size:13px;text-transform:capitalize">${esc(weekday(d.day))}</strong><br><span style="font-size:11px;color:#758171">${esc(date(d.day))}</span></td><td style="padding:12px 0;vertical-align:middle">${bar(d.calories,'#40543a')}<div style="height:5px;line-height:5px">&nbsp;</div>${bar(p.days[i].calories,'#c6d0b5')}</td><td style="width:76px;padding:12px 0 12px 8px;text-align:right;vertical-align:top;font-size:12px;line-height:20px"><strong>${n(d.calories)}</strong><br><span style="color:#758171">${n(p.days[i].calories)}</span></td></tr>`).join('');
  const mealLabel=type=>en?({'Reggeli':'Breakfast','Ebéd':'Lunch','Vacsora':'Dinner','Kisétkezés':'Snacks'}[type]||type):type;
  const typeRows=c.types.map(t=>`<tr><td style="padding:12px 0;border-bottom:1px solid #e8ebdf;font-size:14px">${esc(mealLabel(t.type))}<br><small style="color:#758171">${t.mealCount} ${tr('étkezés','meals')}</small></td><td style="width:40%;padding:12px 12px;border-bottom:1px solid #e8ebdf">${t.calories>0?`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="table-layout:fixed"><tr><td width="${Math.max(1,Math.round(t.calories/Math.max(1,c.totals.calories)*100))}%" height="10" bgcolor="#b18d50" style="border-radius:4px;background:#b18d50;line-height:10px;font-size:1px">&nbsp;</td><td></td></tr></table>`:''}</td><td align="right" style="padding:12px 0;border-bottom:1px solid #e8ebdf;font-size:13px;white-space:nowrap">${n(t.calories)} kcal</td></tr>`).join('');
  const macros=[['protein',tr('Fehérje','Protein')],['carbs',tr('Szénhidrát','Carbs')],['fat',tr('Zsír','Fat')]];
  const macroRows=macros.map(([k,label])=>`<tr><td style="padding:13px 0;border-bottom:1px solid #e8ebdf;font-size:14px">${label}</td><td align="right" style="padding:13px 8px;border-bottom:1px solid #e8ebdf;font-size:14px"><strong>${n(c.average[k])} g</strong></td><td align="right" style="padding:13px 0;border-bottom:1px solid #e8ebdf;font-size:14px;color:#758171">${n(p.average[k])} g</td></tr>`).join('');
  const heading=(index,title,description)=>`<p style="color:#967542;font-size:11px;letter-spacing:2px;margin:28px 0 6px">${index}</p><h2 style="font-size:22px;line-height:1.25;margin:0 0 10px;color:#35472f">${title}</h2><p style="font-size:13px;color:#65715e;margin:0 0 18px">${description}</p>`;
  const badge=(label,color)=>`<span style="color:${color};font-size:18px;vertical-align:middle">■</span> <span style="font-size:12px">${label}</span>`;
  const footer=tr('A heti emailt a Fiókom menüben bármikor kikapcsolhatod.','You can turn off weekly emails in My account at any time.');
  const html=`<!doctype html>
<html lang="${en?'en':'hu'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#f0f1e8;font-family:Arial,Helvetica,sans-serif;color:#35472f;line-height:1.5">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all">${esc(tr('A heti kalóriáid és a változás az előző héthez képest, egy helyen.','Your weekly calories and changes from last week, all in one place.'))}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="620" cellpadding="0" cellspacing="0" style="width:100%;max-width:620px;background:#ffffff;border-radius:18px;overflow:hidden">
<tr><td height="6" bgcolor="#40543a" style="background:#40543a;border-radius:18px 18px 0 0;font-size:1px;line-height:6px">&nbsp;</td></tr>
<tr><td style="padding:28px 24px 24px;background:#f9f8ef">
<a href="${esc(origin)}/" style="text-decoration:none"><img src="${logo}" width="190" height="48" alt="Yumetrics" style="display:block;width:190px;height:48px;max-width:100%;border:0"></a>
<p style="margin:26px 0 9px;color:#967542;font-size:11px;letter-spacing:2px">${tr('A HETI ÖSSZEFOGLALÓD','YOUR WEEKLY REVIEW')}</p>
<h1 style="font-size:32px;line-height:1.15;letter-spacing:-1px;color:#35472f;margin:0 0 14px">${tr('Nézd meg, hogyan<br>alakult a heted.','See how your<br>week added up.')}</h1>
<span style="display:inline-block;padding:6px 12px;border:1px solid #d8dfcc;border-radius:20px;font-size:13px;color:#526547">${esc(date(c.start))} – ${esc(date(c.end))}</span>
</td></tr>
<tr><td style="padding:8px 24px 24px">
<p style="font-size:17px;margin:22px 0 8px">${tr('Szia','Hi')} ${esc(user.name)}!</p>
<p style="font-size:14px;color:#65715e;margin:0 0 20px">${tr('Összegyűjtöttük a héten elmentett étkezéseidet. Itt láthatod a napi kalóriákat és azt, mi változott az előző héthez képest.','Here are the meals you saved this week. See your daily calories and what changed compared with last week.')}</p>
${preview?`<p style="padding:12px;background:#fff3d9;border-radius:8px;font-size:13px">${tr('Előnézet: az aktuális hét eddig mentett adatai. Ez az oldal nem küld emailt.','Preview: entries saved so far this week. This page does not send an email.')}</p>`:''}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:20px;background:#40543a;border-radius:12px;color:#fff9e9">
<p style="font-size:13px;margin:0 0 6px;color:#e0e8d6">${tr('A héten összesen ennyit rögzítettél','Total calories you recorded this week')}</p>
<p style="font-size:36px;line-height:1.2;font-weight:bold;letter-spacing:-1px;margin:0 0 12px">${n(c.totals.calories)} <span style="font-size:16px;font-weight:normal;letter-spacing:0">kcal</span></p>
<p style="font-size:14px;margin:0;color:#e0e8d6">${esc(totalChange)}</p>
</td></tr></table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:20px 0;border-bottom:1px solid #e8ebdf">
<p style="font-size:13px;margin:0 0 4px;color:#65715e">${tr('Napi átlagod','Your daily average')}</p><p style="font-size:27px;line-height:1.2;font-weight:bold;margin:0 0 8px">${n(c.average.calories)} <span style="font-size:14px;font-weight:normal">kcal</span></p>
<p style="font-size:13px;color:#65715e;margin:0">${esc(averageChange)}</p><p style="font-size:12px;color:#758171;margin:6px 0 0">${tr('Csak azokra a napokra számolva, amelyekre mentettél étkezést.','Calculated only for days with saved meals.')}</p>
</td></tr></table>
<p style="font-size:14px;margin:18px 0 5px"><strong>${esc(coverage)}</strong></p><p style="font-size:13px;color:#65715e;margin:0">${esc(previousCoverage)}</p>
${c.loggedDays!==p.loggedDays?`<p style="font-size:13px;background:#f9f4e7;padding:12px;border-radius:8px">${tr('A két héten nem ugyanannyi napot rögzítettél. Ez is befolyásolja a különbséget.','You recorded a different number of days each week. This also affects the comparison.')}</p>`:''}
${heading('01',tr('Kalóriák, napról napra','Calories, day by day'),tr('A sötét oszlop ezt a hetet, a világos az előző hét azonos napját mutatja.','Dark bars show this week; light bars show the same weekday last week.'))}
<p style="margin:0 0 6px">${badge(tr('Ez a hét','This week'),'#40543a')} &nbsp; ${badge(tr('Előző hét','Last week'),'#c6d0b5')}</p>
<table width="100%" cellpadding="0" cellspacing="0" aria-label="${tr('Napi kalóriák összehasonlítása','Daily calorie comparison')}"><tr><td colspan="2"></td><th align="right" style="font-weight:normal;font-size:11px;color:#758171">kcal</th></tr>${dailyRows}</table>
<p style="font-size:12px;color:#758171;margin:8px 0 0">${tr('A „nincs bejegyzés” nem azt jelenti, hogy aznap nem ettél.','“No entries” does not mean you ate nothing that day.')}</p>
${heading('02',tr('Fehérje, szénhidrát és zsír','Protein, carbs and fat'),tr('Napi átlag, csak az étkezést tartalmazó napokra számolva.','Daily averages, calculated only for days with saved meals.'))}
<table width="100%" cellpadding="0" cellspacing="0"><tr><th align="left" style="font-size:11px;color:#758171;font-weight:normal">${tr('Tápanyag','Nutrient')}</th><th align="right" style="font-size:11px;color:#40543a;font-weight:normal;padding-right:8px">${tr('Ez a hét','This week')}</th><th align="right" style="font-size:11px;color:#758171;font-weight:normal">${tr('Előző hét','Last week')}</th></tr>${macroRows}</table>
${heading('03',tr('Melyik étkezés mennyit adott hozzá?','Where did your calories come from?'),tr('Az összes heti kalória reggelire, ebédre, vacsorára és kisétkezésre bontva.','Your weekly calories split between breakfast, lunch, dinner and snacks.'))}
<table width="100%" cellpadding="0" cellspacing="0">${typeRows}</table>
<p style="padding:14px;background:#f3f5ed;border-radius:10px;font-size:13px;margin:22px 0">${tr('A naplódban megadott napi kereted','The daily goal you set in your diary')}: <strong>${n(user.calorie_goal)} kcal</strong>.<br><span style="color:#65715e">${tr('Ezt te állítottad be; nem személyre szabott étrendi ajánlás.','You set this number; it is not personalised dietary advice.')}</span></p>
<table role="presentation" cellpadding="0" cellspacing="0"><tr><td bgcolor="#40543a" style="background:#40543a;border-radius:8px"><a href="${esc(origin)}/" style="display:inline-block;padding:14px 22px;color:#fff9e9;text-decoration:none;font-size:14px;font-weight:bold">${tr('Megnézem a naplómat','Open my diary')} →</a></td></tr></table>
<p style="font-size:12px;color:#758171;margin:22px 0 8px">${esc(periodNote)}</p><p style="font-size:12px;color:#758171;margin:0">${esc(note)}</p>
</td></tr>
<tr><td style="padding:20px 24px;background:#f9f8ef;border-top:1px solid #e8ebdf;border-radius:0 0 18px 18px"><p style="font-size:12px;color:#65715e;margin:0 0 8px">${footer}</p>${unsubscribeUrl?`<a href="${esc(unsubscribeUrl)}" style="font-size:12px;color:#40543a">${tr('Nem kérek több heti emailt','Unsubscribe from weekly emails')}</a>`:''}<p style="font-size:11px;color:#758171;margin:14px 0 0">Yumetrics · your food, in numbers</p></td></tr>
</table></td></tr></table></body></html>`;
  const text=[subject,`${tr('Szia','Hi')} ${user.name}!`,tr('Heti összes kalória','Total weekly calories')+`: ${n(c.totals.calories)} kcal`,totalChange,
    tr('Napi átlag','Daily average')+`: ${n(c.average.calories)} kcal`,averageChange,coverage,previousCoverage,
    ...c.days.map((d,i)=>`${weekday(d.day)} (${d.day}): ${n(d.calories)} kcal; ${tr('előző hét','last week')}: ${n(p.days[i].calories)} kcal`),
    ...macros.map(([k,label])=>`${label}: ${n(c.average[k])} g; ${tr('előző hét','last week')}: ${n(p.average[k])} g`),
    ...c.types.map(t=>`${mealLabel(t.type)}: ${n(t.calories)} kcal`),periodNote,note,`${origin}/`,footer,unsubscribeUrl||''].join('\n');
  return {subject,html,text};
}
