import { t, html, locale } from '/localization.mjs';

const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const number = value => value == null ? '—' : new Intl.NumberFormat(locale(), { maximumFractionDigits: 1 }).format(value);
const date = day => new Intl.DateTimeFormat(locale(), { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(day.slice(0, 10) + 'T12:00:00Z'));
const quantity = (count, one, many) => count === 1 ? t(one) : t(many).replace('{0}', number(count));
let data;
export async function loadProfile(request) {
  const root = document.querySelector('#profile-summary');
  data = null; root.setAttribute('aria-busy', 'true'); root.textContent = t('A statisztikák betöltése folyamatban…');
  try { data = await request('/api/profile?timezone=' + encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone)); renderProfile(); }
  catch (error) { root.textContent = error.message; }
  finally { root.setAttribute('aria-busy', 'false'); }
}
export function renderProfile() {
  if (!data) return;
  const { profile, statistics: s } = data, life = s.lifetime, recent = s.recent;
  const initials = profile.name.trim().split(/\s+/).slice(0, 2).map(part => [...part][0] || '').join('').toUpperCase();
  const metric = (label, value, unit = '') => `<div class="profile-stat"><strong>${escape(number(value))}<small>${escape(unit)}</small></strong><span>${escape(t(label))}</span></div>`;
  const dayUnit = count => locale().startsWith('en') && count !== 1 ? t('napok') : t('nap');
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
    <div class="profile-identity"><span class="profile-initials" aria-hidden="true">${escape(initials)}</span><div><h3>${escape(profile.name)}</h3><p>${escape(profile.email)}</p><small>Csatlakozás: ${escape(new Intl.DateTimeFormat(locale(), { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(profile.joinedAt)))}</small></div></div>
    <h3 class="profile-section-title">A naplód eddig</h3>
    <div class="profile-stats">${metric('Mentett étkezés', life.mealCount)}${metric('Aktív nap', life.activeDays)}${metric('Jelenlegi sorozat', life.currentStreak, dayUnit(life.currentStreak))}${metric('Leghosszabb sorozat', life.longestStreak, dayUnit(life.longestStreak))}</div>
    <p class="profile-caption">A sorozat egymást követő, naplózott napokat jelent. Ha ma még nem naplóztál, a tegnapig tartó sorozatod látszik.</p>
    <div class="profile-section-heading"><h3>Naplózási aktivitás</h3><span>${escape(date(s.period.start))} – ${escape(date(s.period.end))}</span></div>
    <p class="profile-caption">A zöld árnyalat az adott napra mentett étkezések számát jelzi. Válassz napot a bejegyzései megnyitásához.</p>
    <p class="sr-only" id="activity-instructions">A naptárban a nyílbillentyűkkel is lépkedhetsz. A Home az első, az End az utolsó napra visz.</p>
    <div class="activity-scroll" tabindex="0" role="region" aria-label="Egyéves naplózási aktivitás"><div class="activity-months" style="--weeks:${weeks}">${months}</div><div class="activity-grid" role="group" aria-label="Aktív napok" aria-describedby="activity-instructions">${'<span aria-hidden="true"></span>'.repeat(offset)}${cells.join('')}</div></div>
    <div class="activity-legend"><span>Kevesebb</span>${[0, 1, 2, 3, 4].map(level => `<i data-level="${level}" aria-hidden="true"></i>`).join('')}<span>Több</span></div>
    <p class="activity-day-detail" id="activity-day-detail" aria-live="polite">${escape(cells.length ? t('A teljes év megtekintéséhez görgess oldalra.') : '')}</p>
    <h3 class="profile-section-title">Az elmúlt 365 nap átlaga</h3>
    <div class="profile-stats">${metric('Energia naplózott naponként', recent.averagePerLoggedDay.calories, 'kcal')}${metric('Fehérje naplózott naponként', recent.averagePerLoggedDay.protein, 'g')}${metric('Szénhidrát naplózott naponként', recent.averagePerLoggedDay.carbs, 'g')}${metric('Zsír naplózott naponként', recent.averagePerLoggedDay.fat, 'g')}</div>
    <p class="profile-caption">${escape(quantity(recent.activeDays, '1 aktív nap', '{0} aktív nap'))} · ${escape(quantity(recent.mealCount, '1 étkezés az időszakban', '{0} étkezés az időszakban'))}${recent.averageMealsPerDay == null ? '' : escape(' · ' + quantity(recent.averageMealsPerDay, '1 étkezés naplózott naponként', '{0} étkezés naplózott naponként'))}</p>
    ${life.lastLoggedDay ? `<p class="profile-caption">${escape(t('Legutóbbi naplózott nap:'))} ${escape(date(life.lastLoggedDay))}</p>` : html`<p class="profile-empty">Még nincs mentett étkezésed. Az első mentés után itt jelennek meg a saját statisztikáid.</p>`}
    <p class="profile-method">Az átlagok csak a naplózott napokra vonatkoznak. Egy hiányzó nap nem jelent nulla fogyasztást. A tápértékek a mentett bejegyzések becsült értékei.</p>
    <p class="profile-caption">${escape(t('A mai napot meghatározó időzóna:'))} ${escape(s.timeZone)}</p>`;
  const scroll = document.querySelector('.activity-scroll'); scroll.scrollLeft = scroll.scrollWidth;
}
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
