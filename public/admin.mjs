const $ = selector => document.querySelector(selector);
const escape = value => String(value ?? '—').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]);
const number = value => value == null ? '—' : new Intl.NumberFormat('hu-HU', { maximumFractionDigits: 1 }).format(Number(value));
const date = value => value ? new Intl.DateTimeFormat('hu-HU', { dateStyle:'short',timeStyle:'short' }).format(new Date(value)) : '—';
const labels = { saved:'Mentett', draft:'Piszkozat', failed:'Sikertelen', analyzing:'Elemzés alatt', queued:'Várakozik', running:'Fut', uploading:'Feltöltés', done:'Kész', analyze:'Elemzés', delete:'Törlés' };
const pill = value => `<span class="admin-pill ${value === 'failed' ? 'warning' : ''}">${escape(labels[value] || value)}</span>`;
const metric = (label,value,note='') => `<article class="admin-card"><span>${escape(label)}</span><strong>${number(value)}</strong><span>${escape(note)}</span></article>`;
const table = (caption,heads,rows) => `<div class="admin-table-wrap"><table class="admin-table"><caption>${escape(caption)}</caption><thead><tr>${heads.map(head=>`<th scope="col">${escape(head)}</th>`).join('')}</tr></thead><tbody>${rows.length ? rows.join('') : `<tr><td colspan="${heads.length}">Nincs megjeleníthető adat.</td></tr>`}</tbody></table></div>`;
const pager = data => `<div class="admin-pagination"><span>${number(data.total)} találat · ${data.page}. oldal</span><div><button class="button outline" data-page="${data.page-1}" ${data.page<=1?'disabled':''}>← Előző</button><button class="button outline" data-page="${data.page+1}" ${data.page*data.pageSize>=data.total?'disabled':''}>Következő →</button></div></div>`;
const option = (value,text,selected) => `<option value="${escape(value)}" ${value===selected?'selected':''}>${escape(text)}</option>`;
let loadVersion=0, userEmail;
function route() { const [view='overview',query=''] = location.hash.slice(1).split('?'); return { view:view || 'overview', params:new URLSearchParams(query) }; }
function navigate(view,params=new URLSearchParams()) { location.hash = view + (params.size ? '?' + params.toString() : ''); }
function message(text,error=false) { $('#admin-message').textContent=text; $('#admin-message').hidden=false; $('#admin-message').classList.toggle('error',error); }
async function request(path, options={}) {
  const response = await fetch('/api/admin'+path,{...options,headers:{...(options.body?{'Content-Type':'application/json'}:{})},cache:'no-store'});
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'A művelet nem sikerült.');
  return result;
}
function barChart(rows,key,title) {
  const max=Math.max(1,...rows.map(row=>Number(row[key])));
  return `<section class="admin-panel"><h2>${escape(title)}</h2><div class="admin-bars">${rows.length ? rows.map(row=>`<div class="admin-bar"><span>${escape(row.day)}</span><meter value="${row[key]}" min="0" max="${max}" aria-label="${escape(row.day)}: ${row[key]}">${row[key]}</meter><span>${number(row[key])}</span></div>`).join('') : '<p class="admin-note">Ebben az időszakban még nincs adat.</p>'}</div></section>`;
}
async function overview(params) {
  const days=params.get('days')||'30', data=await request('/overview?days='+encodeURIComponent(days));
  const {counts:c,activity:a,tokens:t}=data;
  return `<form class="admin-toolbar" id="period-filter"><label>Időszak<select name="days">${[['7','Elmúlt 7 nap'],['30','Elmúlt 30 nap'],['365','Elmúlt 365 nap']].map(([v,l])=>option(v,l,days)).join('')}</select></label><button class="button outline">Mutasd</button><span class="admin-note">${escape(data.start.slice(0,10))} – ${escape(data.today)} · UTC szerinti napok</span></form>
  <div class="admin-grid">${metric('Összes felhasználó',c.users,`${data.newUsers} új a kiválasztott időszakban`)}${metric('Aktív naplózók',a.active_users,'Legalább egy létrehozott bejegyzés az időszakban')}${metric('Összes mentett étkezés',c.saved_meals,`${c.meals} bejegyzés minden állapottal`)}${metric('Elemzési próbálkozások',data.attempts,'Az időszakban lefoglalt elemzések és újrapróbálások')}${metric('Érvényes munkamenetek',c.sessions,'Aktuális, még nem lejárt belépések')}${metric('Átlagos elemzési idő',a.average_latency_ms==null?null:Number(a.average_latency_ms)/1000,'Másodperc · a megőrzött, befejezett válaszokból')}${metric('Bemeneti / kimeneti tokenek',t.input_tokens,`${number(t.output_tokens)} kimeneti token`)}${metric('Tiltott felhasználók',c.blocked_users,`${c.cached_foods} tárolt USDA-forrás`)}</div>
  <div class="admin-columns">${barChart(data.daily,'meals','Új bejegyzések naponta')}${barChart(data.registrations,'users','Új felhasználók naponta')}</div>
  <section class="admin-panel"><h2>Elemzések és használat</h2><p class="admin-note">${number(a.meals)} létrehozott bejegyzés az időszakban; ${number(a.usage_records || 0)} megőrzött tokenkimutatás. Cache: ${number(t.cached_tokens)} token · gondolkodási tokenek: ${number(t.thought_tokens)}. A törölt bejegyzések és a szolgáltató által vissza nem adott használati adatok hiányozhatnak; ez nem számla vagy teljes költségkimutatás.</p>${table('Modellek és módszerváltozatok',['Modell','Módszer','Befejezett elemzések','Átlagos idő'],data.models.map(row=>`<tr><td>${escape(row.model)}</td><td>${escape(row.prompt_version)}</td><td>${number(row.count)}</td><td>${number(Number(row.average_latency_ms)/1000)} s</td></tr>`))}</section>
  <div class="admin-columns"><section class="admin-panel"><h2>Bejegyzések állapota</h2>${table('Az időszakban létrehozott bejegyzések',['Állapot','Darab'],data.statuses.map(row=>`<tr><td>${pill(row.status)}</td><td>${number(row.count)}</td></tr>`))}<h3>Étkezéstípusok</h3>${table('Az időszak mentett bejegyzései',['Típus','Darab'],data.types.map(row=>`<tr><td>${escape(row.type)}</td><td>${number(row.count)}</td></tr>`))}</section><section class="admin-panel"><h2>Feldolgozási sor</h2>${table('Jelenlegi teljes feladatsor',['Művelet','Állapot','Darab'],data.jobs.map(row=>`<tr><td>${pill(row.kind)}</td><td>${pill(row.state)}</td><td>${number(row.count)}</td></tr>`))}<p class="admin-note">Az áttekintés frissítve: ${escape(date(data.generatedAt))}</p></section></div>`;
}
async function users(params) {
  const data=await request('/users?'+params), q=params.get('q')||'';
  return `<form class="admin-toolbar" id="user-filter"><label class="admin-search">Név vagy e-mail-cím<input name="q" value="${escape(q)}" maxlength="200" placeholder="Felhasználó keresése"></label><button class="button primary">Keresés</button></form>${table('Google-fiókkal belépett felhasználók',['Felhasználó','Csatlakozás','Bejegyzések / belépések','Napi keret','Hozzáférés','Műveletek'],data.items.map(user=>{
    const owner=user.email.toLowerCase()===userEmail?.toLowerCase();
    return `<tr data-user="${escape(user.id)}"><td><strong>${escape(user.name)}</strong><small>${escape(user.email)}</small></td><td>${escape(date(user.created_at))}</td><td>${number(user.meals)} / ${number(user.sessions)}</td><td><input data-goal type="number" min="500" max="10000" step="1" value="${user.calorie_goal}" aria-label="${escape(user.email)} napi energiakerete" ${owner?'disabled':''}></td><td><label><input data-block type="checkbox" ${Number(user.blocked)?'checked':''} ${owner?'disabled':''}>Tiltva</label></td><td><div class="admin-action-row">${owner?'<span class="admin-note">Tulajdonos</span>':`<button class="button outline" data-save-user="${escape(user.id)}">Mentés</button><button class="button outline" data-revoke="${escape(user.id)}">Kijelentkeztetés</button>`}<button class="button outline" data-user-meals="${escape(user.id)}">Bejegyzések</button></div></td></tr>`;
  }))}${pager(data)}`;
}
async function meals(params) {
  const data=await request('/meals?'+params), status=params.get('status')||'';
  return `<form class="admin-toolbar" id="meal-filter"><label>Állapot<select name="status">${option('','Minden állapot',status)}${['saved','draft','failed','analyzing'].map(v=>option(v,labels[v],status)).join('')}</select></label>${params.get('userId')?`<input type="hidden" name="userId" value="${escape(params.get('userId'))}"><span class="admin-note">Egy felhasználóra szűrve</span><a href="#meals">Szűrés törlése</a>`:''}<button class="button outline">Szűrés</button></form>${table('Bejegyzések, a legújabbtól',['Felhasználó','Étkezés dátuma','Típus / állapot','Elemzés','Művelet'],data.items.map(meal=>`<tr><td>${escape(meal.email)}</td><td>${escape(meal.day)} ${escape(meal.time)}<small>Létrehozva: ${escape(date(meal.created_at))}</small></td><td>${escape(meal.type)}<br>${pill(meal.status)}</td><td>${escape(meal.model)}<small>${meal.latency_ms==null?'—':number(meal.latency_ms/1000)+' s'}</small>${meal.error?`<small>${escape(meal.error)}</small>`:''}</td><td><button class="button outline" data-meal="${escape(meal.id)}">Részletek</button></td></tr>`))}${pager(data)}`;
}
async function jobs(params) {
  const data=await request('/jobs?'+params), state=params.get('state')||'';
  return `<form class="admin-toolbar" id="job-filter"><label>Állapot<select name="state">${option('','Minden állapot',state)}${['queued','running','uploading','failed','done'].map(v=>option(v,labels[v],state)).join('')}</select></label><button class="button outline">Szűrés</button></form>${table('Feldolgozási feladatok és hibák',['Felhasználó','Művelet / állapot','Futások','Utoljára frissült','Hiba / foglalás','Bejegyzés'],data.items.map(job=>`<tr><td>${escape(job.email)}</td><td>${pill(job.kind)} ${pill(job.state)}</td><td>${number(job.attempts)}</td><td>${escape(date(job.updated_at))}</td><td>${escape(job.error)}<small>Foglalás lejárata: ${escape(date(job.lease_until))}</small></td><td><button class="button outline" data-meal="${escape(job.meal_id)}">Részletek</button></td></tr>`))}${pager(data)}<p class="admin-note">Az újrapróbálást a bejegyzés tulajdonosa indíthatja a naplójából. Az elemzés újrapróbálása új szolgáltatói költséggel járhat.</p>`;
}
async function settings() {
  const data=await request('/settings'), s=data.settings;
  const numeric=(key,label,min,max)=>`<label>${label}<input name="${key}" type="number" min="${min}" max="${max}" step="1" value="${s[key]}" required></label>`;
  return `<form id="admin-settings" data-revision="${data.revision}" class="admin-panel"><h2>Működési beállítások</h2><p class="admin-note">A mentett értékek újraindítás után is megmaradnak. Az új korlátok a következő feltöltésre, az AI-beállítások a következő induló elemzésre vonatkoznak; a már futó kéréseket nem szakítják meg.</p><div class="admin-settings"><label class="admin-check">Új elemzések engedélyezése<input type="checkbox" name="analysesEnabled" ${s.analysesEnabled?'checked':''}></label><label class="admin-check">Új Google-fiókok regisztrációja<input type="checkbox" name="registrationEnabled" ${s.registrationEnabled?'checked':''}></label>${numeric('hourlyLimit','Óránkénti elemzési korlát / felhasználó',1,1000)}${numeric('dailyLimit','Napi elemzési korlát / felhasználó',1,10000)}${numeric('defaultCalorieGoal','Új fiókok alapértelmezett napi energiakerete (kcal)',500,10000)}<label>AI-modell azonosítója<input name="model" value="${escape(s.model)}" maxlength="100" required></label>${numeric('maxOutputTokens','Válasz maximális tokenkerete',1000,30000)}${numeric('aiTimeoutSeconds','AI-várakozási idő (másodperc)',10,75)}<p class="admin-note full">Új fiókok letiltásakor a már regisztrált felhasználók továbbra is beléphetnek. Az adminisztrátori hozzáférés megmarad. Modellváltás előtt ellenőrizd a szolgáltató támogatását és árazását; a napló Gemini-kompatibilis strukturált választ vár.</p><button class="button primary" type="submit">Beállítások mentése</button></div></form>
  <section class="admin-panel"><h2>Kapcsolatok</h2><p class="admin-note">A jelzések a szerver beállításainak meglétét mutatják. Nem ellenőrzik az API-kulcsok érvényességét vagy a szolgáltatói egyenleget. Ez az információ kizárólag itt látható.</p>${table('Szerveroldali integrációk',['Kapcsolat','Beállítás'],[['Google-belépés',data.google],['OpenCode · AI',data.services.ai],['Cloudinary · fotók',data.services.photos],['USDA · keresés',data.services.usda]].map(([name,ready])=>`<tr><td>${escape(name)}</td><td><span class="admin-pill ${ready?'':'warning'}">${ready?'Megadva':'Hiányzik'}</span></td></tr>`))}<dl class="admin-meta"><div><dt>Adatbázis</dt><dd>${escape(data.database)}</dd></div><div><dt>Elsődleges alkalmazáscím</dt><dd>${escape(data.origin)}</dd></div><div><dt>Google-visszatérési cím</dt><dd>${escape(data.redirectUri)}</dd></div><div><dt>Tulajdonos</dt><dd>${escape(userEmail)}</dd></div></dl><p class="admin-note">Az API-kulcsok, Google-hitelesítési adatok, adatbázis-kapcsolat és domainek a Northflank titkos környezeti beállításaiban kezelhetők. Ezek értékei nem kerülnek a böngészőbe vagy a változásnaplóba.</p><a class="button outline" href="https://app.northflank.com/" target="_blank" rel="noopener noreferrer">Northflank megnyitása ↗</a></section>`;
}
async function audit(params) {
  const data=await request('/audit?'+params);
  const actions={'settings.update':'Alkalmazásbeállítások módosítása','user.update':'Felhasználó módosítása','sessions.revoke':'Munkamenetek visszavonása'};
  return table('Adminisztrátori változások',['Időpont','Művelet','Végrehajtó','Érintett','Részletek'],data.items.map(row=>`<tr><td>${escape(date(row.created_at))}</td><td>${escape(actions[row.action]||row.action)}</td><td>${escape(row.email)}</td><td>${escape(row.target)}</td><td><details><summary>Változás megtekintése</summary><pre>${escape(JSON.stringify(JSON.parse(row.details),null,2))}</pre></details></td></tr>`))+pager(data);
}
const views={overview,users,meals,jobs,settings,audit};
const titles={overview:'Áttekintés',users:'Felhasználók',meals:'Étkezések',jobs:'Feldolgozási feladatok',settings:'Beállítások és kapcsolatok',audit:'Változásnapló'};
async function load() {
  const {view,params}=route(),version=++loadVersion;
  $('#admin-view').setAttribute('aria-busy','true'); $('#admin-message').hidden=true;
  $('#admin-title').textContent=titles[view]||'Adminisztráció';
  document.querySelectorAll('.admin-sidebar a').forEach(a=>a.hash==='#'+view?a.setAttribute('aria-current','page'):a.removeAttribute('aria-current'));
  try { if(!views[view]) throw new Error('Ez az adminoldal nem található.'); const markup=await views[view](params); if(version===loadVersion) $('#admin-view').innerHTML=markup; }
  catch(error) { if(version===loadVersion) { $('#admin-view').textContent='A nézetet nem sikerült betölteni.'; message(error.message,true); } }
  finally { if(version===loadVersion) $('#admin-view').setAttribute('aria-busy','false'); }
}
$('#refresh').addEventListener('click',load); window.addEventListener('hashchange',load);
$('#close-detail').addEventListener('click',()=>$('#admin-detail').close());
document.addEventListener('submit',async event=>{
  if(!event.target.closest('#admin-view'))return; event.preventDefault();
  const form=event.target,values=new FormData(form),{view}=route();
  if(form.id!=='admin-settings') { navigate(view,new URLSearchParams([...values].filter(([,value])=>value))); return; }
  const button=event.submitter || form.querySelector('button[type="submit"]');button.disabled=true;
  try {
    const settings=Object.fromEntries(values);for(const key of ['analysesEnabled','registrationEnabled'])settings[key]=form.elements[key].checked;
    for(const key of ['hourlyLimit','dailyLimit','defaultCalorieGoal','maxOutputTokens','aiTimeoutSeconds'])settings[key]=Number(settings[key]);
    const result=await request('/settings',{method:'PATCH',body:JSON.stringify({settings,revision:Number(form.dataset.revision)})}); form.dataset.revision=result.revision; message('Elmentettük a beállításokat.');
  }catch(error){message(error.message,true);}finally{button.disabled=false;}
});
document.addEventListener('click',async event=>{
  const button=event.target.closest('button');if(!button)return;
  const {view,params}=route();
  if(button.dataset.page){params.set('page',button.dataset.page);navigate(view,params);return;}
  if(button.dataset.userMeals){navigate('meals',new URLSearchParams({userId:button.dataset.userMeals}));return;}
  if(!button.dataset.saveUser&&!button.dataset.revoke&&!button.dataset.meal)return;
  button.disabled=true;
  try{
    if(button.dataset.meal){
      const {meal}=await request('/meals/'+encodeURIComponent(button.dataset.meal));
      const photos=[meal.photo,meal.photo?.additional].filter(photo=>{try{const url=new URL(photo?.url);return url.protocol==='https:'&&url.hostname==='res.cloudinary.com';}catch{return false;}});
      $('#admin-meal-detail').innerHTML=`<h3>${escape(meal.analysis?.name||'Befejezetlen elemzés')}</h3><p>${escape(meal.email)} · ${escape(meal.day)} ${escape(meal.time)} · ${pill(meal.status)}</p><div class="admin-meal-photos">${photos.map((photo,i)=>`<img src="${escape(photo.url)}" alt="Az étkezés ${i+1}. fotója" referrerpolicy="no-referrer">`).join('')}</div>${meal.totals?`<p>${number(meal.totals.calories)} kcal · Fehérje: ${number(meal.totals.protein)} g · Szénhidrát: ${number(meal.totals.carbs)} g · Zsír: ${number(meal.totals.fat)} g</p>`:''}<p>${escape(meal.notes||'Nincs megjegyzés.')}</p>${['analysis','original_analysis','analysis_context','usage'].map(key=>`<details><summary>${escape({analysis:'Jelenlegi összetevők és tápértékek',original_analysis:'Eredeti AI-válasz',analysis_context:'Elemzési bemenetek',usage:'Modellhasználat'}[key])}</summary><pre>${escape(JSON.stringify(meal[key],null,2))}</pre></details>`).join('')}<details><summary>Technikai részletek</summary><pre>${escape(JSON.stringify(Object.fromEntries(Object.entries(meal).filter(([key])=>!['analysis','original_analysis','analysis_context','usage','photo'].includes(key))),null,2))}</pre></details>`;
      $('#admin-detail').showModal();return;
    }
    const id=button.dataset.saveUser||button.dataset.revoke;
    if(button.dataset.revoke){if(!confirm('Visszavonod a felhasználó összes jelenlegi belépését? Újra bejelentkezhet, ha nincs letiltva.'))return;await request('/users/'+encodeURIComponent(id)+'/revoke-sessions',{method:'POST'});}
    else{const row=button.closest('tr'),blocked=row.querySelector('[data-block]').checked,calorieGoal=Number(row.querySelector('[data-goal]').value);if(blocked&&!confirm('Letiltod a felhasználó belépését és visszavonod a munkameneteit? Az adatai megmaradnak.'))return;await request('/users/'+encodeURIComponent(id),{method:'PATCH',body:JSON.stringify({blocked,calorieGoal})});}
    await load();message('A módosítást elmentettük.');
  }catch(error){message(error.message,true);}finally{button.disabled=false;}
});
try { const response=await fetch('/api/status',{cache:'no-store'}),data=await response.json();if(!response.ok||!data.user?.admin)throw new Error('Ehhez a felülethez nincs hozzáférésed.');userEmail=data.user.email;$('#admin-identity').textContent=userEmail;await load(); }
catch(error){$('#admin-view').textContent='A felület nem elérhető.';$('#admin-view').setAttribute('aria-busy','false');message(error.message,true);}
