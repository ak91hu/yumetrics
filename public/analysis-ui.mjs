import { analysisReport } from '/domain.mjs';
import { FOOD_REFERENCE } from '/food-reference.mjs';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const fmt = value => value == null ? '—' : new Intl.NumberFormat('hu-HU', { maximumFractionDigits: 1 }).format(value);
const weightNote = meal => meal.analysis.ingredients.some(item => item.weightBasis === 'user') ? 'Kézzel pontosított összetevők alapján' : meal.context?.totalWeightG ? 'Lemért össztömeg alapján, becsült felosztással' : 'Összetevők becsült tömegének összege';
export function installAnalysisUI() {
  document.querySelector('.page-heading h1').textContent = 'Ahogy neked jólesik.';
  document.querySelector('.page-heading p').textContent = 'A saját étkezéseid, egy kicsit jobban megismerve.';
  document.querySelector('#hero-title').innerHTML = 'Egy tányér.<br>Sok kis részlet.';
  document.querySelector('.hero-content p').innerHTML = 'Amit a kép megmutat. Amit becsülünk.<br>És amit te tudsz a legjobban.';
  document.querySelector('#upload-form .form-grid').insertAdjacentHTML('beforebegin', `
    <div class="capture-guide"><span>01</span><div><strong>Mutasd meg az egész adagot.</strong><p>Világos kép felülről; egy másik nézet segít a magasság megítélésében.</p></div></div>
    <details class="context-panel" id="context-panel"><summary>Egy kis segítség a pontosabb becsléshez <span>opcionális</span></summary>
      <div class="context-fields"><div class="form-grid"><label>Lemért teljes ételtömeg (g)<input id="context-weight" type="number" min="1" max="5000" step="any" placeholder="Tányér nélkül, ha lemérted"></label><label>Tányér átmérője (cm)<input id="context-diameter" type="number" min="5" max="60" step="any" placeholder="Csak ha tényleg ismered"></label></div>
      <label>A képen látható adag hány %-át etted meg?<input id="context-consumed" type="number" min="1" max="100" value="100" step="any"></label>
      <label class="second-photo-picker">Második nézet ugyanarról az adagról<input id="second-photo-input" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif"><span>Oldalról vagy kb. 45°-ból · ugyanaz az étel</span></label>
      <div class="second-preview-wrap" hidden><img id="second-photo-preview" alt="Az étel második nézete"><button type="button" id="remove-second-photo">Második kép eltávolítása</button></div>
      <p class="form-hint">A plusz adat segít, de nem teszi méréssé a fotót. A százalék minden összetevőre azonos arányban vonatkozik; eltérő maradékot később külön grammokkal javíthatsz.</p></div>
    </details><ol class="analysis-steps" aria-label="Az elemzés lépései"><li><b>1</b>Fotó és támpontok</li><li><b>2</b>Összetevők és források</li><li><b>3</b>Átnézés és mentés</li></ol>`);
  document.querySelector('.daily-section').insertAdjacentHTML('beforeend', '<div class="daily-details" id="daily-details"></div>');
  document.querySelector('#analysis-progress').textContent = 'Összetevő-leltár, adagbecslés és tápértékek ellenőrzése… Ez néhány percig is tarthat. Az eredményt mentés előtt átnézheted.';
  document.querySelector('.hero-content small').textContent = 'Felismerés · Források · Te döntesz a mentésről';
  document.querySelector('#learn-dialog ol').innerHTML = '<li><strong>Mutasd meg az egész adagot.</strong> Világos kép felülről, egy második nézet oldalról vagy 45°-ból. A két kép ugyanarról az étkezésről készüljön.</li><li><strong>Amit megmértél, add meg.</strong> Az étel tömege tányér nélkül, a tányér ismert átmérője, az elkészítés és az elfogyasztott hányad segíti a becslést.</li><li><strong>Nézd át a párosítást.</strong> A főtt rizshez főtt referencia kell. Az olajat ne számold kétszer; a saját grammok és tápértékek módosíthatók.</li>';
  document.querySelector('#learn-dialog .learn-content').insertAdjacentHTML('beforeend', '<p>A forráscímke megkülönbözteti az USDA-referenciaértéket, az AI-becslést és a saját módosításodat. A referencia kiválasztása nem igazolja, hogy a fotón pontosan az az étel szerepel. Az energia-forgatókönyv csak az adagméretből eredő eltérést mutatja, nem teljes hibahatárt.</p>');
}
export function reportMarkup(meal) {
  const a = meal.analysis, report = analysisReport(a), quality = { good: 'Jól értékelhető kép', limited: 'Néhány részlet bizonytalan', poor: 'Új fotó segítene' };
  const questions = a.questions ?? [], observations = a.observations ?? [];
  const range = report.energyRange;
  return `<section class="analysis-report" aria-label="Részletes ételértékelés">
    <div class="report-intro"><span class="report-kicker">A FOTÓ TÖRTÉNETE</span><h3 id="report-name">${esc(a.name)}</h3><p>${esc(a.summary || 'Ez egy korábbi elemzés. Az összetevők és az adagok továbbra is pontosíthatók.')}</p>${meal.context ? `<p class="context-note">Kiinduló támpontok: ${meal.context.totalWeightG ? `${fmt(meal.context.totalWeightG)} g teljes étel · ` : ''}${meal.context.plateDiameterCm ? `${fmt(meal.context.plateDiameterCm)} cm tányér · ` : ''}${fmt(meal.context.consumedPercent)}% elfogyasztva${meal.context.additionalView ? ' · két nézet' : ''}. A kézzel javított adagokra nem alkalmazzuk újra a százalékot.</p>` : ''}</div>
    <div class="report-metrics"><article><small>Elfogyasztott tömeg</small><strong id="report-weight">${fmt(report.weight)} <em>g</em></strong><span id="report-weight-note">${weightNote(meal)}</span></article><article><small>Adagból eredő energia-forgatókönyv</small><strong id="report-range">${fmt(range.min)}${range.min === range.max ? '' : `–${fmt(range.max)}`} <em>kcal</em></strong><span>Azonos tápértékek, kisebb/nagyobb adag. Nem statisztikai pontossági sáv.</span></article></div>
    <div class="source-overview"><span class="source-leaf">↗</span><div><strong id="report-source-count">${report.referenceCount}/${a.ingredients.length} összetevő USDA-referenciával</strong><p id="report-source-note">${report.referenceCount ? 'A referencia ellenőrizhető; az ételhez párosítást neked is érdemes átnézni.' : 'Nincs megfelelő adatbázispárosítás. Ezek becslések vagy saját értékek; alább választhatsz referenciát.'}</p></div></div>
    <details class="report-disclosure" ${questions.length ? 'open' : ''}><summary>Mit érdemes még pontosítani? <span>${questions.length || '✓'}</span></summary><div class="report-disclosure-body">${questions.length ? `<ul>${questions.map(q => `<li>${esc(q)}</li>`).join('')}</ul><p>Az ismert választ a megjegyzésben rögzítheted; a számításhoz az adagokat és tápértékeket az alábbi mezőkben javítsd. A megjegyzés szerkesztése nem indít új AI-hívást.</p>` : '<p>Nincs külön kérdés. A rejtett olajat, öntetet és az adagokat ettől még érdemes ellenőrizni.</p>'}</div></details>
    <details class="report-disclosure"><summary>Mit mutat a kép, és mi bizonytalan?<span>+</span></summary><div class="report-disclosure-body"><p class="quality-label">${esc(quality[a.imageQuality?.level] || 'Korábbi, egyszerű elemzés')}</p>${observations.length ? `<ul>${observations.map(item => `<li>${esc(item)}</li>`).join('')}</ul>` : ''}${a.imageQuality?.issues?.length ? `<p>${a.imageQuality.issues.map(esc).join(' · ')}</p>` : ''}<p>${esc(a.assumptions)}</p><p>A fotó nem igazol allergénmentességet. Vitaminokat, glikémiás indexet és egészségpontszámot ebből nem állapítunk meg.</p></div></details>
    <div id="report-warnings" class="report-warnings" ${report.warnings.length ? '' : 'hidden'}>${report.warnings.map(esc).join('<br>')}</div>
    ${meal.photo?.additional ? `<div class="additional-view"><img src="${esc(meal.photo.additional.url)}" alt="Az étel második nézete"><span>Második nézet · ugyanaz az adag, egyszer számolva</span></div>` : ''}
  </section>`;
}
export function ingredientMarkup(item, index) {
  const reference = FOOD_REFERENCE[item.referenceKey], source = item.sourceType === 'reference' && reference ? 'USDA-referencia' : item.sourceType === 'user' ? 'Saját értékek' : 'AI-becslés';
  return `<div class="ingredient-evidence"><span class="source-pill ${reference ? 'reference' : 'estimated'}" data-source-label="${index}">${source}</span><span>${esc(item.preparation || 'Elkészítés nincs pontosítva')}</span>${item.visibility === 'inferred' ? '<span class="inferred-pill">Feltételezett összetevő</span>' : ''}</div>
    <p class="portion-evidence" data-portion-label="${index}">${fmt(item.calories * item.grams / 100)} kcal az adagban${item.gramsMin != null && item.gramsMin !== item.gramsMax ? ` · ${fmt(item.gramsMin)}–${fmt(item.gramsMax)} g lehetséges adag` : ''}</p>
    ${item.portionNote ? `<p class="portion-evidence">${esc(item.portionNote)}</p>` : ''}
    ${item.alternatives?.length ? `<p class="portion-evidence">Lehetséges alternatíva: ${item.alternatives.map(esc).join(', ')}</p>` : ''}
    <details class="source-picker" data-current-source="${esc(`${item.referenceKey || ''}/${item.sourceType}/${item.sourceConfirmed}`)}"><summary>Tápértékforrás ellenőrzése vagy cseréje</summary><div>${reference ? `<a href="${reference.url}" target="_blank" rel="noopener noreferrer">${esc(reference.label)} · FDC ${reference.fdcId} ↗</a><p>${esc(reference.description)} · ${reference.dataType} · letöltve: ${reference.retrievedAt}</p><button type="button" class="confirm-source" data-confirm-source="${index}">${item.sourceConfirmed ? '✓ A párosítást ellenőriztem' : 'Ez megfelel az összetevőnek'}</button>` : '<p>Ehhez az összetevőhöz nincs megfelelően párosított adatbázisrekord. A tápértékeket AI vagy a felhasználó adta meg.</p>'}
    <label>Másik, azonos elkészítésű referencia<select data-reference-index="${index}"><option value="">Saját / becsült értékek megtartása</option>${Object.entries(FOOD_REFERENCE).map(([key, food]) => `<option value="${key}" ${key === item.referenceKey ? 'selected' : ''}>${esc(food.label)}</option>`).join('')}</select></label><p>A csere a 100 g-os tápértékeket írja át, az adagot megtartja. A nyers/főtt állapot és a márka eltérése számít.</p></div></details>`;
}
export function refreshReport(meal) {
  const report = analysisReport(meal.analysis), range = report.energyRange;
  const rangeElement = document.querySelector('#report-range');
  const name = document.querySelector('#report-name'); if (name) name.textContent = meal.analysis.name || 'Étkezés';
  const weight = document.querySelector('#report-weight'); if (weight) weight.innerHTML = `${fmt(report.weight)} <em>g</em>`;
  const basis = document.querySelector('#report-weight-note'); if (basis) basis.textContent = weightNote(meal);
  if (rangeElement) rangeElement.innerHTML = `${fmt(range.min)}${range.min === range.max ? '' : `–${fmt(range.max)}`} <em>kcal</em>`;
  const count = document.querySelector('#report-source-count');
  if (count) count.textContent = `${report.referenceCount}/${meal.analysis.ingredients.length} összetevő USDA-referenciával`;
  const note = document.querySelector('#report-source-note'); if (note) note.textContent = report.referenceCount ? 'A referencia ellenőrizhető; az ételhez párosítást neked is érdemes átnézni.' : 'Nincs megfelelő adatbázispárosítás. Ezek becslések vagy saját értékek; alább választhatsz referenciát.';
  const warning = document.querySelector('#report-warnings');
  if (warning) { warning.hidden = !report.warnings.length; warning.textContent = report.warnings.join(' '); }
  meal.analysis.ingredients.forEach((item, index) => {
    const label = document.querySelector(`[data-source-label="${index}"]`);
    if (label) { label.textContent = item.sourceType === 'reference' ? 'USDA-referencia' : item.sourceType === 'user' ? 'Saját értékek' : 'AI-becslés'; label.className = `source-pill ${item.sourceType === 'reference' ? 'reference' : 'estimated'}`; }
    const portion = document.querySelector(`[data-portion-label="${index}"]`);
    if (portion) portion.textContent = `${fmt(item.calories * item.grams / 100)} kcal az adagban${item.weightBasis === 'user' ? ' · kézzel pontosított tömeg' : item.gramsMin != null ? ` · ${fmt(item.gramsMin)}–${fmt(item.gramsMax)} g lehetséges adag` : ''}`;
    const source = document.querySelector(`[data-ingredient="${index}"] .source-picker`);
    if (source && source.dataset.currentSource !== `${item.referenceKey || ''}/${item.sourceType}/${item.sourceConfirmed}`) {
      const fragment = document.createElement('div'); fragment.innerHTML = ingredientMarkup(item, index); source.replaceWith(fragment.querySelector('.source-picker'));
    }
  });
  return report;
}
