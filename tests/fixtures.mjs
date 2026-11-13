export const secondImage = 'data:image/jpeg;base64,' + Buffer.concat([Buffer.from([255, 216, 255, 224]), Buffer.alloc(200, 1)]).toString('base64');
export function productLabelFixture(overrides = {}) {
  return { productName: 'Test drink', brand: 'Test brand', barcode: '4006381333931', netAmount: 330, netUnit: 'ml', packageCount: 1,
    basisAmount: 100, basisUnit: 'ml', prepared: false, carbsIncludeFiber: false,
    nutrients: { calories: 42, energyKj: null, protein: 0, carbs: 10.6, fat: 0, fiber: null, sugar: 10.6, sodium: null, saturatedFat: 0, saltG: .0125 },
    ingredientsText: 'Water, sugar, fruit juice.', allergensText: null, issues: [], ...overrides };
}
export function visualInventory(analysis) {
  return { isFood: true, viewCheck: { sameMeal: true, differentAngles: true, bothUsable: true, issues: [] }, dishProfile: analysis.dishProfile || 'generic', name: analysis.name, confidence: analysis.confidence, summary: 'A képen külön kezelt összetevőkből álló étel látható. Az adag pontosítása javítja az eredményt.', assumptions: analysis.assumptions,
    imageQuality: { level: 'limited', issues: ['A fényképből a pontos tömeg nem mérhető.'] }, observations: ['A köret és a fő összetevő külön becsülhető.'], questions: ['Mennyi olaj került az ételbe?'],
    ingredients: analysis.ingredients.map(item => ({ name: item.name, grams: item.grams, gramsMin: item.grams * .8, gramsMax: item.grams * 1.2, quantityUnit: item.quantityUnit || 'g', productLabel: item.productLabel || null, foodState: item.foodState || 'prepared', preparation: 'Elkészítve', visibility: 'visible', portionNote: 'Tesztadat: vizuális adagbecslés.', alternatives: [], referenceKey: null })),
  };
}
export function aiPayloadFor(analysis, request, inventory = visualInventory(analysis)) {
  const parsed = { ...inventory, ingredients: inventory.ingredients.map((item, index) => ({ ...item, nutrients: Object.fromEntries(['calories', 'protein', 'carbs', 'fat', 'fiber', 'sugar', 'sodium', 'saturatedFat'].map(key => [key, analysis.ingredients[index]?.[key] ?? null])) })) };
  const input = request?.contents?.[0]?.parts?.[0]?.text ?? request?.messages?.[0]?.content?.at(-1)?.text;
  const candidates = input ? JSON.parse(input).untrustedRecognitionCandidates : [];
  if (candidates?.length) parsed.recognitionReview = candidates.map((_, candidateIndex) => ({ candidateIndex, verdict: 'supported', ingredientIndex: candidateIndex % parsed.ingredients.length }));
  return { candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(parsed) }] } }], usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 50 } };
}
export function testGoogleClient(overrides = {}) {
  let nonce;
  return {
    callbackOrigin: null,
    generateAuthUrl(options) { nonce = options.nonce; return `${this.callbackOrigin || 'https://accounts.google.com'}/auth/google/callback?state=${options.state}&code=test-code`; },
    async getToken(options) { if (!options.codeVerifier || options.code !== 'test-code') throw new Error('Invalid test exchange'); return { tokens: { id_token: 'test-id-token' } }; },
    async verifyIdToken(options) { if (options.idToken !== 'test-id-token') throw new Error('Invalid test token'); return { getPayload: () => ({ iss: 'https://accounts.google.com', aud: 'test-client', email_verified: true, sub: 'google-user-1', email: 'teszt@example.test', name: 'Teszt Elek', nonce, ...overrides }) }; },
  };
}
export function multiFoodAnalysis(language='hu') {
  const analysis = {name:'Csirkemell rizzsel, salátával és narancslével',confidence:'medium',assumptions:'Tesztadat, nem valódi fotós becslés.',ingredients:[
    {name:'Sült csirkemell',grams:150,quantityUnit:'g',calories:165,protein:31,carbs:0,fat:3.6,fiber:0,sugar:0,sodium:70,saturatedFat:1},
    {name:'Főtt rizs',grams:200,quantityUnit:'g',calories:130,protein:2.7,carbs:28,fat:.3,fiber:.4,sugar:.1,sodium:1,saturatedFat:.1},
    {name:'Paradicsomsaláta',grams:100,quantityUnit:'g',calories:30,protein:1,carbs:4,fat:1,fiber:1.5,sugar:3,sodium:null,saturatedFat:.2},
    {name:'Narancslé',grams:250,quantityUnit:'ml',calories:42,protein:.7,carbs:9,fat:.2,fiber:.2,sugar:8.4,sodium:2,saturatedFat:0},
  ]};
  if(language==='en'){
    analysis.name='Chicken with rice, salad and orange juice';analysis.assumptions='Test data, not a real photo estimate.';
    analysis.ingredients.forEach((item,index)=>item.name=['Roast chicken breast','Cooked rice','Tomato salad','Orange juice'][index]);
  }
  return analysis;
}
