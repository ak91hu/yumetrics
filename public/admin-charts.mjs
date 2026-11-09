const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const number = value => new Intl.NumberFormat('hu-HU',{maximumFractionDigits:6}).format(value);
export function dailySeries(rows, key, days, end = new Date().toISOString().slice(0,10)) {
  const byDay = new Map(rows.map(row => [row.day,row]));
  const last = Date.parse(end+'T00:00:00Z');
  return Array.from({length:days},(_,i)=>{
    const day = new Date(last-(days-1-i)*86400000).toISOString().slice(0,10), row=byDay.get(day);
    return {day,value:row ? row[key] == null ? null : Number(row[key]) : 0};
  });
}
export function lineChart(id,title,series,unit='db') {
  const max = Math.max(unit==='USD'?1e-6:1,...series.filter(p=>p.value!=null).map(p=>p.value)), top=unit==='USD'?max*1.15:Math.ceil(max/3)*3;
  const x=i=>48+i*524/Math.max(1,series.length-1), y=value=>184-value/top*150;
  const segments=[];let segment=[];
  series.forEach((point,i)=>{if(point.value==null){if(segment.length)segments.push(segment);segment=[];}else segment.push({x:x(i),y:y(point.value)});});if(segment.length)segments.push(segment);
  const format=value=>escape(number(value)), label=day=>escape(day.slice(5).replace('-','.'));
  return `<figure class="admin-chart" aria-labelledby="${id}-title"><figcaption id="${id}-title">${escape(title)}</figcaption><svg viewBox="0 0 600 230" role="img" aria-labelledby="${id}-title ${id}-description"><desc id="${id}-description">Napi értékek. Ahol nincs adat, ott megszakad a vonal. A pontos értékek a grafikon alatti táblázatban is elérhetők.</desc>${[0,1,2,3].map(i=>{const value=top*i/3,cy=y(value);return `<line x1="48" y1="${cy}" x2="572" y2="${cy}" class="chart-grid"/><text x="40" y="${cy+4}" text-anchor="end">${format(value)}</text>`;}).join('')}${segments.map(points=>`<polygon points="${points[0].x},184 ${points.map(p=>`${p.x},${p.y}`).join(' ')} ${points.at(-1).x},184" class="chart-area"/><polyline points="${points.map(p=>`${p.x},${p.y}`).join(' ')}" class="chart-line"/>`).join('')}${series.filter(p=>p.value!=null).map(point=>{const i=series.indexOf(point);return `<circle cx="${x(i)}" cy="${y(point.value)}" r="3" class="chart-point"><title>${escape(point.day)}: ${format(point.value)} ${escape(unit)}</title></circle>`;}).join('')}${[0,Math.floor((series.length-1)/2),series.length-1].filter((v,i,a)=>a.indexOf(v)===i).map(i=>`<text x="${x(i)}" y="211" text-anchor="middle">${label(series[i].day)}</text>`).join('')}</svg><p class="admin-note">${escape(unit)} · A napi értékeket a pontokra mutatva olvashatod le.</p><details class="chart-data"><summary>Adatok táblázatban</summary><div class="admin-table-wrap"><table class="admin-table"><thead><tr><th scope="col">Nap</th><th scope="col">${escape(title)} (${escape(unit)})</th></tr></thead><tbody>${series.map(p=>`<tr><th scope="row">${escape(p.day)}</th><td>${p.value==null?'Nincs költségadat':format(p.value)}</td></tr>`).join('')}</tbody></table></div></details></figure>`;
}
export function distributionChart(id,title,rows) {
  const max=Math.max(1,...rows.map(row=>Number(row.value)));
  return `<figure class="admin-chart" aria-labelledby="${id}-title"><figcaption id="${id}-title">${escape(title)}</figcaption>${rows.length ? `<svg viewBox="0 0 600 ${Math.max(90,rows.length*42+15)}" role="img" aria-labelledby="${id}-title">${rows.map((row,i)=>`<text x="0" y="${i*42+23}">${escape(row.label)}</text><rect x="180" y="${i*42+8}" width="${Number(row.value)/max*350}" height="23" rx="5" class="chart-bar"/><text x="550" y="${i*42+24}">${number(row.value)}</text>`).join('')}</svg>` : '<p class="admin-note">Ebben az időszakban még nincs adat.</p>'}</figure>`;
}
