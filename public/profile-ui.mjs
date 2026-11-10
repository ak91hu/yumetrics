import { t, html, locale } from '/localization.mjs';
import { helpMarkup } from '/context-help.mjs';

const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const number = value => value == null ? '—' : new Intl.NumberFormat(locale(), { maximumFractionDigits: 1 }).format(value);
const date = day => new Intl.DateTimeFormat(locale(), { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(day.slice(0, 10) + 'T12:00:00Z'));
const quantity = (count, one, many) => count === 1 ? t(one) : t(many).replace('{0}', number(count));
const dayUnit = count => locale().startsWith('en') && count !== 1 ? t('napok') : t('nap');
let data;
let loadVersion = 0;
let challengePending = false;
let period = 30;
let profileRequest;
const plant = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M12 22V11M12 15C4 16 2 11 3 6c6-1 10 3 9 9ZM12 11c-1-7 3-9 9-9 1 6-3 10-9 9Z"/></svg>';
function weeklyMarkup(weekly) {
  return html`<div class="growth-week"><strong>Heti naplózás</strong><span>${escape(number(Math.min(weekly.activeDays, weekly.target)))} / ${weekly.target} ${escape(dayUnit(weekly.target))}</span><div class="growth-steps" aria-hidden="true">${Array.from({ length: weekly.target }, (_, i) => `<i class="${weekly.activeDays > i ? 'complete' : ''}">✓</i>`).join('')}</div><p>${escape(t(weekly.activeDays >= weekly.target ? 'Az elmúlt hét napból legalább három napon naplóztál.' : 'Az elmúlt 7 napból legalább 3 napon legyen mentett étkezésed.'))}</p></div>`;
}
const challengeMark = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z"/></svg>';
function challengeQuickMarkup(challenge) {
  const current=challenge.current, definition=challenge.options.find(item=>item.id===current.kind);
  return html`<div class="growth-week"><strong>${escape(t(definition.title))}</strong><span>${current.progress} / ${definition.target}</span><progress class="challenge-progress" aria-label="A heti kihívás haladása" value="${current.progress}" max="${definition.target}"></progress><p>${escape(t(current.completedAt?'A heti pecsétedet megszerezted!':'A választott kihívásod ezen a héten.'))}</p></div>`;
}
function challengesMarkup(challenge) {
  const {week,current,options,rewards,totalRewards}=challenge, selected=options.find(item=>item.id===current?.kind);
  return html`<section class="weekly-challenges" aria-labelledby="weekly-challenge-title"><div class="profile-section-heading"><h3 id="weekly-challenge-title" tabindex="-1">Heti kihívások</h3>${html(helpMarkup('weekly-challenge-help',t('A heti kihívások szabályai'),t('Hetente egy feladatot választhatsz. A hét hétfőtől vasárnapig, magyarországi idő szerint tart. Az adott hét korábbi mentései is számítanak, ha a bejegyzés dátuma erre a hétre esik, és nem jövőbeli. A külön lemért összetevőt a szerkesztőben jelöld meg; az étel össztömegének megadása önmagában nem elég. A háromnapos feladatnál a mentés napja számít. A heti haladásod és a megszerzett pecséted későbbi javítás vagy törlés után is megmarad.')))}</div><p class="profile-caption">${escape(date(week.start))} – ${escape(date(week.end))} · ${escape(t('Magyarországi idő szerint'))}</p>
    ${current?html`<div class="challenge-active ${current.completedAt?'challenge-complete':''}"><span class="challenge-mark" aria-hidden="true">${challengeMark}</span><h4>${escape(t(selected.title))}</h4><p>${escape(t(selected.description))}</p><label for="weekly-challenge-progress">${escape(t('Haladás:'))} ${current.progress} / ${selected.target}</label><progress id="weekly-challenge-progress" value="${current.progress}" max="${selected.target}"></progress><p class="challenge-status">${current.completedAt?t('Teljesítve · a heti pecséted megmarad.'):t('Az ezen a héten korábban mentett bejegyzések is beleszámítanak.')}</p>${current.completedAt?'':html`<p class="profile-caption">${escape(t(current.kind==='recipe'?'A saját receptet az étkezés részleteinél, a „Számítás saját receptből” résznél adhatod meg.':current.kind==='measured'?'Az étkezés részleteinél jelöld meg a külön lemért összetevőt, majd mentsd a bejegyzést.':'Egy napon legfeljebb egy lépést tehetsz meg. A mentés tényleges napját számoljuk, nem az étkezés átírt dátumát.'))}</p><button type="button" class="button outline" data-profile-day="${escape(data.statistics.period.end)}">Mai nap megnyitása</button>`}<p class="challenge-reward-line">${escape(t('Jutalom:'))} ${escape(t(selected.reward))} · ${escape(t('heti pecsét'))}</p></div>`:html`<form id="weekly-challenge-form"><fieldset><legend>Válassz egy feladatot erre a hétre</legend><div class="challenge-options">${options.map(option=>html`<label class="challenge-option"><input type="radio" name="kind" value="${escape(option.id)}" ${option.available===false?'disabled':''} required><span><strong>${escape(t(option.title))}</strong><span>${escape(t(option.description))}</span><small>${escape(t('Jutalom:'))} ${escape(t(option.reward))}</small>${option.available===false?html('<small>A korábbi mentésekkel együtt sincs elég nap a heti teljesítéshez.</small>'):''}</span></label>`).join('')}</div></fieldset><p class="profile-caption">A választásod erre a hétre szól; utána a következő héten választhatsz másikat.</p><button class="button primary" type="submit">Ezt a kihívást választom</button></form>`}
    <p id="weekly-challenge-feedback" class="profile-caption" role="status"></p>
    <details id="weekly-challenge-rewards" class="profile-disclosure"><summary>${escape(t('Heti pecsétjeim'))} · ${totalRewards}</summary>${rewards.length?html`<ul class="challenge-rewards">${rewards.map(reward=>{const definition=options.find(option=>option.id===reward.kind);return html`<li><span class="challenge-mark" aria-hidden="true">${challengeMark}</span><div><strong>${escape(t(definition.reward))}</strong><small>${escape(t('A hét kezdete:'))} ${escape(date(reward.weekStart))}</small></div></li>`;}).join('')}</ul><p class="profile-caption">A legutóbbi 12 pecsétet mutatjuk; az összes megszerzett jutalmad megmarad.</p>`:html('<p class="profile-caption">Az első teljesített heti kihívásod után itt találod a pecsétedet.</p>')}</details></section>`;
}
function growthMarkup(m) {
  return html`<section class="profile-growth" aria-labelledby="growth-title"><div class="growth-heading"><span class="growth-plant" aria-hidden="true">${plant}</span><div><span class="eyebrow">NAPLÓZÁS ÉS JELVÉNYEK</span><h3 id="growth-title">${escape(t(m.stage.name))}</h3><p>${escape(t`${m.level}. szint / ${m.levelCount}`)} · ${escape(quantity(m.activeDays, '1 aktív nap', '{0} aktív nap'))}</p></div></div>
    ${m.nextStage ? html`<label class="growth-next" for="growth-level-progress">${escape(t('Következő szint:'))} ${escape(t(m.nextStage.name))} · ${m.activeDays} / ${m.nextStage.days} ${escape(dayUnit(m.nextStage.days))}</label><progress id="growth-level-progress" value="${m.activeDays}" max="${m.nextStage.days}"></progress>` : html`<p class="growth-next">Elérted a legmagasabb szintet.</p>`}
    ${weeklyMarkup(m.weekly)}<p class="profile-caption">Minden olyan nap számít, amelyre mentettél étkezést, a régebbiek is. A kihagyás nem törli a korábban elért szintet.</p>
    <div class="profile-section-heading"><h3>Jelvényeid</h3><span>${m.badges.filter(badge => badge.earned).length} / ${m.badges.length} ${escape(t('megszerezve'))}</span></div><ul class="growth-badges">${m.badges.map(badge => `<li class="growth-badge ${badge.earned ? 'earned' : ''}" data-badge="${badge.id}" data-earned="${badge.earned}"><img class="growth-badge-image" src="/badges/${escape(badge.id)}.png" width="96" height="96" alt="" loading="lazy" decoding="async"><strong>${escape(t(badge.name))}</strong><span>${escape(badge.days === 1 ? t('1 nap naplózva') : t`${badge.days} különböző nap naplózva`)}</span><small>${escape(t(badge.earned ? 'Megszerezve' : 'Még előtted áll'))}</small></li>`).join('')}</ul>
    <p class="profile-caption">A szintek és jelvények a mentett étkezési napjaidhoz igazodnak. Bejegyzés törlése vagy dátumának módosítása után az eredmény is változhat.</p><button type="button" class="button outline" data-action="log-today">Mai étkezés naplózása</button></section>`;
}
export function renderMotivation() {
  const root = document.querySelector('#motivation-card');
  if (!data || !root) return;
  const m = data.statistics.motivation;
  root.innerHTML = html`<div class="growth-heading"><span class="growth-plant" aria-hidden="true">${plant}</span><div><span class="eyebrow">NAPLÓZÁS ÉS JELVÉNYEK</span><h2>${escape(t(m.stage.name))} <small>${escape(t`${m.level}. szint`)}</small></h2><p>${escape(t(m.weekly.todayLogged ? 'Ma már naplóztál étkezést.' : 'Ments el egy mai étkezést, hogy ez a nap is bekerüljön az összesítésbe.'))}</p></div></div>${data.weeklyChallenge?.current?challengeQuickMarkup(data.weeklyChallenge):weeklyMarkup(m.weekly)}<div class="growth-actions"><button type="button" class="button primary" data-action="log-today">Mai étkezés naplózása</button><button type="button" class="text-button" data-action="settings">Heti kihívások <span aria-hidden="true">↗</span></button></div>`;
  root.hidden = false;
}
const metric = (label, value, unit = '') => `<div class="profile-stat"><strong>${escape(number(value))}<small>${escape(unit)}</small></strong><span>${escape(t(label))}</span></div>`;
function renderPeriod() {
  if (!data) return;
  const s = data.statistics, selected = s.periods[period];
  document.querySelector('#profile-period').value = String(period);
  document.querySelector('#profile-period-content').innerHTML = html`
    <p class="profile-caption">${escape(date(selected.start))} – ${escape(date(selected.end))}</p>
    <div class="profile-stats">${metric('Energia naplózott naponként', selected.averagePerLoggedDay.calories, 'kcal')}${metric('Fehérje naplózott naponként', selected.averagePerLoggedDay.protein, 'g')}${metric('Szénhidrát naplózott naponként', selected.averagePerLoggedDay.carbs, 'g')}${metric('Zsír naplózott naponként', selected.averagePerLoggedDay.fat, 'g')}</div>
    <div class="profile-period-facts"><span>${escape(quantity(selected.activeDays, '1 aktív nap', '{0} aktív nap'))} / ${escape(number(period))} ${escape(t(locale().startsWith('en') ? 'napok' : 'nap'))}</span><span>${escape(quantity(selected.mealCount, '1 étkezés az időszakban', '{0} étkezés az időszakban'))}</span><span>${escape(t('Étkezés / aktív nap:'))} ${escape(number(selected.averageMealsPerDay))}</span></div>
    ${selected.mealCount ? '' : html`<p class="profile-empty">Ebben az időszakban még nincs mentett étkezés. Válassz hosszabb időszakot, vagy adj hozzá ételt a naplódhoz.</p>`}
    <details class="profile-disclosure" id="profile-nutrition-details"><summary>Étkezésenkénti átlag és bontás</summary><div class="profile-stats">${metric('Energia étkezésenként', selected.averagePerMeal.calories, 'kcal')}${metric('Fehérje étkezésenként', selected.averagePerMeal.protein, 'g')}${metric('Szénhidrát étkezésenként', selected.averagePerMeal.carbs, 'g')}${metric('Zsír étkezésenként', selected.averagePerMeal.fat, 'g')}</div><div class="profile-table-scroll"><table class="profile-table"><caption>Étkezéstípusok a kiválasztott időszakban</caption><thead><tr><th scope="col">Étkezéstípus</th><th scope="col">Étkezések</th><th scope="col">Átlagos energia / étkezés</th></tr></thead><tbody>${selected.mealTypes.map(group => `<tr><th scope="row">${escape(t(group.type))}</th><td>${escape(number(group.count))}</td><td>${escape(number(group.averageCalories))} kcal</td></tr>`).join('')}</tbody></table></div></details>`;
}
export function renderAvatar(element, profile) {
  element.textContent = profile.name.trim().split(/\s+/).slice(0, 2).map(part => [...part][0] || '').join('').toUpperCase();
  element.setAttribute('aria-hidden', 'true');
  let url;
  try { url = new URL(profile.avatarUrl); } catch { return; }
  if (url.protocol !== 'https:' || !url.hostname.endsWith('.googleusercontent.com') || url.username || url.password) return;
  const image = document.createElement('img');
  image.alt = ''; image.referrerPolicy = 'no-referrer';
  image.addEventListener('error', () => image.remove(), { once: true });
  image.src = url.href; element.append(image);
}
export async function loadProfile(request, { quiet = false, celebrate = false } = {}) {
  profileRequest=request;
  if (challengePending) return;
  const root = document.querySelector('#profile-summary');
  const version = ++loadVersion, previous = data?.statistics.motivation, previousChallenge=data?.weeklyChallenge;
  if (!quiet) { root.setAttribute('aria-busy', 'true'); root.textContent = t('Statisztikák betöltése…'); }
  try {
    const result = await request('/api/profile?timezone=' + encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone));
    if (version !== loadVersion) return;
    data = result; renderMotivation();
    if (!quiet || document.querySelector('#settings-dialog').open) renderProfile();
    if (celebrate && previous) {
      if(data.weeklyChallenge?.current?.completedAt&&!previousChallenge?.current?.completedAt)return t('Teljesítetted a heti kihívásodat! Új pecsétet szereztél.');
      const m = data.statistics.motivation;
      const badge = m.badges.findLast(badge => badge.earned && !previous.badges.some(old => old.id === badge.id && old.earned));
      if (badge) return t('Új jelvényt szereztél! Elmentettük az étkezésedet.');
      if (previous.weekly.activeDays < m.weekly.target && m.weekly.activeDays >= m.weekly.target) return t('Elmentettük az étkezésedet. A heti naplózási célod is teljesült!');
    }
  }
  catch (error) {
    if (version !== loadVersion) return;
    data = null;
    if (!quiet) root.textContent = error.message;
    document.querySelector('#motivation-card').hidden = true;
  }
  finally { if (version === loadVersion) root.setAttribute('aria-busy', 'false'); }
}
export function renderProfile() {
  if (!data) return;
  const openSections = [...document.querySelectorAll('#profile-summary details[open]')].map(element => element.id);
  const pendingChoice=document.querySelector('#weekly-challenge-form [name=kind]:checked')?.value;
  const { profile, statistics: s } = data, life = s.lifetime;
  const today = s.calendar.at(-1), remaining = today.calories == null ? null : profile.calorieGoal - today.calories;
  const offset = (new Date(s.period.start + 'T12:00:00Z').getUTCDay() + 6) % 7;
  const cells = s.calendar.map((day, index) => {
    const description = `${date(day.day)} · ${quantity(day.count, '1 naplózott étkezés', '{0} naplózott étkezés')}${day.calories == null ? '' : ` · ${number(day.calories)} kcal`}`;
    return `<button type="button" class="activity-day" data-level="${Math.min(4, day.count)}" data-profile-day="${day.day}" data-summary="${escape(description)}" tabindex="${index === s.calendar.length - 1 ? 0 : -1}" aria-label="${escape(description)}" title="${escape(description)}"${day.day === s.period.end ? ' aria-current="date"' : ''}></button>`;
  });
  const weeks = Math.ceil((offset + cells.length) / 7);
  const months = Array.from({ length: weeks }, (_, week) => {
    const days = s.calendar.slice(Math.max(0, week * 7 - offset), Math.min(s.calendar.length, (week + 1) * 7 - offset));
    const first = days.find(day => day.day.endsWith('-01')) || (week === 0 ? days[0] : null);
    return `<span>${first ? escape(new Intl.DateTimeFormat(locale(), { month: 'short', timeZone: 'UTC' }).format(new Date(first.day + 'T12:00:00Z'))) : ''}</span>`;
  }).join('');
  document.querySelector('#profile-summary').innerHTML = html`
    <div class="profile-identity"><span class="profile-initials" aria-hidden="true"></span><div><h3>${escape(profile.name)}</h3><p>${escape(profile.email)}</p><small>Google-fiókkal bejelentkezve</small></div></div>
    <section class="profile-today" aria-labelledby="profile-today-title"><div class="profile-section-heading"><h3 id="profile-today-title">Mai összesítés</h3><span>${escape(date(s.period.end))}</span></div><p class="profile-energy"><strong>${escape(number(today.calories))}</strong> / ${escape(number(profile.calorieGoal))} kcal</p><label class="sr-only" for="profile-energy-progress">A mai naplózott energia a napi kerethez képest</label><progress id="profile-energy-progress" max="${profile.calorieGoal}" value="${today.calories ?? 0}"></progress><p class="profile-caption">${today.count ? escape(quantity(today.count, '1 naplózott étkezés', '{0} naplózott étkezés')) + ' · ' + escape(remaining >= 0 ? t`${number(remaining)} kcal a beállított keretig` : t`${number(-remaining)} kcal a beállított keret felett`) : t('Ma még nem mentettél étkezést. Ebből nem következik, hogy nem ettél.')}</p><button type="button" class="text-button" data-profile-day="${s.period.end}">Mai nap megnyitása</button><a class="text-button" href="#calorie-goal">Energiakeret módosítása</a></section>
    ${data.weeklyChallenge?challengesMarkup(data.weeklyChallenge):''}
    ${growthMarkup(s.motivation)}
    <h3 class="profile-section-title">A naplód eddig</h3>
    <div class="profile-stats">${metric('Mentett étkezés', life.mealCount)}${metric('Aktív nap', life.activeDays)}${metric('Jelenlegi sorozat', life.currentStreak, dayUnit(life.currentStreak))}${metric('Leghosszabb sorozat', life.longestStreak, dayUnit(life.longestStreak))}</div>
    <p class="profile-caption">Az egymást követő naplózott napok alkotnak egy sorozatot. Ha ma még nem mentettél étkezést, a tegnapig tartó sorozatot mutatjuk.</p>
    <div class="profile-section-heading"><h3 id="profile-period-title">Táplálkozási áttekintés</h3><label class="profile-period-label" for="profile-period">Időszak<select id="profile-period"><option value="7">7 nap</option><option value="30">30 nap</option><option value="365">365 nap</option></select></label></div>
    <section id="profile-period-content" aria-labelledby="profile-period-title" aria-live="polite"></section>
    <p class="profile-method">Az átlagokat a naplózott napok becsült tápértékeiből számoljuk. A bejegyzés nélküli napokat nem vesszük figyelembe.</p>
    <details class="profile-disclosure" id="profile-daily-details"><summary>Az elmúlt 7 nap részletesen</summary><p class="profile-caption">Válassz egy napot a hozzá tartozó bejegyzések megnyitásához. Csak a mentett étkezések szerepelnek az összesítésben.</p><ul class="profile-day-list">${s.calendar.slice(-7).reverse().map(day => `<li><button type="button" data-profile-day="${day.day}"><span>${escape(date(day.day))}<small>${escape(quantity(day.count, '1 naplózott étkezés', '{0} naplózott étkezés'))}</small></span><strong>${escape(number(day.calories))} kcal <span aria-hidden="true">→</span></strong></button></li>`).join('')}</ul></details>
    <div class="profile-section-heading"><h3>Naplózási aktivitás</h3><span>${escape(date(s.period.start))} – ${escape(date(s.period.end))}</span></div>
    <p class="profile-caption">A zöld szín erőssége az adott napra mentett étkezések számát jelzi. Válassz egy napot a hozzá tartozó bejegyzések megnyitásához.</p>
    <p class="sr-only" id="activity-instructions">A naptárban a nyílbillentyűkkel is lépkedhetsz. A Home az első, az End az utolsó napra visz.</p>
    <div class="activity-scroll" tabindex="0" role="region" aria-label="Egyéves naplózási aktivitás"><div class="activity-months" style="--weeks:${weeks}">${months}</div><div class="activity-grid" role="group" aria-label="Aktív napok" aria-describedby="activity-instructions">${'<span aria-hidden="true"></span>'.repeat(offset)}${cells.join('')}</div></div>
    <div class="activity-legend"><span>Kevesebb</span>${[0, 1, 2, 3, 4].map(level => `<i data-level="${level}" aria-hidden="true"></i>`).join('')}<span>Több</span></div>
    <p class="activity-day-detail" id="activity-day-detail" aria-live="polite">${escape(cells.length ? t('A teljes év megtekintéséhez görgess oldalra.') : '')}</p>
    ${life.lastLoggedDay ? `<p class="profile-caption">${escape(t('Legutóbbi naplózott nap:'))} ${escape(date(life.lastLoggedDay))}</p>` : html`<p class="profile-empty">Az első étkezés mentése után itt láthatod a naplód összesítéseit.</p>`}
    <details class="profile-disclosure" id="profile-account-details"><summary>Fiókadatok és időzóna</summary><dl class="profile-account"><div><dt>Bejelentkezés</dt><dd>Google</dd></div><div><dt>Csatlakozás</dt><dd>${escape(date(profile.joinedAt))}</dd></div><div><dt>Időzóna</dt><dd>${escape(s.timeZone)}</dd></div></dl></details>`;
  renderPeriod();
  const challengeButton = document.querySelector('#weekly-challenge-form button[type=submit]');
  if (challengeButton) challengeButton.disabled = challengePending;
  for(const radio of document.querySelectorAll('#weekly-challenge-form [name=kind]'))radio.checked=!radio.disabled&&radio.value===pendingChoice;
  for (const id of openSections) { const section = document.getElementById(id); if (section) section.open = true; }
  renderAvatar(document.querySelector('.profile-initials'), profile);
  const scroll = document.querySelector('.activity-scroll'); scroll.scrollLeft = scroll.scrollWidth;
}

document.addEventListener('change', event => {
  if (event.target.id !== 'profile-period') return;
  period = Number(event.target.value); renderPeriod();
});
document.addEventListener('submit',async event=>{
  if(event.target.id!=='weekly-challenge-form')return;
  event.preventDefault();if(challengePending)return;
  const form=event.target,button=form.querySelector('button[type=submit]'),version=++loadVersion;
  challengePending=true;button.disabled=true;
  try{
    const result=await profileRequest('/api/weekly-challenge',{method:'POST',body:JSON.stringify({kind:new FormData(form).get('kind'),weekStart:data.weeklyChallenge.week.start})});
    if(version!==loadVersion)return;
    data.weeklyChallenge=result;renderMotivation();renderProfile();
    document.querySelector('#weekly-challenge-feedback').textContent=t(result.current?.completedAt?'Teljesítetted a heti kihívásodat! Új pecsétet szereztél.':'A heti kihívásod elindult. A haladásodat itt követheted.');
    document.querySelector('#weekly-challenge-title').focus({preventScroll:true});
  }catch(error){if(version===loadVersion)document.querySelector('#weekly-challenge-feedback').textContent=error.message;}
  finally{challengePending=false;button.disabled=false;if(version===loadVersion)document.querySelector('#profile-summary').setAttribute('aria-busy','false');await loadProfile(profileRequest,{quiet:true});}
});
document.addEventListener('keydown', event => {
  const button = event.target.closest('.activity-day'); if (!button) return;
  const buttons = [...document.querySelectorAll('.activity-day')], index = buttons.indexOf(button);
  const target = { ArrowUp: index - 1, ArrowDown: index + 1, ArrowLeft: index - 7, ArrowRight: index + 7, Home: 0, End: buttons.length - 1 }[event.key];
  if (target == null) return;
  event.preventDefault(); const next = buttons[Math.max(0, Math.min(buttons.length - 1, target))]; button.tabIndex = -1; next.tabIndex = 0; next.focus();
});
for (const event of ['focusin', 'mouseover']) document.addEventListener(event, value => {
  const button = value.target.closest('.activity-day'); if (button) document.querySelector('#activity-day-detail').textContent = button.dataset.summary;
});
