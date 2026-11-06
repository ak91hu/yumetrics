import { totals, NUTRIENTS, TYPES, validateAnalysis, metadata } from '/domain.mjs';

const $ = selector => document.querySelector(selector);
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const paths = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.4"/><rect x="14" y="3" width="7" height="7" rx="1.4"/><rect x="3" y="14" width="7" height="7" rx="1.4"/><rect x="14" y="14" width="7" height="7" rx="1.4"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18M8 15h2M14 15h2"/>',
  leaf: '<path d="M20 3c0 0-12-2-15 5s3 13 9 9S20 3 20 3Z"/><path d="M4 21 15 10"/>',
  sprout: '<path d="M12 22V11M12 15C4 16 2 11 3 6c6-1 10 3 9 9ZM12 11c-1-7 3-9 9-9 1 6-3 10-9 9Z"/>',
  settings: '<path d="m9 3-1 3-3 1v3l-2 2 2 2v3l3 1 1 3h6l1-3 3-1v-3l2-2-2-2V7l-3-1-1-3Z"/><circle cx="12" cy="12" r="3"/>',
  'chevron-right': '<path d="m9 5 7 7-7 7"/>', 'chevron-left': '<path d="m15 5-7 7 7 7"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', x: '<path d="m6 6 12 12M6 18 18 6"/>',
  'arrow-up-right': '<path d="M7 17 17 7M7 7h10v10"/>',
  camera: '<path d="m8 5-2 3H3v13h18V8h-3l-2-3Z"/><circle cx="12" cy="14" r="4"/>',
  sparkles: '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5ZM20 2v4M18 4h4"/>',
  flame: '<path d="M12 2c1 6-6 7-6 13a6 6 0 0 0 12 0c0-3-1-5-3-7 0 3-2 4-2 4 1-5-1-10-1-10Z"/>',
  utensils: '<path d="M5 2v8c0 4 6 4 6 0V2M8 2v20M17 2v10h4V2c-4 1-4 5-4 10M21 12v10"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7v.1"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
  play: '<path d="m8 4 12 8-12 8Z"/>', trash: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/>',
};
const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.info}</svg>`;
function icons(root = document) { root.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = icon(el.dataset.icon); }); }
icons();
const dayKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const asDate = day => new Date(`${day}T12:00:00`);
const today = () => dayKey(new Date());
const number = n => n === null || !Number.isFinite(n) ? '—' : new Intl.NumberFormat('hu-HU', { maximumFractionDigits: 1 }).format(n);
const integer = n => new Intl.NumberFormat('hu-HU', { maximumFractionDigits: 0 }).format(n);
const dateLabel = day => new Intl.DateTimeFormat('hu-HU', { month: 'short', day: 'numeric', weekday: 'short' }).format(asDate(day));
let goal = 2000;
try { const stored = Number(localStorage.getItem('yumetrics-goal')); if (stored >= 500 && stored <= 10000) goal = Math.round(stored); } catch { /* Preferences are optional in private browsing. */ }
const state = { selected: today(), month: today().slice(0, 7), meals: [], demo: false, status: null, goal, photo: null, busy: false, edit: null, dirty: false, deleting: null, loadVersion: 0 };
let toastTimer, photoVersion = 0;
function toast(message) { $('#toast').textContent = message; $('#toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 5000); }
function errorAt(id, error) { $(id).textContent = error?.message || String(error); $(id).hidden = false; }
async function request(path, options = {}) {
  const response = await fetch(path, { ...options, headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers }, cache: 'no-store' });
  let result; try { result = await response.json(); } catch { throw new Error('A szerver válasza nem olvasható. Ellenőrizd a kapcsolatot.'); }
  if (!response.ok) {
    if (response.status === 401 && path !== '/api/login') showLogin();
    const error = new Error(result.error || 'A művelet nem sikerült.'); error.status = response.status; throw error;
  }
  return result;
}
function showLogin() {
  const hosted = location.hostname.endsWith('.chatgpt.site');
  $('#login-form').hidden = hosted; $('#hosted-signin').hidden = !hosted;
  if (!$('#login-dialog').open) $('#login-dialog').showModal();
}
$('#login-dialog').addEventListener('cancel', event => event.preventDefault());
$('#login-form').addEventListener('submit', async event => {
  event.preventDefault(); const button = event.submitter; button.disabled = true; $('#login-error').hidden = true;
  try { await request('/api/login', { method: 'POST', body: JSON.stringify({ password: $('#login-password').value }) }); $('#login-password').value = ''; $('#login-dialog').close(); await initialize(); }
  catch (error) { errorAt('#login-error', error); } finally { button.disabled = false; }
});
async function initialize() {
  try { state.status = await request('/api/status'); $('#logout-button').hidden = false; await loadMonth(); }
  catch (error) { $('#loading').hidden = true; if (error.status !== 401) toast(error.message); }
}
async function loadMonth() {
  const version = ++state.loadVersion; $('#loading').hidden = false;
  try {
    const result = await request(`/api/meals?month=${state.month}`);
    if (version !== state.loadVersion) return;
    state.meals = result.meals; render();
  } catch (error) { if (version === state.loadVersion && error.status !== 401) toast(error.message); }
  finally { if (version === state.loadVersion) $('#loading').hidden = true; }
}
function demoMeals() {
  const ingredient = (name, grams, calories, protein, carbs, fat, fiber, sugar, sodium) => ({ name, grams, calories, protein, carbs, fat, fiber, sugar, sodium });
  return [
    { id: 'demo-breakfast', day: today(), time: '08:30', type: 'Reggeli', analysis: { name: 'Avokádós pirítós tojással', confidence: 'medium', assumptions: 'Mintaadat: két szelet kenyér, fél avokádó és egy tojás. A tápértékek szemléltető becslések.', ingredients: [ingredient('Teljes kiőrlésű kenyér', 80, 247, 13, 35, 4.2, 7, 4, 400), ingredient('Avokádó', 70, 160, 2, 1.8, 14.7, 6.7, .7, 7), ingredient('Főtt tojás', 55, 155, 12.6, 1.1, 10.6, 0, 1.1, 124)] }, photo: { url: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=500&q=80' } },
    { id: 'demo-lunch', day: today(), time: '12:45', type: 'Ebéd', analysis: { name: 'Mediterrán csirkés tál', confidence: 'medium', assumptions: 'Mintaadat: a főtt rizs és a sült csirke tápértékei elkészített állapotra vonatkoznak. Az öntet mennyisége becsült.', ingredients: [ingredient('Sült csirkemell', 140, 165, 31, 0, 3.6, 0, 0, 74), ingredient('Főtt barna rizs', 150, 123, 2.7, 24, 1, 1.6, .2, 4), ingredient('Vegyes saláta', 150, 25, 1.5, 3, .3, 2, 2, null), ingredient('Olívaolaj', 10, 884, 0, 0, 100, 0, 0, 0)] }, photo: { url: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=500&q=80' } },
    { id: 'demo-yesterday', day: dayKey(new Date(asDate(today()).setDate(asDate(today()).getDate() - 1))), time: '18:30', type: 'Vacsora', analysis: { name: 'Zöldséges tál', confidence: 'low', assumptions: 'Szemléltető mintaadat.', ingredients: [ingredient('Zöldséges gabonatál', 350, 130, 4, 20, 3, 3, null, null)] }, photo: { url: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=500&q=80' } },
  ].map(meal => ({ ...meal, status: 'saved', notes: '', revision: 0, totals: totals(meal.analysis.ingredients) }));
}
const visibleMeals = () => state.demo ? demoMeals() : state.meals;
function render() {
  const meals = visibleMeals(), selected = meals.filter(meal => meal.day === state.selected && meal.status === 'saved').sort((a, b) => a.time.localeCompare(b.time));
  const sum = key => selected.reduce((value, meal) => value + (meal.totals[key] ?? 0), 0);
  $('#demo-banner').hidden = !state.demo; $('#demo-button').innerHTML = `${icon('play')}${state.demo ? 'Saját naplóm' : 'Mintaadatok'}`;
  $('#selected-day-label').textContent = dateLabel(state.selected);
  $('#daily-title').textContent = state.selected === today() ? 'Mai áttekintés' : 'Napi áttekintés';
  $('#meal-count').textContent = selected.length;
  $('#calorie-total').textContent = integer(sum('calories'));
  $('#energy-caption').textContent = selected.length ? `${integer(state.goal)} kcal választott napi keret` : 'Egy új nap, egy tiszta lap.';
  const percent = Math.round(sum('calories') / state.goal * 100);
  $('#energy-percent').textContent = `${percent}%`; $('#energy-ring').style.setProperty('--progress', `${Math.min(percent, 100)}%`);
  const macroEnergy = sum('protein') * 4 + sum('carbs') * 4 + sum('fat') * 9;
  for (const [key, factor] of [['protein', 4], ['carbs', 4], ['fat', 9]]) {
    $(`#${key}-total`).textContent = number(sum(key));
    $(`#${key}-bar`).style.width = `${macroEnergy ? sum(key) * factor / macroEnergy * 100 : 0}%`;
  }
  $('#empty-state').hidden = selected.length > 0;
  $('#meal-list').innerHTML = selected.map(meal => `<button class="meal-card" data-meal="${escape(meal.id)}" aria-label="${escape(meal.analysis.name)}, ${integer(meal.totals.calories)} kilokalória, részletek"><img src="${escape(meal.photo.url)}" alt="${escape(meal.analysis.name)}" loading="lazy"><div class="meal-card-info"><div class="meal-meta"><span>${escape(meal.type)}</span><span>·</span><span>${escape(meal.time)}</span>${state.demo ? '<span>· Minta</span>' : ''}</div><h3>${escape(meal.analysis.name)}</h3><p class="meal-components">${meal.analysis.ingredients.map(item => escape(item.name)).join(' · ')}</p><div class="meal-macros"><span><i class="macro-dot protein"></i>${number(meal.totals.protein)} g feh.</span><span><i class="macro-dot carbs"></i>${number(meal.totals.carbs)} g szénh.</span><span><i class="macro-dot fat"></i>${number(meal.totals.fat)} g zsír</span></div></div><div class="meal-kcal"><strong>${integer(meal.totals.calories)}</strong><small>kcal</small></div></button>`).join('');
  const drafts = meals.filter(meal => meal.status !== 'saved');
  $('#draft-list').innerHTML = drafts.map(meal => `<div class="draft-card"><div><strong>${escape(meal.analysis?.name || 'Befejezetlen elemzés')}</strong><p>${escape(meal.day)} · ${meal.status === 'draft' ? 'Még nincs a naplóban · Átnézésre vár' : meal.status === 'failed' ? 'Sikertelen elemzés · Törölhető' : 'Folyamatban vagy megszakadt · Később törölhető'}</p></div><button data-meal="${escape(meal.id)}">Megnyitás</button></div>`).join('');
  renderCalendar();
}
function renderCalendar() {
  const first = asDate(`${state.month}-01`), start = new Date(first); start.setDate(1 - (first.getDay() + 6) % 7);
  $('#month-label').textContent = new Intl.DateTimeFormat('hu-HU', { year: 'numeric', month: 'long' }).format(first);
  const logged = new Map(); visibleMeals().filter(meal => meal.status === 'saved').forEach(meal => logged.set(meal.day, (logged.get(meal.day) || 0) + meal.totals.calories));
  $('#calendar-grid').innerHTML = Array.from({ length: 42 }, (_, i) => {
    const date = new Date(start); date.setDate(start.getDate() + i); const key = dayKey(date), energy = logged.get(key);
    const classes = [key.slice(0, 7) !== state.month ? 'other-month' : '', key === today() ? 'today' : '', key === state.selected ? 'selected' : '', energy !== undefined ? 'has-meal' : ''].join(' ');
    return `<button type="button" class="${classes}" data-day="${key}" aria-pressed="${key === state.selected}"${key === today() ? ' aria-current="date"' : ''} aria-label="${escape(key)}${energy !== undefined ? `, ${integer(energy)} kcal naplózva` : ', nincs naplózott étkezés'}">${date.getDate()}</button>`;
  }).join('');
}
async function selectDay(value) {
  const oldMonth = state.month; state.selected = value; state.month = value.slice(0, 7); render();
  if (oldMonth !== state.month && !state.demo) await loadMonth();
}
async function changeMonth(amount) {
  const date = asDate(`${state.month}-01`); date.setMonth(date.getMonth() + amount);
  if (date.getFullYear() < 1900 || date.getFullYear() > 2100) return;
  state.month = dayKey(date).slice(0, 7); renderCalendar(); if (!state.demo) await loadMonth();
}
const show = id => { const dialog = $(id); if (!dialog.open) dialog.showModal(); };
function close(dialog) {
  if (dialog.id === 'meal-dialog' && state.dirty && !confirm('A módosításaid még nincsenek mentve. Bezárod?')) return;
  dialog.close();
}
document.addEventListener('click', async event => {
  const closing = event.target.closest('[data-close]'); if (closing) { event.preventDefault(); close(closing.closest('dialog')); return; }
  const mealButton = event.target.closest('[data-meal]'); if (mealButton) { openMeal(mealButton.dataset.meal); return; }
  const dayButton = event.target.closest('[data-day]'); if (dayButton) { await selectDay(dayButton.dataset.day); return; }
  const action = event.target.closest('[data-action]')?.dataset.action;
  if (!action) return;
  if (action === 'upload') openUpload();
  if (action === 'demo') {
    state.demo = !state.demo; state.selected = today(); state.month = today().slice(0, 7); render();
    if (!state.demo) await loadMonth();
  }
  if (action === 'calendar') { $('#calendar').scrollIntoView({ behavior: 'smooth', block: 'center' }); $('#calendar').focus({ preventScroll: true }); }
  if (action === 'diary') window.scrollTo({ top: 0, behavior: 'smooth' });
  if (action === 'learn') show('#learn-dialog');
  if (action === 'settings') {
    $('#calorie-goal').value = state.goal; renderConnections(); show('#settings-dialog');
    try { state.status = await request('/api/status'); renderConnections(); } catch { /* The login dialog handles expired sessions. */ }
  }
  if (action === 'today') await selectDay(today());
  if (action === 'prev-month' || action === 'next-month') await changeMonth(action === 'prev-month' ? -1 : 1);
  if (action === 'prev-day' || action === 'next-day') {
    const date = asDate(state.selected); date.setDate(date.getDate() + (action === 'prev-day' ? -1 : 1));
    if (date.getFullYear() >= 1900 && date.getFullYear() <= 2100) await selectDay(dayKey(date));
  }
});
$('#meal-dialog').addEventListener('cancel', event => { if (state.dirty) { event.preventDefault(); close($('#meal-dialog')); } });
function renderConnections() {
  $('#connection-status').innerHTML = [['OpenCode AI', state.status?.ai], ['Cloudinary képtár', state.status?.photos]].map(([name, ready]) => `<div class="connection-row"><span>${name}</span><small class="${ready ? '' : 'missing'}">${ready ? 'Beállítva' : 'Beállításra vár'}</small></div>`).join('');
}
$('#settings-form').addEventListener('submit', event => {
  event.preventDefault(); state.goal = Number($('#calorie-goal').value);
  try { localStorage.setItem('yumetrics-goal', String(state.goal)); toast('A napi kereted elmentve.'); } catch { toast('A keret erre a munkamenetre beállítva.'); }
  $('#settings-dialog').close(); render();
});
$('#logout-button').addEventListener('click', async () => {
  if (location.hostname.endsWith('.chatgpt.site')) { window.location.assign('/signout-with-chatgpt?return_to=%2F'); return; }
  try { await request('/api/logout', { method: 'POST' }); window.location.reload(); } catch (error) { toast(error.message); }
});
function openUpload() {
  if (state.busy) { show('#upload-dialog'); return; }
  state.photo = null; photoVersion++;
  $('#upload-form').reset(); $('#upload-day').value = state.selected; $('#upload-time').value = new Date().toTimeString().slice(0, 5);
  const hour = new Date().getHours(); $('#upload-type').value = hour < 11 ? 'Reggeli' : hour < 16 ? 'Ebéd' : hour < 22 ? 'Vacsora' : 'Kisétkezés';
  $('#photo-preview').hidden = true; $('#upload-zone').hidden = false; $('#change-photo').hidden = true; $('#upload-error').hidden = true; $('#analysis-progress').hidden = true;
  $('#analyze-button').disabled = false; $('#analyze-button').innerHTML = `${icon('sparkles')}Étel elemzése`;
  if (!state.status?.ai || !state.status?.photos) errorAt('#upload-error', new Error('Az elemzéshez még be kell állítani az OpenCode- és Cloudinary-kapcsolatot. A Beállításokban láthatod az állapotukat.'));
  show('#upload-dialog');
}
async function choosePhoto(file) {
  if (!file || state.busy) return;
  const version = ++photoVersion; state.photo = null; $('#upload-error').hidden = true; $('#analyze-button').disabled = true;
  const objectUrl = URL.createObjectURL(file);
  try {
    if (file.size > 25 * 1024 * 1024) throw new Error('A kiválasztott kép legfeljebb 25 MB lehet.');
    if (!/\.(jpe?g|png|webp|hei[cf])$/i.test(file.name) && !/^image\/(jpeg|png|webp|hei[cf])$/.test(file.type)) throw new Error('JPEG, PNG vagy WebP képet válassz.');
    const image = new Image(); image.src = objectUrl;
    try { await image.decode(); } catch { throw new Error('A böngésző nem tudja megnyitni ezt a képet. HEIC/HEIF esetén válaszd a JPEG formátumot.'); }
    if (!image.naturalWidth || image.naturalWidth * image.naturalHeight > 50_000_000) throw new Error('A kép felbontása túl nagy. Válassz legfeljebb 50 megapixeles képet.');
    const ratio = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight)), canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio)); canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', .86);
    if (dataUrl.length > 5_590_000) throw new Error('A tömörített kép túl nagy. Válassz kisebb fotót.');
    if (version !== photoVersion) return;
    state.photo = dataUrl; $('#photo-preview').src = dataUrl; $('#photo-preview').hidden = false; $('#upload-zone').hidden = true; $('#change-photo').hidden = false;
  } catch (error) { if (version === photoVersion) errorAt('#upload-error', error); }
  finally { URL.revokeObjectURL(objectUrl); if (version === photoVersion) $('#analyze-button').disabled = false; }
}
$('#photo-input').addEventListener('change', event => choosePhoto(event.target.files[0]));
$('#camera-input').addEventListener('change', event => choosePhoto(event.target.files[0]));
$('#camera-button').addEventListener('click', () => { if (!state.busy) { $('#camera-input').value = ''; $('#camera-input').click(); } });
$('#change-photo').addEventListener('click', () => { if (!state.busy) { $('#photo-input').value = ''; $('#photo-input').click(); } });
for (const name of ['dragenter', 'dragover']) $('#upload-zone').addEventListener(name, event => { event.preventDefault(); $('#upload-zone').classList.add('dragging'); });
for (const name of ['dragleave', 'drop']) $('#upload-zone').addEventListener(name, event => { event.preventDefault(); $('#upload-zone').classList.remove('dragging'); if (name === 'drop') choosePhoto(event.dataTransfer.files[0]); });
$('#upload-form').addEventListener('submit', async event => {
  event.preventDefault(); if (state.busy) return;
  $('#upload-error').hidden = true;
  if (!state.photo) { errorAt('#upload-error', new Error('Válassz egy ételfotót az elemzéshez.')); return; }
  state.busy = true; $('#analyze-button').disabled = true; $('#analysis-progress').hidden = false;
  let id = crypto.randomUUID();
  try {
    const payload = { id, image: state.photo, day: $('#upload-day').value, time: $('#upload-time').value, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, type: $('#upload-type').value, notes: $('#upload-notes').value };
    const { meal } = await request('/api/analyze', { method: 'POST', body: JSON.stringify(payload) });
    if (state.demo) state.demo = false;
    state.meals = [...state.meals.filter(item => item.id !== meal.id), meal];
    state.selected = meal.day; state.month = meal.day.slice(0, 7); render(); await loadMonth();
    $('#upload-dialog').close(); openMeal(meal.id); toast('Elkészült a becslés. Nézd át, majd mentsd a naplódba.');
  } catch (error) { errorAt('#upload-error', error); if (!$('#upload-dialog').open) toast(error.message); await loadMonth(); }
  finally { state.busy = false; $('#analyze-button').disabled = false; $('#analysis-progress').hidden = true; }
});
const field = (label, name, value, attrs = '') => `<label>${label}<input name="${name}" value="${escape(value)}" ${attrs}></label>`;
const nutrientNames = { calories: 'Energia (kcal)', protein: 'Fehérje (g)', carbs: 'Szénhidrát (g)', fat: 'Zsír (g)', fiber: 'Rost (g)', sugar: 'Cukor (g)', sodium: 'Nátrium (mg)' };
function openMeal(id) {
  const meal = visibleMeals().find(item => item.id === id);
  if (!meal) { toast('A bejegyzés még nem tölthető be. Frissítsd a naplót.'); return; }
  state.edit = structuredClone(meal); state.dirty = false; renderDetail(); show('#meal-dialog');
}
function renderDetail() {
  const meal = state.edit, analysis = meal.analysis, readOnly = state.demo;
  $('#detail-heading').textContent = analysis ? meal.status === 'draft' ? 'Nézd át az AI becslését.' : 'A tányérod részletei.' : 'Befejezetlen elemzés';
  if (!analysis || !meal.photo) {
    $('#meal-detail').innerHTML = `<p class="dialog-intro">${escape(meal.error || 'Az elemzés még fut, vagy megszakadt. Két perc elteltével törölheted a bejegyzést, és új fotóval próbálkozhatsz.')}</p><button type="button" class="delete-button" id="delete-meal">${icon('trash')}Bejegyzés és kép törlése</button>`;
    $('#delete-meal').addEventListener('click', askDelete); return;
  }
  const total = totals(analysis.ingredients);
  $('#meal-detail').innerHTML = `${readOnly ? '<p class="read-only-note">Mintaadat · Ezt az étkezést csak megtekinteni lehet. A saját elemzéseid minden adata módosítható.</p>' : ''}<form id="detail-form"><div class="detail-top"><img src="${escape(meal.photo.url)}" alt="${escape(analysis.name)}"><div class="detail-summary"><strong id="detail-calories">${integer(total.calories)}</strong><small> kcal</small><div class="detail-totals" id="detail-macros"></div><span class="confidence ${analysis.confidence}">AI önértékelés: ${{ low: 'bizonytalan', medium: 'közepes', high: 'magas' }[analysis.confidence]}</span></div></div><fieldset ${readOnly ? 'disabled' : ''} class="detail-fields">${field('Az étel neve', 'name', analysis.name, 'required maxlength="160"')}<div class="form-grid">${field('Dátum', 'day', meal.day, 'type="date" required min="1900-01-01" max="2100-12-31"')}${field('Időpont', 'time', meal.time, 'type="time" required')}<label class="full-width">Étkezés<select name="type">${TYPES.map(type => `<option ${type === meal.type ? 'selected' : ''}>${type}</option>`).join('')}</select></label></div><div class="ingredient-heading"><h3>Összetevők és adagok</h3><button type="button" class="text-button" id="add-ingredient">${icon('plus')}Hozzáadás</button></div><div id="ingredient-list">${analysis.ingredients.map((item, index) => `<div class="ingredient-row" data-ingredient="${index}"><div class="ingredient-main">${field('Összetevő', `i-${index}-name`, item.name, 'required maxlength="160"')}${field('Adag (g)', `i-${index}-grams`, item.grams, 'type="number" step="any" min="0.1" max="5000" required')}<button class="icon-button" type="button" data-remove="${index}" aria-label="Összetevő törlése">${icon('x')}</button></div><details><summary>Tápértékek szerkesztése · 100 g-ra</summary><div class="nutrient-inputs">${NUTRIENTS.map(key => field(nutrientNames[key], `i-${index}-${key}`, item[key] ?? '', `type="number" step="any" min="0" max="${key === 'calories' ? 1000 : key === 'sodium' ? 100000 : 100}" ${['fiber', 'sugar', 'sodium'].includes(key) ? 'placeholder="Ismeretlen"' : 'required'}`)).join('')}</div></details></div>`).join('')}</div><div class="detail-extra" id="detail-extra"></div><label>Megjegyzés<textarea name="notes" rows="2" maxlength="2000">${escape(meal.notes)}</textarea></label></fieldset><div class="assumptions"><strong>A becslés bizonytalanságai</strong>${escape(analysis.assumptions || 'Az adag és a rejtett összetevők egy fotóból nem mérhetők pontosan.')}</div><p class="form-error" id="detail-error" role="alert" hidden></p><div class="detail-footer">${readOnly ? '' : `<button type="button" class="delete-button" id="delete-meal">${icon('trash')}Törlés</button><button type="submit" class="button primary" id="save-meal">${meal.status === 'draft' ? 'Mentés a naplómba' : 'Módosítások mentése'}</button>`}</div><p class="detail-provenance">${readOnly ? 'Szemléltető mintaadat' : `Modell: ${escape(meal.model)} · ${escape(meal.promptVersion)} · Az eredeti AI-becslés külön megőrizve.`}</p></form>`;
  $('#detail-form').addEventListener('input', () => { if (!readOnly) { state.dirty = true; syncDetail(); updateDetailTotals(); } });
  $('#detail-form').addEventListener('submit', saveMeal);
  $('#add-ingredient').addEventListener('click', () => {
    syncDetail();
    if (state.edit.analysis.ingredients.length >= 40) { toast('Legfeljebb 40 összetevő adható meg.'); return; }
    state.edit.analysis.ingredients.push({ name: '', grams: 100, calories: 0, protein: 0, carbs: 0, fat: 0, fiber: null, sugar: null, sodium: null }); state.dirty = true; renderDetail();
  });
  $('#ingredient-list').addEventListener('click', event => {
    const remove = event.target.closest('[data-remove]'); if (!remove || readOnly) return;
    if (state.edit.analysis.ingredients.length === 1) { toast('Legalább egy összetevő szükséges.'); return; }
    syncDetail(); state.edit.analysis.ingredients.splice(Number(remove.dataset.remove), 1); state.dirty = true; renderDetail();
  });
  $('#delete-meal')?.addEventListener('click', askDelete); updateDetailTotals();
}
function syncDetail() {
  const form = $('#detail-form'); if (!form || state.demo) return;
  const data = new FormData(form), meal = state.edit;
  meal.analysis.name = String(data.get('name')); meal.day = String(data.get('day')); meal.time = String(data.get('time')); meal.type = String(data.get('type')); meal.notes = String(data.get('notes'));
  meal.analysis.ingredients = meal.analysis.ingredients.map((item, index) => {
    const updated = { name: String(data.get(`i-${index}-name`)), grams: Number(data.get(`i-${index}-grams`)) };
    NUTRIENTS.forEach(key => { const value = data.get(`i-${index}-${key}`); updated[key] = value === '' && ['fiber', 'sugar', 'sodium'].includes(key) ? null : Number(value); }); return updated;
  });
}
function updateDetailTotals() {
  if (!state.edit?.analysis || !$('#detail-macros')) return;
  const total = totals(state.edit.analysis.ingredients);
  $('#detail-calories').textContent = integer(total.calories);
  $('#detail-macros').innerHTML = `<span>${number(total.protein)} g fehérje</span><span>${number(total.carbs)} g szénh.</span><span>${number(total.fat)} g zsír</span>`;
  $('#detail-extra').innerHTML = [['Rost', total.fiber, 'g'], ['Cukor', total.sugar, 'g'], ['Nátrium', total.sodium, 'mg']].map(([label, value, unit]) => `<span>${label}<strong>${number(value)}${value === null ? '' : ` ${unit}`}</strong></span>`).join('');
}
async function saveMeal(event) {
  event.preventDefault(); if (state.demo) return;
  $('#detail-error').hidden = true; syncDetail();
  try { validateAnalysis(state.edit.analysis); metadata(state.edit); } catch (error) { errorAt('#detail-error', error); return; }
  const button = $('#save-meal'); button.disabled = true;
  try {
    const { meal } = await request(`/api/meals/${state.edit.id}`, { method: 'PATCH', body: JSON.stringify(state.edit) });
    state.dirty = false; $('#meal-dialog').close(); state.meals = [...state.meals.filter(item => item.id !== meal.id), meal]; state.selected = meal.day; state.month = meal.day.slice(0, 7); render(); await loadMonth(); toast('Az étkezés a naplódban. Jó étvágyat az egyensúlyhoz!');
  } catch (error) { errorAt('#detail-error', error); } finally { button.disabled = false; }
}
function askDelete() { state.deleting = state.edit.id; $('#delete-error').hidden = true; show('#confirm-dialog'); }
$('#confirm-delete').addEventListener('click', async event => {
  const button = event.currentTarget; button.disabled = true; $('#delete-error').hidden = true;
  try { await request(`/api/meals/${state.deleting}`, { method: 'DELETE' }); state.meals = state.meals.filter(item => item.id !== state.deleting); state.dirty = false; $('#confirm-dialog').close(); $('#meal-dialog').close(); render(); await loadMonth(); toast('Az étkezést és a képet töröltük.'); }
  catch (error) { errorAt('#delete-error', error); } finally { button.disabled = false; }
});
render(); await initialize();
