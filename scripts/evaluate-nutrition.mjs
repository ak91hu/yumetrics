import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync, renameSync } from 'node:fs';
import { resolve, dirname, relative, isAbsolute, extname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseEnv } from 'node:util';
import { createHash } from 'node:crypto';
import { check, analysisContext, analysisReport, validateImage, validateImages, text, PROMPT_VERSION } from '../lib/domain.mjs';
import { analyze, DEFAULT_MODEL } from '../lib/providers.mjs';
import { HUNGARIAN_DISHES } from '../lib/hungarian-food.mjs';
import { FOOD_REFERENCE } from '../lib/food-reference.mjs';
import { usageTotals } from '../lib/telemetry.mjs';

const metrics = ['calories','protein','carbs','fat','fiber','sugar','sodium','saturatedFat'];
export function loadCases(filename) {
  const manifest = JSON.parse(readFileSync(filename,'utf8')), directory = dirname(resolve(filename));
  check(Array.isArray(manifest.cases) && manifest.cases.length > 0 && manifest.cases.length <= 200, '1–200 valódi mérési eset szükséges.');
  const seen = new Set();
  return manifest.cases.map(item => {
    check(typeof item.id === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(item.id) && !seen.has(item.id), 'Az esetazonosító hiányzik vagy ismétlődik.'); seen.add(item.id);
    check(typeof item.group === 'string' && Object.hasOwn(HUNGARIAN_DISHES,item.group), 'Hiányzó magyar ételcsoport.');
    check(item.reference?.measured === true && ['weighed_recipe','weighed_components','laboratory'].includes(item.reference.method), 'A referencia lemért receptből, lemért összetevőkből vagy laborból származzon, ne AI-becslésből.');
    const provenance = text(item.reference.provenance,2000);
    const carbohydrateBasis = item.reference.carbohydrateBasis || 'available';
    check(['available','total_including_fiber'].includes(carbohydrateBasis), 'A szénhidrát vonatkoztatási alapja nem támogatott.');
    check(Number.isFinite(item.reference.edibleWeightG) && item.reference.edibleWeightG > 0 && item.reference.edibleWeightG <= 5000, 'Hiányzó ehető referenciatömeg.');
    for (const key of metrics) check(Number.isFinite(item.reference[key]) && item.reference[key] >= 0 || !['calories','protein','carbs','fat'].includes(key) && item.reference[key] == null, `Hibás referencia: ${key}.`);
    const paths = [item.image, ...(item.secondImage == null ? [] : [item.secondImage])].map(file => {
      check(typeof file === 'string', 'Hiányzó képfájl.'); const path = resolve(directory,file), inside = relative(directory,path);
      check(inside && !inside.startsWith('..') && !isAbsolute(inside) && ['.jpg','.jpeg','.png','.webp'].includes(extname(path).toLowerCase()), 'A kép a manifest könyvtárán belüli JPEG/PNG/WebP fájl legyen.');
      return path;
    });
    validateImages(imageData(paths[0]), paths[1] ? imageData(paths[1]) : undefined);
    return { id:item.id,group:item.group,paths,notes:text(item.notes || '',2000,true),context:analysisContext(item.context),reference:{...Object.fromEntries(metrics.map(key=>[key,item.reference[key]??null])),edibleWeightG:item.reference.edibleWeightG,method:item.reference.method,carbohydrateBasis,provenance} };
  });
}
function imageData(path) {
  const file = statSync(path);
  check(file.isFile() && file.size <= 4_100_000, 'A benchmark kép legfeljebb 4,1 MB lehet.');
  const mime = {'.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp'}[extname(path).toLowerCase()];
  const result = `data:${mime};base64,${readFileSync(path).toString('base64')}`;
  validateImage(result); return result;
}
export function evaluationSummary(rows) {
  const groups = new Set(rows.map(row=>`${row.mode}/${row.group}`));
  const summarise = selected => {
    const successful = selected.filter(row=>row.predicted);
    const errors = Object.fromEntries([...metrics,'edibleWeightG'].map(key=>{
      const pairs=successful.filter(row=>Number.isFinite(row.predicted[key])&&Number.isFinite(row.reference[key]));
      const absolute=pairs.map(row=>Math.abs(row.predicted[key]-row.reference[key]));
      return [key,{n:pairs.length,mae:pairs.length?absolute.reduce((a,b)=>a+b,0)/pairs.length:null,bias:pairs.length?pairs.reduce((s,row)=>s+row.predicted[key]-row.reference[key],0)/pairs.length:null,rmse:pairs.length?Math.sqrt(absolute.reduce((s,e)=>s+e*e,0)/pairs.length):null}];
    }));
    const usages=selected.map(row=>row.providerResponse?.usage),priced=usages.filter(usage=>Number.isFinite(usage?.cost)&&usage.cost>=0),tokens=usages.map(usageTotals).filter(Boolean);
    const knownCostUsd=priced.reduce((sum,usage)=>sum+usage.cost,0);
    return {attempted:selected.length,successful:successful.length,rejected:selected.length-successful.length,errors,
      billing:{pricedRequests:priced.length,knownCostUsd,totalCostUsd:priced.length===selected.length?knownCostUsd:null},
      tokens:{recordedRequests:tokens.length,...Object.fromEntries(['input','output','thoughts','cached'].map(key=>[key,tokens.length?tokens.reduce((sum,row)=>sum+row[key],0):null]))}};
  };
  return Object.fromEntries([...new Set(rows.map(row=>row.mode))].map(mode=>[mode,{...summarise(rows.filter(row=>row.mode===mode)),groups:Object.fromEntries([...groups].filter(key=>key.startsWith(mode+'/')).map(key=>[key.slice(mode.length+1),summarise(rows.filter(row=>`${row.mode}/${row.group}`===key))]))}]));
}
export function evaluationPrediction(analysis, reference) {
  const report = analysisReport(analysis), predicted = { ...report.total, edibleWeightG: report.weight };
  if (reference.carbohydrateBasis === 'total_including_fiber') predicted.carbs = report.total.carbs == null || report.total.fiber == null ? null : Math.round((report.total.carbs + report.total.fiber) * 10) / 10;
  return predicted;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const args=process.argv.slice(2), filename=args.find(arg=>!arg.startsWith('--'));
    check(filename && args.every(arg=>arg===filename||arg==='--run'||/^--limit=\d+$/.test(arg)), 'Használat: node scripts/evaluate-nutrition.mjs manifest.json [--run] [--limit=5]');
    const cases=loadCases(filename), limit=Number(args.find(arg=>arg.startsWith('--limit='))?.slice(8) || cases.length);
    check(Number.isInteger(limit)&&limit>0&&limit<=200,'Hibás esetszám.');
    if (!args.includes('--run')) console.log(`${cases.length} eset formátuma és képfájlja ellenőrizve. Nem történt AI-hívás; a referenciák fizikai mérését ez nem igazolja.`);
    else {
      const env={...(existsSync('.env')?parseEnv(readFileSync('.env','utf8')):{}),...process.env}; check(env.OPENCODE_API_KEY,'A futtatáshoz OPENCODE_API_KEY szükséges a .env fájlban.');
      mkdirSync('outputs',{recursive:true});const output=resolve('outputs',`nutrition-evaluation-${Date.now()}.json`),rows=[];
      const save=()=>{
        const temporary = `${output}.tmp`;
        check(dirname(temporary) === resolve('outputs') && dirname(output) === resolve('outputs'), 'Hibás eredményútvonal.');
        writeFileSync(temporary,JSON.stringify({complete:rows.length===Math.min(limit,cases.length)*2,planned:Math.min(limit,cases.length)*2,promptVersion:PROMPT_VERSION,model:env.OPENCODE_MODEL||DEFAULT_MODEL,referenceCount:Object.keys(FOOD_REFERENCE).length,referenceCatalogSha256:createHash('sha256').update(JSON.stringify(FOOD_REFERENCE)).digest('hex'),note:'Mért referencia elleni összehasonlítás; a referencia eredetét a megadó állítja. Az ételazonosítást szakértőnek is ellenőriznie kell.',summary:evaluationSummary(rows),rows},null,2),{flush:true});
        renameSync(temporary,output);
      };
      for(const item of cases.slice(0,limit))for(const mode of ['photo_only','with_context']){
        const row={id:item.id,group:item.group,mode,reference:item.reference};
        try{const result=await analyze(imageData(item.paths[0]),mode==='with_context'?item.notes:'',env,fetch,{context:mode==='with_context'?item.context:{},secondImage:item.paths[1]?imageData(item.paths[1]):undefined,onResponse:data=>{row.providerResponse=data;}});Object.assign(row,{predicted:evaluationPrediction(result.analysis,item.reference),analysis:result.analysis,usage:result.usage,latencyMs:result.latencyMs});}
        catch(error){row.error=error.status?error.message:'A szolgáltatói hívás nem sikerült.';}
        rows.push(row);save();console.log(`${item.id} / ${mode}: ${row.predicted?'eredmény rögzítve':'elutasítás rögzítve'}`);
      }
      console.log(`Értékelés: ${output}`);
    }
  } catch(error) { console.error(error.status?error.message:'Az értékelő bemenete vagy futtatása hibás.');process.exitCode=1; }
}
