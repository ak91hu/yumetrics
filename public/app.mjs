import { photoDimensions } from '/photo-preparation.mjs';
import { t, html, initializeLanguage, getLanguage, locale, messageSource } from '/localization.mjs';
import { totals, NUTRIENTS, OPTIONAL_NUTRIENTS, TYPES, validateAnalysis, validateImages, metadata } from '/domain.mjs';
import { FOOD_REFERENCE } from '/food-reference.mjs';
import { REFERENCE_STATES } from '/hungarian-food.mjs';
import { installAnalysisUI, dishGuidance, reportMarkup, ingredientMarkup, refreshReport, recipeMarkup } from '/analysis-ui.mjs';
import { loadProfile, renderProfile, renderAvatar, renderMotivation } from '/profile-ui.mjs';
import { helpMarkup } from '/context-help.mjs';

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
installAnalysisUI();
initializeLanguage();
const pageTitle=messageSource(document.title);
const dayKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const asDate = day => new Date(`${day}T12:00:00`);
const today = () => dayKey(new Date());
const number = n => n === null || !Number.isFinite(n) ? '—' : new Intl.NumberFormat(locale(), { maximumFractionDigits: 1 }).format(n);
const saltNumber = n => n === null || !Number.isFinite(n) ? '—' : new Intl.NumberFormat(locale(), { maximumFractionDigits: 2 }).format(n);
const integer = n => new Intl.NumberFormat(locale(), { maximumFractionDigits: 0 }).format(n);
const dateLabel = day => new Intl.DateTimeFormat(locale(), { month: 'short', day: 'numeric', weekday: 'short' }).format(asDate(day));
const goal = 2000;
const state = { selected: today(), month: today().slice(0, 7), meals: [], status: null, goal, photo: null, secondPhoto: null, busy: false, edit: null, dirty: false, deleting: null, loadVersion: 0, uploadId: null, pendingOpenId: null, recipeEditing: false, recipeBackup: null };
const foodRequests = new WeakMap();
const savingMeals = new Set();
let toastTimer, photoVersion = 0, secondPhotoVersion = 0, processingPhotos = 0, settingsVersion = 0, renderedDrafts = '';
function toast(message) { $('#toast').dataset.message = messageSource(message); $('#toast').textContent = t(message); $('#toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 5000); }
function hideToast() { $('#toast').hidden = true; clearTimeout(toastTimer); }
function errorAt(id, error) { $(id).dataset.message = messageSource(error?.message || String(error)); $(id).textContent = t($(id).dataset.message); $(id).hidden = false; }
async function request(path, options = {}) {
  const response = await fetch(path, { ...options, headers: { 'Accept-Language': getLanguage(), ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers }, cache: 'no-store' }).catch(() => { throw new Error(t('A szerver most nem érhető el. Próbáld újra később.')); });
  let result; try { result = await response.json(); } catch { throw new Error(t('Nem sikerült feldolgozni a szerver válaszát. Ellenőrizd az internetkapcsolatot, majd próbáld újra.')); }
  if (!response.ok) {
    if (response.status === 401 && path !== '/api/login') showLogin();
    const error = new Error(result.error || t('A művelet nem sikerült.')); error.status = response.status; throw error;
  }
  return result;
}
function showLogin() { if (!state.redirectingToLogin) { state.redirectingToLogin = true; window.location.assign('/'); } }
async function initialize() {
  try { state.status = await request('/api/status'); state.goal = state.status.user.calorieGoal; $('.profile strong').textContent = state.status.user.name; $('.profile small').textContent = state.status.user.email; document.querySelectorAll('.avatar').forEach(element=>renderAvatar(element,state.status.user)); $('#logout-button').hidden = false; $('#admin-link').hidden = !state.status.user.admin; $('#topbar-admin-link').hidden = !state.status.user.admin; $('.topbar').classList.toggle('has-admin',state.status.user.admin); await loadMonth(); await loadProfile(request, { quiet: true }); }
  catch (error) { $('#loading').hidden = true; if (error.status !== 401) toast(error.message); }
}
async function loadMonth() {
  const version = ++state.loadVersion; $('#loading').hidden = false;
  try {
    const result = await request(`/api/meals?month=${state.month}`);
    if (version !== state.loadVersion) return;
    const analyzing = new Set(state.meals.filter(meal => meal.status === 'analyzing').map(meal => meal.id));
    const newlyReady = result.meals.some(meal => meal.status === 'draft' && analyzing.has(meal.id));
    state.meals = result.meals;
    for (const meal of state.meals) for (const item of meal.analysis?.ingredients || []) if (item.referenceKey && item.referenceRecord) FOOD_REFERENCE[item.referenceKey] = item.referenceRecord;
    render();
    const pending = state.meals.find(meal => meal.id === state.pendingOpenId);
    const readyToOpen = pending?.analysis && pending.status === 'draft';
    if (readyToOpen) { state.pendingOpenId = null; openMeal(pending.id); }
    if (newlyReady || readyToOpen) hideToast();
    if ($('#meal-dialog').open && !state.dirty && state.edit && !state.edit.analysis) {
      const updated = state.meals.find(meal => meal.id === state.edit.id);
      if (updated) { state.edit = structuredClone(updated); renderDetail(); }
      else $('#meal-dialog').close();
    }
  } catch (error) { if (version === state.loadVersion && error.status !== 401) toast(error.message); }
  finally { if (version === state.loadVersion) $('#loading').hidden = true; }
}
const visibleMeals = () => state.meals.filter(meal => meal.job?.kind !== 'delete');
function render() {
  const meals = visibleMeals(), selected = meals.filter(meal => meal.day === state.selected && meal.status === 'saved').sort((a, b) => a.time.localeCompare(b.time));
  const sum = key => selected.reduce((value, meal) => value + (meal.totals[key] ?? 0), 0);
  $('#selected-day-label').textContent = dateLabel(state.selected);
  $('#daily-title').textContent = state.selected === today() ? t('Mai áttekintés') : t('Napi áttekintés');
  $('#meal-count').textContent = selected.length;
  const optionalSum = key => !selected.length || selected.some(meal => meal.totals[key] == null) ? null : selected.reduce((total, meal) => total + meal.totals[key], 0);
  $('#daily-details').innerHTML = html`<span><b>${selected.length}</b> mentett étkezés</span><span>Rost: <b>${number(optionalSum('fiber'))}${optionalSum('fiber') === null ? '' : ' g'}</b></span><span>Számított sótartalom: <b>${saltNumber(optionalSum('sodium') === null ? null : optionalSum('sodium') * 2.5 / 1000)}${optionalSum('sodium') === null ? '' : ' g'}</b></span>`;
  $('#calorie-total').textContent = integer(sum('calories'));
  $('#energy-caption').textContent = selected.length ? t`${integer(state.goal)} kcal a választott napi kereted` : t('Erre a napra még nincs mentett étkezés.');
  const percent = Math.round(sum('calories') / state.goal * 100);
  $('#energy-percent').textContent = `${percent}%`; $('#energy-ring').style.setProperty('--progress', `${Math.min(percent, 100)}%`);
  const macroEnergy = sum('protein') * 4 + sum('carbs') * 4 + sum('fat') * 9;
  for (const [key, factor] of [['protein', 4], ['carbs', 4], ['fat', 9]]) {
    $(`#${key}-total`).textContent = number(sum(key));
    $(`#${key}-bar`).style.width = `${macroEnergy ? sum(key) * factor / macroEnergy * 100 : 0}%`;
  }
  $('#empty-state').hidden = selected.length > 0;
  $('#meal-list').innerHTML = selected.map(meal => html`<button class="meal-card" data-meal="${escape(meal.id)}" aria-label="${escape(meal.analysis.name)}, ${integer(meal.totals.calories)} kilokalória, részletek"><img src="${escape(meal.photo.url)}" alt="${escape(meal.analysis.name)}" loading="lazy"><div class="meal-card-info"><div class="meal-meta"><span>${escape(t(meal.type))}</span><span>·</span><span>${escape(meal.time)}</span></div><h3>${escape(meal.analysis.name)}</h3><p class="meal-components">${meal.analysis.ingredients.map(item => escape(item.name)).join(' · ')}</p><div class="meal-macros"><span><i class="macro-dot protein"></i>${number(meal.totals.protein)} g fehérje</span><span><i class="macro-dot carbs"></i>${number(meal.totals.carbs)} g szénhidrát</span><span><i class="macro-dot fat"></i>${number(meal.totals.fat)} g zsír</span></div></div><div class="meal-kcal"><strong>${integer(meal.totals.calories)}</strong><small>kcal</small></div></button>`).join('');
  const drafts = state.meals.filter(meal => meal.status !== 'saved' || meal.job?.kind === 'delete').sort((a,b) => Number(b.status === 'draft' && b.job?.kind !== 'delete') - Number(a.status === 'draft' && a.job?.kind !== 'delete'));
  const uploading=state.busy&&!state.meals.some(meal=>meal.id===state.uploadId);
  const hasReady=drafts.some(meal=>meal.status==='draft'&&meal.job?.kind!=='delete');
  const hasProcessing=uploading||drafts.some(meal=>meal.status==='analyzing'&&meal.job?.kind!=='delete');
  document.title=hasReady?t('Elkészült az elemzés')+' · Yumetrics':hasProcessing?t('Az étkezés feldolgozása folyamatban')+' · Yumetrics':t(pageTitle);
  $('#draft-list').hidden = drafts.length === 0&&!uploading;
  const draftMarkup = (uploading?html`<div class="draft-card draft-processing"><div><strong>Az étkezés feltöltése folyamatban</strong><p>A beküldés még tart. Nem kell újra elküldened.</p></div><button class="button outline" data-action="upload">Feltöltés megnyitása</button></div>`:'')+drafts.map(meal => {
    const ready = meal.status === 'draft' && meal.job?.kind !== 'delete';
    const processing=meal.status==='analyzing'&&meal.job?.kind!=='delete';
    return html`<div class="draft-card ${ready ? 'draft-ready' : processing?'draft-processing':''}"><div>${ready ? html('<p class="draft-ready-title">Elkészült az eredmény. Az étkezés menthető.</p>') : ''}<strong>${escape(meal.analysis?.name || t(processing?'Az étkezés feldolgozása folyamatban':'Befejezetlen elemzés'))}</strong><p>${escape(meal.day)} · ${meal.job?.kind === 'delete' ? (meal.job.state === 'failed' ? t('Nem sikerült törölni · Újra megpróbálhatod') : t('Törlés folyamatban')) : meal.status === 'draft' ? t('Mentésre kész eredmény') : meal.status === 'failed' ? t('Nem sikerült az elemzés · Újra megpróbálhatod') : t('Az eredményt itt jelezzük, amint elkészült. Nem kell újra beküldened.')}</p></div><button class="${ready ? 'button primary' : ''}" data-meal="${escape(meal.id)}">${ready ? t('Eredmény megnyitása') : t('Megnyitás')}</button></div>`;
  }).join('');
  if (draftMarkup !== renderedDrafts) { $('#draft-list').innerHTML = draftMarkup; renderedDrafts = draftMarkup; }
  renderCalendar();
}
function renderCalendar() {
  const first = asDate(`${state.month}-01`), start = new Date(first); start.setDate(1 - (first.getDay() + 6) % 7);
  $('#month-label').textContent = new Intl.DateTimeFormat(locale(), { year: 'numeric', month: 'long' }).format(first);
  const logged = new Map(); visibleMeals().filter(meal => meal.status === 'saved').forEach(meal => logged.set(meal.day, (logged.get(meal.day) || 0) + meal.totals.calories));
  $('#calendar-grid').innerHTML = Array.from({ length: 42 }, (_, i) => {
    const date = new Date(start); date.setDate(start.getDate() + i); const key = dayKey(date), energy = logged.get(key);
    const classes = [key.slice(0, 7) !== state.month ? 'other-month' : '', key === today() ? 'today' : '', key === state.selected ? 'selected' : '', energy !== undefined ? 'has-meal' : ''].join(' ');
    return `<button type="button" class="${classes}" data-day="${key}" aria-pressed="${key === state.selected}"${key === today() ? ' aria-current="date"' : ''} aria-label="${escape(key)}${energy !== undefined ? t`, ${integer(energy)} kcal naplózva` : t(', nincs naplózott étkezés')}">${date.getDate()}</button>`;
  }).join('');
}
async function selectDay(value) {
  const oldMonth = state.month; state.selected = value; state.month = value.slice(0, 7); render();
  if (oldMonth !== state.month) await loadMonth();
}
async function changeMonth(amount) {
  const date = asDate(`${state.month}-01`); date.setMonth(date.getMonth() + amount);
  if (date.getFullYear() < 1900 || date.getFullYear() > 2100) return;
  state.month = dayKey(date).slice(0, 7); renderCalendar(); await loadMonth();
}
const show = id => { const dialog = $(id); if (!dialog.open) dialog.showModal(); };
function close(dialog) {
  if (dialog.id === 'meal-dialog' && state.dirty && !confirm(t('Még nem mentetted a módosításaidat. Bezárod az ablakot mentés nélkül?'))) return;
  if (dialog.id === 'meal-dialog' && state.pendingOpenId === state.edit?.id) state.pendingOpenId = null;
  dialog.close();
}
document.addEventListener('click', async event => {
  const closing = event.target.closest('[data-close]'); if (closing) { event.preventDefault(); close(closing.closest('dialog')); return; }
  const mealButton = event.target.closest('[data-meal]'); if (mealButton) { openMeal(mealButton.dataset.meal); return; }
  const activityDay = event.target.closest('[data-profile-day]');
  if (activityDay) { $('#settings-dialog').close(); await selectDay(activityDay.dataset.profileDay); $('#calendar').scrollIntoView({ behavior: 'smooth', block: 'center' }); $('#calendar').focus({ preventScroll: true }); return; }
  const dayButton = event.target.closest('[data-day]'); if (dayButton) { await selectDay(dayButton.dataset.day); return; }
  const action = event.target.closest('[data-action]')?.dataset.action;
  if (!action) return;
  if (action === 'upload') openUpload();
  if (action === 'log-today') { if ($('#settings-dialog').open) $('#settings-dialog').close(); await selectDay(today()); openUpload(); }
  if (action === 'calendar') { $('#calendar').scrollIntoView({ behavior: 'smooth', block: 'center' }); $('#calendar').focus({ preventScroll: true }); }
  if (action === 'diary') window.scrollTo({ top: 0, behavior: 'smooth' });
  if (action === 'learn') show('#learn-dialog');
  if (action === 'settings') {
    const previousGoal = String(state.goal), version = ++settingsVersion;
    $('#calorie-goal').value = state.goal; show('#settings-dialog');
    loadProfile(request);
    try { state.status = await request('/api/status'); if (version === settingsVersion && String(state.goal) === previousGoal && $('#calorie-goal').value === previousGoal) { state.goal = state.status.user.calorieGoal; $('#calorie-goal').value = state.goal; } } catch { /* The login dialog handles expired sessions. */ }
  }
  if (action === 'today') await selectDay(today());
  if (action === 'prev-month' || action === 'next-month') await changeMonth(action === 'prev-month' ? -1 : 1);
  if (action === 'prev-day' || action === 'next-day') {
    const date = asDate(state.selected); date.setDate(date.getDate() + (action === 'prev-day' ? -1 : 1));
    if (date.getFullYear() >= 1900 && date.getFullYear() <= 2100) await selectDay(dayKey(date));
  }
});
$('#meal-dialog').addEventListener('cancel', event => { event.preventDefault(); close($('#meal-dialog')); });
$('#settings-form').addEventListener('submit', async event => {
  event.preventDefault(); const button = event.submitter || $('#settings-form button[type="submit"]'); if (button.disabled) return;
  const value = $('#calorie-goal').value, version = settingsVersion; button.disabled = true;
  try {
    const result = await request('/api/profile', { method: 'PATCH', body: JSON.stringify({ calorieGoal: Number(value) }) }); state.goal = result.calorieGoal;
    const edited = $('#calorie-goal').value !== value;
    if (version === settingsVersion && !edited) $('#settings-dialog').close();
    render(); toast(t(edited ? 'A korábbi változatot elmentettük. A mostani módosításaid még nincsenek mentve.' : 'Elmentettük a napi energiakeretedet.'));
  }
  catch (error) { toast(error.message); } finally { button.disabled = false; }
});
$('#logout-button').addEventListener('click', async () => {
  state.redirectingToLogin = true;
  try { await request('/api/logout', { method: 'POST' }); window.location.reload(); } catch (error) { state.redirectingToLogin = false; toast(error.message); }
});
function openUpload() {
  if (state.busy) { show('#upload-dialog'); return; }
  state.photo = null; state.secondPhoto = null; state.uploadId = crypto.randomUUID(); photoVersion++; secondPhotoVersion++;
  $('#upload-form').reset(); $('#upload-day').value = state.selected; $('#upload-time').value = new Date().toTimeString().slice(0, 5);
  $('#upload-form').querySelectorAll('details').forEach(element => { element.open = false; });
  const hour = new Date().getHours(); $('#upload-type').value = hour < 11 ? 'Reggeli' : hour < 16 ? 'Ebéd' : hour < 22 ? 'Vacsora' : 'Kisétkezés';
  $('#photo-preview').hidden = true; $('#upload-zone').hidden = false; $('#upload-error').hidden = true; $('#analysis-progress').hidden = true;
  $('.second-preview-wrap').hidden = true;
  $('#analyze-button').disabled = false; $('#analyze-button').innerHTML = t`${icon('sparkles')}Elemzés indítása`;
  show('#upload-dialog');
}
function setUploadBusy(busy) {
  state.busy=busy;$('#upload-form').classList.toggle('is-processing',busy);
  $('#analyze-button').disabled=busy||processingPhotos>0;$('#analyze-button').hidden=busy;
  $('#upload-ok').hidden=!busy;$('#analysis-progress').hidden=!busy;
  $('#upload-cancel').hidden=busy;
  render();
}
async function choosePhoto(file, secondary = false) {
  if (!file || state.busy) return;
  const version = secondary ? ++secondPhotoVersion : ++photoVersion;
  if (secondary) { state.secondPhoto = null; $('.second-preview-wrap').hidden = true; }
  else { state.photo = null; $('#photo-preview').hidden = true; $('#upload-zone').hidden = false; }
  processingPhotos++; $('#upload-error').hidden = true; $('#analyze-button').disabled = true;
  const objectUrl = URL.createObjectURL(file);
  try {
    if (file.size > 25 * 1024 * 1024) throw new Error(t('Legfeljebb 25 MB méretű képet válassz.'));
    if (!/\.(jpe?g|png|webp|hei[cf])$/i.test(file.name) && !/^image\/(jpeg|png|webp|hei[cf])$/.test(file.type)) throw new Error(t('JPEG-, PNG- vagy WebP-formátumú képet válassz.'));
    const image = new Image(); image.src = objectUrl;
    try { await image.decode(); } catch { throw new Error(t('A böngésző nem tudja megnyitni ezt a képet. Ha HEIC- vagy HEIF-fájlt választottál, alakítsd át JPEG-formátumra, majd töltsd fel újra.')); }
    if (!image.naturalWidth || image.naturalWidth * image.naturalHeight > 50_000_000) throw new Error(t('A kép túl nagy felbontású. Legfeljebb 50 megapixeles képet válassz.'));
    const canvas = document.createElement('canvas');
    Object.assign(canvas, photoDimensions(image.naturalWidth, image.naturalHeight, secondary));
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', .92);
    if (dataUrl.length > 5_590_000) throw new Error(t('A tömörített kép túl nagy. Válassz kisebb fotót.'));
    if (version !== (secondary ? secondPhotoVersion : photoVersion)) return;
    if (dataUrl === (secondary ? state.photo : state.secondPhoto)) throw new Error(t('Ugyanazt a képet választottad kétszer. Készíts másik nézetet, csomagolt terméknél olvasható címkefotót.'));
    if (secondary) { state.secondPhoto = dataUrl; $('#second-photo-preview').src = dataUrl; $('.second-preview-wrap').hidden = false; }
    else { state.photo = dataUrl; $('#photo-preview').src = dataUrl; $('#photo-preview').hidden = false; $('#upload-zone').hidden = true; }
  } catch (error) { if (version === (secondary ? secondPhotoVersion : photoVersion)) errorAt('#upload-error', error); }
  finally { URL.revokeObjectURL(objectUrl); processingPhotos--; $('#analyze-button').disabled = state.busy || processingPhotos > 0; }
}
$('#second-photo-input').addEventListener('change', event => choosePhoto(event.target.files[0], true));
$('#second-camera-input').addEventListener('change', event => choosePhoto(event.target.files[0], true));
$('#second-camera-button').addEventListener('click', () => { if (!state.busy) { $('#second-camera-input').value = ''; $('#second-camera-input').click(); } });
$('#remove-second-photo').addEventListener('click', () => { if (state.busy) return; state.secondPhoto = null; secondPhotoVersion++; $('#second-photo-input').value = ''; $('.second-preview-wrap').hidden = true; });
$('#photo-input').addEventListener('change', event => choosePhoto(event.target.files[0]));
$('#camera-input').addEventListener('change', event => choosePhoto(event.target.files[0]));
$('#camera-button').addEventListener('click', () => { if (!state.busy) { $('#camera-input').value = ''; $('#camera-input').click(); } });
$('#change-photo').addEventListener('click', () => { if (!state.busy) { $('#photo-input').value = ''; $('#photo-input').click(); } });
for (const name of ['dragenter', 'dragover']) $('#upload-zone').addEventListener(name, event => { event.preventDefault(); $('#upload-zone').classList.add('dragging'); });
for (const name of ['dragleave', 'drop']) $('#upload-zone').addEventListener(name, event => { event.preventDefault(); $('#upload-zone').classList.remove('dragging'); if (name === 'drop') choosePhoto(event.dataTransfer.files[0]); });
$('#upload-form').addEventListener('submit', async event => {
  event.preventDefault(); if (state.busy || processingPhotos > 0) return;
  $('#upload-error').hidden = true;
  if (!state.photo) { errorAt('#upload-error', new Error(t('Válassz egy ételfotót az elemzéshez.'))); return; }
  try { validateImages(state.photo, state.secondPhoto); } catch (error) { errorAt('#upload-error', error); return; }
  setUploadBusy(true);
  const id = state.uploadId;
  try {
    const payload = { id, image: state.photo, secondImage: state.secondPhoto, context: { language: getLanguage(), dishProfile: $('#dish-profile').value, preparationNotes: $('#preparation-notes').value, totalWeightG: $('#context-weight').value ? Number($('#context-weight').value) : null, inedibleWeightG: Number($('#context-inedible').value), plateDiameterCm: $('#context-diameter').value ? Number($('#context-diameter').value) : null }, day: $('#upload-day').value, time: $('#upload-time').value, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, type: $('#upload-type').value, notes: $('#upload-notes').value };
    const { meal } = await request('/api/analyze', { method: 'POST', body: JSON.stringify(payload) });

    state.meals = [...state.meals.filter(item => item.id !== meal.id), meal];
    state.selected = meal.day; state.month = meal.day.slice(0, 7); render(); await loadMonth();
    const current = state.meals.find(item => item.id === meal.id) || meal;
    if ($('#upload-dialog').open) { $('#upload-dialog').close(); state.pendingOpenId = current.status === 'analyzing' ? meal.id : null; if (current.analysis) openMeal(meal.id); }
    if (current.analysis) hideToast(); else toast(t('A fotót elmentettük, az elemzés a háttérben folytatódik.'));
  } catch (error) { errorAt('#upload-error', error); if (!$('#upload-dialog').open) toast(error.message); await loadMonth(); }
  finally { setUploadBusy(false); }
});
const field = (label, name, value, attrs = '') => html(`<label>${escape(t(label))}<input name="${name}" value="${escape(value)}" ${attrs}></label>`);
const nutrientNames = { calories: 'Energia (kcal)', protein: 'Fehérje (g)', carbs: 'Szénhidrát (g)', fat: 'Zsír (g)', fiber: 'Rost (g)', sugar: 'Cukor (g)', sodium: 'Nátrium (mg)', saturatedFat: 'Telített zsírsavak (g)' };
function openMeal(id) {
  const meal = state.meals.find(item => item.id === id);
  if (!meal) { toast(t('A bejegyzést még nem sikerült betölteni. Frissítsd a naplót.')); return; }
  state.edit = structuredClone(meal); state.dirty = false; state.recipeEditing = false; state.recipeBackup = null; renderDetail(); show('#meal-dialog');
}
function renderDetail() {
  const meal = state.edit, analysis = meal.analysis;
  $('#detail-heading').textContent = analysis ? meal.status === 'draft' ? t('Elkészült az elemzés') : t('Az étkezés részletei') : t(meal.status==='analyzing'?'Az étkezés feldolgozása folyamatban':'Befejezetlen elemzés');
  if (!analysis || !meal.photo || meal.job?.kind === 'delete') {
    $('#meal-detail').innerHTML = `<p class="dialog-intro ${meal.status==='analyzing'&&meal.job?.kind!=='delete'?'processing-feedback':''}" role="status">${escape(t(meal.error) || (meal.job?.kind === 'delete' ? t('A bejegyzés és a képek törlése még tart. Megszakadás esetén később folytatjuk.') : t('A fotót elmentettük, az elemzés még tart. Bezárhatod az ablakot; az eredményt később is megnyithatod.')))}</p>${meal.job?.state === 'failed' && meal.job?.kind === 'analyze' ? html('<p class="form-hint">Az újrapróbálás új AI-kérést indít.</p><button type="button" class="button primary" id="retry-meal">Elemzés újrapróbálása</button>') : ''}<button type="button" class="delete-button" id="delete-meal">${icon('trash')}${meal.job?.kind === 'delete' ? t('Törlés újrapróbálása') : t('Bejegyzés és kép törlése')}</button>${html('<div class="modal-actions"><button type="button" class="button primary" id="processing-ok" data-close>OK</button></div>')}`;
    $('#retry-meal')?.addEventListener('click', async event => {
      event.currentTarget.disabled = true;
      try { await request(`/api/meals/${meal.id}/retry`, { method: 'POST' }); state.pendingOpenId = meal.id; await loadMonth(); }
      catch (error) { toast(error.message); event.currentTarget.disabled = false; }
    });
    $('#delete-meal').addEventListener('click', askDelete); return;
  }
  const total = totals(analysis.ingredients);
  const previousAdjustments = $('#result-adjustments');
  const adjustmentsOpen = state.recipeEditing || previousAdjustments?.dataset.mealId === meal.id && previousAdjustments.open;
  $('#meal-detail').innerHTML = html`<form id="detail-form"><div class="detail-top"><img src="${escape(meal.photo.url)}" alt="${escape(analysis.name)}"><div class="detail-summary"><strong id="detail-calories">${integer(total.calories)}</strong><small> kcal</small><div class="detail-totals" id="detail-macros"></div><span class="confidence ${analysis.confidence}">${t('Az AI bizonyossági jelzése:')} ${{ low: t('Alacsony'), medium: t('Közepes'), high: t('Magas') }[analysis.confidence]}</span>${html(helpMarkup('confidence-help', t('Az AI bizonyossági jelzése'), t('Ez a modell saját bizonyossági jelzése, nem méréssel igazolt pontosság. A felismert neveket, mennyiségeket és forrásadatokat ettől függetlenül ellenőrizd.')))}</div></div><details id="result-adjustments" class="report-disclosure" data-meal-id="${escape(meal.id)}" ${adjustmentsOpen ? 'open' : ''}><summary>Adatok módosítása (opcionális)</summary><fieldset  class="detail-fields">${field(t('Az étel neve'), 'name', analysis.name, 'required maxlength="160"')}<div class="form-grid">${field(t('Dátum'), 'day', meal.day, 'type="date" required min="1900-01-01" max="2100-12-31"')}${field(t('Időpont'), 'time', meal.time, 'type="time" required')}<label class="full-width">Étkezés<select name="type">${TYPES.map(type => `<option value="${type}" ${type === meal.type ? 'selected' : ''}>${t(type)}</option>`).join('')}</select></label></div><div class="ingredient-heading"><h3>${t('Összetevők és adagok')} ${html(helpMarkup('edit-nutrients-help', t('Tápértékek szerkesztése'), t('A mennyiségnél a teljes naplózandó adagot add meg. A lenyitható tápértékmezőkbe 100 g-ra vagy 100 ml-re megadott adat kerül, nem az egész adag értéke. Például 150 g étel 200 kcal/100 g mellett 300 kcal-t ad a naplóhoz.')))}</h3><button type="button" class="text-button" id="add-ingredient">${icon('plus')}Hozzáadás</button></div><div id="ingredient-list">${analysis.ingredients.map((item, index) => html`<div class="ingredient-row" data-ingredient="${index}"><div class="ingredient-main">${field(t('Összetevő'), `i-${index}-name`, item.name, 'required maxlength="160"')}${field(item.quantityUnit === 'ml' ? t('Az összetevő teljes térfogata (ml)') : t('Az összetevő teljes tömege (g)'), `i-${index}-grams`, item.grams, 'type="number" step="any" min="0.001" max="5000" required')}<button class="icon-button" type="button" data-remove="${index}" aria-label="Összetevő törlése">${icon('x')}</button></div><details><summary>${t(item.quantityUnit === 'ml' ? 'Tápértékek 100 ml-ben · szerkesztés' : 'Tápértékek 100 g-ban · szerkesztés')}</summary><div class="nutrient-inputs">${NUTRIENTS.map(key => field(nutrientNames[key], `i-${index}-${key}`, item[key] ?? '', `type="number" step="any" min="0" max="${key === 'calories' ? 1000 : key === 'sodium' ? 100000 : item.quantityUnit === 'ml' ? 200 : 100}" ${OPTIONAL_NUTRIENTS.includes(key) ? 'placeholder="Ismeretlen"' : 'required'}`)).join('')}</div></details></div>`).join('')}</div><div class="detail-extra" id="detail-extra"></div><details class="report-disclosure"><summary>Megjegyzés <span>nem kötelező</span></summary><label>Megjegyzés<textarea name="notes" rows="2" maxlength="2000">${escape(meal.notes)}</textarea></label></details></fieldset></details><p class="form-error" id="detail-error" role="alert" hidden></p><div class="detail-footer">${html`<button type="button" class="delete-button" id="delete-meal">${icon('trash')}Törlés</button><button type="submit" class="button primary" id="save-meal">${meal.status === 'draft' ? t('Mentés a naplómba') : t('Módosítások mentése')}</button>`}</div></form>`;
  $('#result-adjustments').insertAdjacentHTML('beforebegin', reportMarkup(meal));
  $('#detail-form').addEventListener('invalid', () => { $('#result-adjustments').open = true; }, true);
  $('.ingredient-heading').insertAdjacentHTML('beforebegin', recipeMarkup(analysis, state.recipeEditing));
  if (state.recipeEditing) {
    $('#detail-heading').textContent = t('A teljes recept összeállítása');
    $('.ingredient-heading h3').textContent = t('A teljes recept alapanyagai');
    $('.detail-summary > small').textContent = t(' kcal a teljes recept alapanyagaiban');
    $('#meal-detail .analysis-report').hidden = true;
    $('#save-meal').disabled = true;
  }
  $('#recipe-start')?.addEventListener('click', startRecipe);
  $('#recipe-edit')?.addEventListener('click', startRecipe);
  $('#recipe-cancel')?.addEventListener('click', () => { state.edit.analysis = state.recipeBackup; state.recipeEditing = false; state.recipeBackup = null; renderDetail(); });
  $('#recipe-apply')?.addEventListener('click', () => {
    try {
      syncDetail();
      state.edit.analysis = validateAnalysis({ ...state.edit.analysis, portionScope: 'full_image', recipe: { cookedWeightG: Number($('#recipe-cooked').value), eatenWeightG: Number($('#recipe-eaten').value), lossesAccountedFor: $('#recipe-losses').checked, ingredients: structuredClone(state.edit.analysis.ingredients) } });
      state.recipeEditing = false; state.recipeBackup = null; state.dirty = true; renderDetail(); toast(t('Kiszámítottuk a teljes adag tápértékét a receptedből. Mentés előtt ellenőrizd az eredményt.'));
    } catch (error) { errorAt('#recipe-error', error); }
  });
  $('#ingredient-list').querySelectorAll('[data-ingredient]').forEach(row => {
    const index = Number(row.dataset.ingredient);
    row.querySelector('.ingredient-main').insertAdjacentHTML('afterend', ingredientMarkup(analysis.ingredients[index], index));
  });
  if (analysis.recipe) {
    $('#add-ingredient').hidden = true;
    $('#ingredient-list').querySelectorAll('input,select,button').forEach(element => { element.disabled = true; });
    $('#ingredient-list').querySelectorAll('.measured-toggle').forEach(element => { element.hidden = true; });
    $('#ingredient-list').querySelectorAll('.ingredient-main label:nth-child(2)').forEach((label, index) => { label.firstChild.textContent = t(analysis.ingredients[index].quantityUnit === 'ml' ? 'Az adagra jutó alapanyag (ml)' : 'Az adagra jutó alapanyag (g)'); });
  } else if (state.recipeEditing) $('#ingredient-list').querySelectorAll('.ingredient-main label:nth-child(2)').forEach((label, index) => { label.firstChild.textContent = t(analysis.ingredients[index].quantityUnit === 'ml' ? 'Az egész recepthez használt mennyiség (ml)' : 'Az egész recepthez használt mennyiség (g)'); });
  $('#ingredient-list').addEventListener('change', event => {
    const select = event.target.closest('[data-reference-index]'); if (!select) return;
    syncDetail(); const item = state.edit.analysis.ingredients[Number(select.dataset.referenceIndex)], reference = FOOD_REFERENCE[select.value];
    if (reference && (reference.quantityUnit || 'g') !== item.quantityUnit) { toast(t('A kiválasztott adat mértékegysége eltér az összetevőétől.')); return; }
    Object.assign(item, reference ? { ...reference.nutrients, referenceKey: select.value, referenceRecord: reference, foodState: reference.foodState || REFERENCE_STATES[select.value] || 'unknown', sourceType: 'reference', sourceConfirmed: true, preparation: getLanguage() === 'en' ? reference.description : reference.label } : { referenceKey: null, sourceType: 'user', sourceConfirmed: false });
    state.dirty = true; renderDetail(); toast(reference ? t('A tápértékeket a kiválasztott adatbázisadatok alapján számoljuk.') : t('Megtartottuk a saját tápértékadataidat.'));
  });
  $('#detail-form').addEventListener('input', event => { if (event.target.matches('[data-food-query]')) return; state.dirty = true; syncDetail(); updateDetailTotals(); });
  $('#detail-form').addEventListener('submit', saveMeal);
  $('#add-ingredient').addEventListener('click', () => {
    syncDetail();
    if (state.edit.analysis.ingredients.length >= 40) { toast(t('Legfeljebb 40 összetevő adható meg.')); return; }
    state.edit.analysis.ingredients.push({ name: '', grams: 100, gramsMin: 100, gramsMax: 100, weightBasis: 'user', sourceType: 'user', visibility: 'visible', preparation: t('Általad megadott adat'), calories: 0, protein: 0, carbs: 0, fat: 0, fiber: null, sugar: null, sodium: null, saturatedFat: null }); state.dirty = true; renderDetail();
  });
  $('#ingredient-list').addEventListener('click', event => {
    const confirmSource = event.target.closest('[data-confirm-source]');
    if (confirmSource) { syncDetail(); state.edit.analysis.ingredients[Number(confirmSource.dataset.confirmSource)].sourceConfirmed = true; state.dirty = true; confirmSource.textContent = t('✓ Ellenőriztem, hogy ez az összetevő'); return; }
    const remove = event.target.closest('[data-remove]'); if (!remove) return;
    if (state.edit.analysis.ingredients.length === 1) { toast(t('Legalább egy összetevő szükséges.')); return; }
    syncDetail(); state.edit.analysis.ingredients.splice(Number(remove.dataset.remove), 1); state.dirty = true; renderDetail();
  });
  $('#ingredient-list').addEventListener('click', async event => {
    const search = event.target.closest('[data-food-search]'), choose = event.target.closest('[data-food-id]');
    if (!search && !choose) return;
    const button = search || choose, index = Number(button.dataset.foodSearch ?? button.dataset.foodIndex), results = document.querySelector(`[data-food-results="${index}"]`); button.disabled = true;
    syncDetail();
    const editor = state.edit, ingredient = JSON.stringify(editor.analysis.ingredients[index]), token = {};
    foodRequests.set(results, token);
    const active = () => state.edit === editor && $('#meal-dialog').open && results.isConnected && foodRequests.get(results) === token;
    try {
      if (search) {
        const query = document.querySelector(`[data-food-query="${index}"]`).value;
        const { foods } = await request(`/api/food-sources/search?q=${encodeURIComponent(query)}`);
        if (!active() || document.querySelector(`[data-food-query="${index}"]`).value !== query) return;
        const suitable = foods.filter(food => food.quantityUnit === editor.analysis.ingredients[index].quantityUnit);
        const preparation = { raw: t('Nyers'), prepared: t('Elkészített'), as_sold: t('Forgalmazott állapot'), unknown: t('Nem ismert') };
        results.innerHTML = suitable.length ? suitable.map(food => `<button type="button" data-food-id="${escape(food.id)}" data-food-provider="${escape(food.provider)}" data-food-index="${index}">${escape(food.description)} <small>${escape(t(food.source))} · ${escape(preparation[food.foodState] || preparation.unknown)}</small></button>`).join('') : html('<p>Nincs találat. Próbálj másik angol ételnevet, vagy add meg az elkészítés módját is.</p>');
      } else {
        const { key, record } = await request(`/api/food-sources/${encodeURIComponent(choose.dataset.foodProvider)}/${encodeURIComponent(choose.dataset.foodId)}`);
        if (!active()) return;
        syncDetail();
        if (JSON.stringify(editor.analysis.ingredients[index]) !== ingredient) { toast(t('Az összetevő közben megváltozott. Válaszd ki újra az adatforrást.')); return; }
        if ((record.quantityUnit || 'g') !== editor.analysis.ingredients[index].quantityUnit) { toast(t('A kiválasztott adat mértékegysége eltér az összetevőétől.')); return; }
        FOOD_REFERENCE[key] = record;
        Object.assign(state.edit.analysis.ingredients[index], { ...record.nutrients, name: getLanguage() === 'en' ? record.description : record.label, referenceKey: key, referenceRecord: record, foodState: record.foodState || REFERENCE_STATES[key] || 'unknown', sourceType: 'reference', sourceConfirmed: true, preparation: record.description, alternatives: [] });
        state.dirty = true; renderDetail(); toast(t('Elmentettük a kiválasztott adatokat és a forrásukat. Ellenőrizd, hogy az elkészítés és a mennyiség megfelel-e az ételednek.'));
      }
    } catch (error) { if (active()) results.textContent = t(error.message); } finally { button.disabled = false; }
  });
  if (savingMeals.has(meal.id)) $('#save-meal').disabled = true;
  $('#delete-meal')?.addEventListener('click', askDelete); updateDetailTotals();
}
function startRecipe() {
  syncDetail(); state.recipeBackup = structuredClone(state.edit.analysis);
  if (state.edit.analysis.recipe) { state.edit.analysis.ingredients = structuredClone(state.edit.analysis.recipe.ingredients); delete state.edit.analysis.recipe; }
  state.recipeEditing = true; renderDetail();
  if (state.recipeBackup.recipe) { $('#recipe-cooked').value = state.recipeBackup.recipe.cookedWeightG; $('#recipe-eaten').value = state.recipeBackup.recipe.eatenWeightG; $('#recipe-losses').checked = true; }
}
function syncDetail() {
  const form = $('#detail-form'); if (!form) return;
  const data = new FormData(form), meal = state.edit;
  meal.analysis.name = String(data.get('name')); meal.day = String(data.get('day')); meal.time = String(data.get('time')); meal.type = String(data.get('type')); meal.notes = String(data.get('notes'));
  if (meal.analysis.recipe) return;
  meal.analysis.ingredients = meal.analysis.ingredients.map((item, index) => {
    const updated = { ...item, name: String(data.get(`i-${index}-name`)), grams: Number(data.get(`i-${index}-grams`)) };
    NUTRIENTS.forEach(key => { const value = data.get(`i-${index}-${key}`); updated[key] = value === '' && OPTIONAL_NUTRIENTS.includes(key) ? null : Number(value); });
    if (updated.grams !== item.grams) Object.assign(updated, { gramsMin: updated.grams, gramsMax: updated.grams, weightBasis: 'user' });
    if (data.get(`i-${index}-measured`)) Object.assign(updated, { gramsMin: updated.grams, gramsMax: updated.grams, weightBasis: 'measured_ingredient' });
    else if (item.weightBasis === 'measured_ingredient') updated.weightBasis = 'user';
    if (updated.name !== item.name || NUTRIENTS.some(key => updated[key] !== (item[key] ?? null))) Object.assign(updated, { sourceType: 'user', referenceKey: null, sourceConfirmed: false });
    return updated;
  });
}
function updateDetailTotals() {
  if (!state.edit?.analysis || !$('#detail-macros')) return;
  const report = refreshReport(state.edit), total = report.total;
  $('#detail-calories').textContent = integer(total.calories);
  $('#detail-macros').innerHTML = html`<span>${number(total.protein)} g fehérje</span><span>${number(total.carbs)} g szénhidrát</span><span>${number(total.fat)} g zsír</span>`;
  $('#detail-extra').innerHTML = [[t('Rost'), total.fiber, 'g'], [t('Cukor'), total.sugar, 'g'], [t('Telített zsírsavak'), total.saturatedFat, 'g'], [t('Nátrium'), total.sodium, 'mg'], [t('Számított sótartalom'), report.salt, 'g']].map(([label, value, unit]) => `<span>${label}<strong>${label === t('Számított sótartalom') ? saltNumber(value) : number(value)}${value === null ? '' : ` ${unit}`}</strong></span>`).join('');
}
async function saveMeal(event) {
  event.preventDefault();
  if (savingMeals.has(state.edit.id)) return;
  if (state.recipeEditing) { toast(t('Előbb kattints az „Adag kiszámítása” gombra, vagy szakítsd meg a recept szerkesztését a „Mégsem” gombbal.')); return; }
  $('#detail-error').hidden = true; syncDetail();
  try { validateAnalysis(state.edit.analysis); metadata(state.edit); } catch (error) { errorAt('#detail-error', error); return; }
  const editor = state.edit, body = JSON.stringify(editor), button = $('#save-meal');
  savingMeals.add(editor.id); button.disabled = true;
  try {
    const { meal } = await request(`/api/meals/${editor.id}`, { method: 'PATCH', body });
    const active = state.edit === editor && $('#meal-dialog').open;
    if (active) syncDetail();
    const edited = active && (state.recipeEditing || JSON.stringify(editor) !== body);
    if (active && !edited) {
      state.dirty = false; $('#meal-dialog').close(); state.selected = meal.day; state.month = meal.day.slice(0, 7);
    } else if (edited) {
      Object.assign(editor, { revision: meal.revision, status: meal.status, updatedAt: meal.updatedAt }); state.dirty = true;
    }
    state.meals = [...state.meals.filter(item => item.id !== meal.id), meal]; render(); await loadMonth();
    const reward = await loadProfile(request, { quiet: true, celebrate: true });
    toast(edited ? t('A korábbi változatot elmentettük. A mostani módosításaid még nincsenek mentve.') : reward || t('Elmentettük az étkezést a naplódba.'));
  } catch (error) { if (state.edit === editor && $('#meal-dialog').open) errorAt('#detail-error', error); else toast(error.message); }
  finally { savingMeals.delete(editor.id); button.disabled = false; if (state.edit?.id === editor.id && $('#save-meal')) $('#save-meal').disabled = state.recipeEditing; }
}
function askDelete() { state.deleting = state.edit.id; $('#delete-error').hidden = true; show('#confirm-dialog'); }
$('#confirm-delete').addEventListener('click', async event => {
  const button = event.currentTarget, id = state.deleting, editor = state.edit; button.disabled = true; $('#delete-error').hidden = true;
  try {
    await request(`/api/meals/${id}`, { method: 'DELETE' });
    if (state.deleting === id) $('#confirm-dialog').close();
    if (state.edit === editor) { state.dirty = false; $('#meal-dialog').close(); }
    await loadMonth(); await loadProfile(request, { quiet: true }); toast(t('A törlés elindult. A képek törlése után a bejegyzést is eltávolítjuk.'));
  } catch (error) { if (state.deleting === id && $('#confirm-dialog').open) errorAt('#delete-error', error); else toast(error.message); }
  finally { button.disabled = false; }
});
render(); await initialize();
setInterval(() => { if (!document.hidden && state.meals.some(meal => ['uploading', 'queued', 'running'].includes(meal.job?.state))) loadMonth(); }, 3000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) { loadMonth(); loadProfile(request, { quiet: true }); } });
let languageSnapshot;
window.addEventListener('languagechanging', () => {
  if ($('#detail-form')) syncDetail();
  languageSnapshot = {
    fields: [...document.querySelectorAll('#meal-detail input,#meal-detail textarea,#meal-detail select')].map(element => ({ name: element.name, id: element.id, query: element.dataset.foodQuery, value: element.value, checked: element.checked })),
    open: [...document.querySelectorAll('#meal-detail details')].map(element => element.open),
    scroll: $('#meal-dialog').scrollTop,
    errors: [...document.querySelectorAll('#meal-detail [data-message]')].filter(element => !element.hidden).map(element => ({id:element.id,source:element.dataset.message})),
  };
});
window.addEventListener('languagechange', () => {
  setUploadBusy(state.busy); renderProfile(); renderMotivation();
  $('#dish-guidance').innerHTML = dishGuidance($('#dish-profile').value);
  $('#analyze-button').innerHTML = `${icon('sparkles')}${t('Elemzés indítása')}`;
  if (state.edit && $('#meal-dialog').open) {
    renderDetail();
    for (const field of languageSnapshot?.fields || []) {
      const element = field.name ? $('#detail-form')?.elements.namedItem(field.name) : field.id ? document.getElementById(field.id) : document.querySelector(`[data-food-query="${field.query}"]`);
      if (element) { element.value = field.value; if (element.type === 'checkbox') element.checked = field.checked; }
    }
    document.querySelectorAll('#meal-detail details').forEach((element, index) => { element.open = languageSnapshot?.open[index] ?? element.open; });
    $('#meal-dialog').scrollTop = languageSnapshot?.scroll || 0;
    for (const error of languageSnapshot?.errors || []) if (document.getElementById(error.id)) errorAt('#'+error.id, error.source);
  }
  for (const element of document.querySelectorAll('[data-message]')) element.textContent = t(element.dataset.message);
});
