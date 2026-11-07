export function visualInventory(analysis) {
  return { isFood: true, dishProfile: analysis.dishProfile || 'generic', name: analysis.name, confidence: analysis.confidence, summary: 'A képen külön kezelt összetevőkből álló étel látható. Az adag pontosítása javítja az eredményt.', assumptions: analysis.assumptions,
    imageQuality: { level: 'limited', issues: ['A fényképből a pontos tömeg nem mérhető.'] }, observations: ['A köret és a fő összetevő külön becsülhető.'], questions: ['Mennyi olaj került az ételbe?'],
    ingredients: analysis.ingredients.map(item => ({ name: item.name, grams: item.grams, gramsMin: item.grams * .8, gramsMax: item.grams * 1.2, foodState: item.foodState || 'prepared', preparation: 'Elkészítve', visibility: 'visible', portionNote: 'Tesztadat: vizuális adagbecslés.', alternatives: [], referenceKey: null })),
  };
}
export function aiPayloadFor(analysis, request, inventory = visualInventory(analysis)) {
  const schema = JSON.parse(request.body).generationConfig.responseJsonSchema;
  const parsed = schema.properties.ingredients.items.properties.index
    ? { ingredients: analysis.ingredients.map((item, index) => ({ ...item, index, saturatedFat: item.saturatedFat ?? null })).filter(item => JSON.parse(JSON.parse(request.body).contents[0].parts[0].text).ingredients.some(requested => requested.index === item.index)) }
    : inventory;
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
