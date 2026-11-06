export function visualInventory(analysis) {
  return { isFood: true, name: analysis.name, confidence: analysis.confidence, summary: 'A képen külön kezelt összetevőkből álló étel látható. Az adag pontosítása javítja az eredményt.', assumptions: analysis.assumptions,
    imageQuality: { level: 'limited', issues: ['A fényképből a pontos tömeg nem mérhető.'] }, observations: ['A köret és a fő összetevő külön becsülhető.'], questions: ['Mennyi olaj került az ételbe?'],
    ingredients: analysis.ingredients.map(item => ({ name: item.name, grams: item.grams, gramsMin: item.grams * .8, gramsMax: item.grams * 1.2, preparation: 'Elkészítve', visibility: 'visible', portionNote: 'Tesztadat: vizuális adagbecslés.', alternatives: [], referenceKey: null })),
  };
}
export function aiPayloadFor(analysis, request, inventory = visualInventory(analysis)) {
  const schema = JSON.parse(request.body).generationConfig.responseJsonSchema;
  const parsed = schema.properties.ingredients.items.properties.index
    ? { ingredients: analysis.ingredients.map((item, index) => ({ ...item, index, saturatedFat: item.saturatedFat ?? null })).filter(item => inventory.ingredients[item.index]?.referenceKey === null) }
    : inventory;
  return { candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(parsed) }] } }], usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 50 } };
}
