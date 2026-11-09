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
  const parsed = { ...inventory, ingredients: inventory.ingredients.map((item, index) => ({ ...item, ...Object.fromEntries(['calories', 'protein', 'carbs', 'fat', 'fiber', 'sugar', 'sodium', 'saturatedFat'].map(key => [key, analysis.ingredients[index]?.[key] ?? null])) })) };
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
