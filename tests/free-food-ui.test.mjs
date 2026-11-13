import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FOOD_REFERENCE } from '../lib/food-reference.mjs';
import { multiFoodAnalysis } from './fixtures.mjs';

// Execute the real rendering module with only browser localization/help imports
// replaced; no DOM is needed for ingredientMarkup.
async function rendering() {
  let source = readFileSync(new URL('../public/analysis-ui.mjs', import.meta.url), 'utf8');
  source = source.replace("import { t, html, locale } from '/localization.mjs';", "const t=(value,...args)=>Array.isArray(value)?value.reduce((s,p,i)=>s+p+(args[i]??''),''):value;const html=t;const locale=()=> 'hu-HU';");
  source = source.replace("import { helpMarkup } from '/context-help.mjs';", "const helpMarkup=()=>'';");
  for (const name of ['domain', 'food-reference', 'hungarian-food']) source = source.replace(`from '/${name}.mjs'`, `from '${new URL('../lib/' + name + '.mjs', import.meta.url).href}'`);
  return import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
}
test('source rendering shows actual provider, attribution and licence for g/ml without an undefined FDC identifier', async t => {
  const { ingredientMarkup } = await rendering();
  const key='ext-off-4006381333931-aaaaaaaaaaaaaaaa';
  FOOD_REFERENCE[key]={label:'Product <script>bad</script>',description:'Known product',source:'off',sourceId:'4006381333931',quantityUnit:'ml',foodState:'as_sold',attribution:'Open Food Facts',license:'ODbL-1.0',url:'https://world.openfoodfacts.org/product/4006381333931',retrievedAt:'2026-11-13',nutrients:{calories:42}};
  t.after(()=>delete FOOD_REFERENCE[key]);
  const entry={name:'Drink',grams:100,gramsMin:80,gramsMax:120,quantityUnit:'ml',sourceType:'reference',referenceKey:key,referenceRecord:FOOD_REFERENCE[key],sourceConfirmed:false,calories:42,alternatives:[],visibility:'visible'};
  const markup=ingredientMarkup(entry,0);
  assert.ok(markup.includes('Open Food Facts'));assert.ok(markup.includes('ODbL-1.0'));assert.ok(markup.includes('4006381333931'));
  assert.ok(!markup.includes('undefined'));assert.ok(!markup.includes('<script>bad</script>'));assert.ok(markup.includes('&lt;script&gt;'));
  assert.ok(markup.includes('data-confirm-source="0"'));
  const grams=ingredientMarkup({...entry,quantityUnit:'g',referenceKey:'fdc-173904',referenceRecord:FOOD_REFERENCE['fdc-173904']},1);
  assert.ok(!grams.includes(`value="${key}"`),'Do not offer a per-ml record for a per-g ingredient');
});
test('the final report renders assembled nutrition without presenting an identity-question workflow',async()=>{
  const {reportMarkup}=await rendering();
  const analysis=multiFoodAnalysis();analysis.questions=['INTERNAL_SELECTION_STEP'];analysis.observations=[];
  const markup=reportMarkup({analysis});
  assert.ok(markup.includes('food-breakdown'));assert.ok(markup.includes('kcal'));assert.ok(markup.includes(analysis.ingredients[0].name));
  assert.ok(!markup.includes('INTERNAL_SELECTION_STEP'));assert.ok(!markup.includes('Mit érdemes még pontosítani?'));
  assert.ok(!markup.includes('összetevőnél ellenőrizted'));assert.ok(markup.includes('<summary>Adatforrások</summary>'));
});
