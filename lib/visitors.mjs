const PAGES = new Set(['login', 'diary', 'guide_hu', 'guide_en']);
const SOURCES = [
  ['google', /(^|\.)google\.(com|[a-z]{2}|co\.[a-z]{2}|com\.[a-z]{2})$/], ['bing', /(^|\.)bing\.com$/],
  ['duckduckgo', /(^|\.)duckduckgo\.com$/], ['facebook', /(^|\.)(facebook\.com|fb\.com|fb\.me)$/],
  ['instagram', /(^|\.)instagram\.com$/], ['tiktok', /(^|\.)tiktok\.com$/],
  ['youtube', /(^|\.)(youtube\.com|youtu\.be)$/], ['linkedin', /(^|\.)linkedin\.com$/],
  ['reddit', /(^|\.)reddit\.com$/], ['x', /(^|\.)(x\.com|twitter\.com|t\.co)$/],
];
export function visitDimensions(request, { page, country, language }) {
  const headers = request.headers, ua = headers.get('user-agent') || '';
  if (request.method !== 'GET' || !PAGES.has(page) || headers.get('sec-fetch-dest') !== 'document' || headers.get('dnt') === '1' || headers.get('sec-gpc') === '1' || /bot|crawler|spider|headless|lighthouse|preview|slurp/i.test(ua) || /prefetch/i.test((headers.get('sec-purpose') || '') + (headers.get('purpose') || ''))) return null;
  const browser = /Edg(A|iOS)?\//.test(ua) ? 'edge' : /OPR\/|OPiOS\//.test(ua) ? 'opera' : /SamsungBrowser\//.test(ua) ? 'samsung' : /Firefox\/|FxiOS\//.test(ua) ? 'firefox' : /Chrome\/|CriOS\//.test(ua) ? 'chrome' : /Safari\//.test(ua) ? 'safari' : 'other';
  const os = /Android/.test(ua) ? 'android' : /iPhone|iPad|iPod/.test(ua) ? 'ios' : /Windows/.test(ua) ? 'windows' : /CrOS/.test(ua) ? 'chromeos' : /Macintosh|Mac OS/.test(ua) ? 'macos' : /Linux/.test(ua) ? 'linux' : 'other';
  const device = /iPad|Tablet|Android(?!.*Mobile)/i.test(ua) ? 'tablet' : /Mobile|iPhone|iPod/i.test(ua) || headers.get('sec-ch-ua-mobile') === '?1' ? 'phone' : ua ? 'desktop' : 'other';
  let source = 'direct';
  try {
    const referrer = new URL(headers.get('referer'));
    if (['http:', 'https:'].includes(referrer.protocol)) source = referrer.origin === new URL(request.url).origin ? 'internal' : SOURCES.find(([, match]) => match.test(referrer.hostname))?.[0] || 'other';
  } catch {}
  return { total:'all', page, country:/^[A-Z]{2}$/.test(country || '') ? country : 'unknown', browser, os, device, source, language:language === 'hu' ? 'hu' : 'en' };
}

export async function recordPageView(db, request, context, time = Date.now()) {
  const dimensions = visitDimensions(request, context);
  if (!dimensions) return false;
  const now = new Date(time), day = now.toISOString().slice(0, 10);
  const entries = Object.entries({ ...dimensions, hour:String(now.getUTCHours()).padStart(2,'0') });
  const oldest = new Date(Date.parse(day+'T00:00:00Z') - 399*86400000).toISOString().slice(0,10);
  await db.prepare('DELETE FROM visitor_stats WHERE day<?').bind(oldest).run();
  await db.prepare(`INSERT INTO visitor_stats(day,dimension,value,views) VALUES ${entries.map(() => '(?,?,?,1)').join(',')} ON CONFLICT(day,dimension,value) DO UPDATE SET views=visitor_stats.views+1`).bind(...entries.flatMap(([dimension,value]) => [day,dimension,value])).run();
  return true;
}

export async function visitorReport(db, days, time = Date.now()) {
  const today = new Date(time).toISOString().slice(0,10), start = new Date(Date.parse(today+'T00:00:00Z')-(days-1)*86400000).toISOString().slice(0,10);
  await db.prepare('DELETE FROM visitor_stats WHERE day<?').bind(new Date(Date.parse(today+'T00:00:00Z')-399*86400000).toISOString().slice(0,10)).run();
  // One statement keeps totals and breakdowns in the same snapshot during incoming page views.
  const {results} = await db.prepare("SELECT day,dimension,value,views FROM visitor_stats WHERE day>=? AND day<=? AND dimension='total' UNION ALL SELECT '',dimension,value,SUM(views) AS views FROM visitor_stats WHERE day>=? AND day<=? AND dimension<>'total' GROUP BY dimension,value UNION ALL SELECT MIN(day),'coverage',MAX(day),0 FROM visitor_stats WHERE dimension='total' ORDER BY dimension,views DESC,value").bind(start,today,start,today).all();
  const daily=results.filter(row=>row.dimension==='total').sort((a,b)=>a.day.localeCompare(b.day)), groups=results.filter(row=>row.dimension!=='total'&&row.dimension!=='coverage'), metadata=results.find(row=>row.dimension==='coverage');
  const coverage={first_day:metadata.day,latest_day:metadata.value};
  return { days,start,today,coverage,total:daily.reduce((sum,row)=>sum+Number(row.views),0),todayViews:Number(daily.find(row=>row.day===today)?.views||0),daily,breakdowns:Object.fromEntries(['page','country','browser','os','device','source','language','hour'].map(key=>[key,groups.filter(row=>row.dimension===key).map(({value,views})=>({value,views:Number(views)}))])) };
}
