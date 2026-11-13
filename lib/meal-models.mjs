// Use each provider's native multimodal/structured-output format.
export const HAIKU_MODEL = 'claude-haiku-5-5';
export const modelOutputLimit = model => model === HAIKU_MODEL ? 4096 : 1600;

const labelTextKeys = ['productName', 'brand', 'barcode', 'netUnit', 'basisUnit', 'ingredientsText', 'allergensText'];
const labelNumberKeys = ['netAmount', 'packageCount', 'basisAmount', 'calories', 'energyKj', 'protein', 'carbs', 'fat', 'fiber', 'sugar', 'sodium', 'saturatedFat', 'saltG'];
const labelBooleanKeys = ['prepared', 'carbsIncludeFiber'];
const labelEntries = (keys, type) => ({ type: 'array', items: { type: 'object', required: ['key', 'value'], properties: { key: { type: 'string', enum: keys }, value: { type } } } });
const sparseLabelSchema = { type: ['object', 'null'], required: ['textFields', 'numberFields', 'booleanFields', 'issues'], properties: {
  textFields: labelEntries(labelTextKeys, 'string'), numberFields: labelEntries(labelNumberKeys, 'number'), booleanFields: labelEntries(labelBooleanKeys, 'boolean'), issues: { type: 'array', items: { type: 'string' } },
} };
const labelWireInstruction = '\nWIRE LABEL FORMAT (overrides productLabel field layout only): productLabel=null when no package. Otherwise return {textFields:[{key,value}],numberFields:[{key,value}],booleanFields:[{key,value}],issues:[]}. Include ONLY actually readable/known fields; unknown fields have NO entry, never guessed values or zero. Use keys from the schema; nutrition keys in numberFields are the ORIGINAL label values, with the same units and basis rules above. Empty arrays preserve unknowns. The server reconstructs the normal nullable label object; do not emit the normal object layout.';

export function normalizeModelAnalysis(model, parsed) {
  if (model !== HAIKU_MODEL || !Array.isArray(parsed?.ingredients)) return parsed;
  for (const item of parsed.ingredients) {
    const label = item.productLabel;
    if (!label || !Object.hasOwn(label, 'textFields')) continue;
    const result = { nutrients: {}, issues: label.issues }, seen = new Set();
    for (const [field, keys, type] of [['textFields', labelTextKeys, 'string'], ['numberFields', labelNumberKeys, 'number'], ['booleanFields', labelBooleanKeys, 'boolean']]) {
      if (!Array.isArray(label[field])) throw Error('Incomplete label field list');
      for (const entry of label[field]) {
        if (!entry || !keys.includes(entry.key) || seen.has(entry.key) || typeof entry.value !== type || type === 'number' && !Number.isFinite(entry.value)) throw Error('Invalid or duplicate label field');
        seen.add(entry.key);
        const target = field === 'numberFields' && !['netAmount', 'packageCount', 'basisAmount'].includes(entry.key) ? result.nutrients : result;
        target[entry.key] = entry.value;
      }
    }
    item.productLabel = result;
  }
  return parsed;
}

function strictSchema(value) {
  if (Array.isArray(value)) return value.map(strictSchema);
  if (!value || typeof value !== 'object') return value;
  const result = Object.fromEntries(Object.entries(value).map(([key, item]) => [key, strictSchema(item)]));
  if (result.properties) {
    result.additionalProperties = false;
    result.required = Object.keys(result.properties);
  }
  // The live gateway rejected enum + type arrays. Preserve the same allowed
  // values using typed anyOf branches, including an explicit null branch.
  if (Array.isArray(result.type)) {
    const { type: types, enum: values, ...rest } = result;
    return { anyOf: types.map(type => {
      const branch = type === 'null' ? { type } : { ...rest, type };
      if (values) branch.enum = values.filter(value => type === 'null' ? value === null : type === 'integer' ? Number.isInteger(value) : typeof value === type);
      return branch;
    }) };
  }
  return result;
}

export function mealModelRequest(model, prompt, schema, parts, maxOutputTokens) {
  if (model === HAIKU_MODEL) {
    const wireSchema = structuredClone(schema);
    const ingredient = wireSchema.properties?.ingredients?.items;
    if (ingredient?.properties?.productLabel) ingredient.properties.productLabel = sparseLabelSchema;
    const content = parts.slice(1).map(part => part.inlineData
      ? { type: 'image', source: { type: 'base64', media_type: part.inlineData.mimeType, data: part.inlineData.data } }
      : { type: 'text', text: part.text });
    // Images first, then the task and fallible helper data; no extra tool/repair calls.
    content.push({ type: 'text', text: parts[0].text });
    return {
      url: 'https://opencode.ai/inference/anthropic/v1/messages',
      headers: { 'anthropic-version': '2023-06-01' },
      body: { model, max_tokens: maxOutputTokens, thinking: { type: 'adaptive' },
        output_config: { effort: 'high', format: { type: 'json_schema', schema: strictSchema(wireSchema) } },
        system: prompt + labelWireInstruction, messages: [{ role: 'user', content }] },
      thinkingConfig: { type: 'adaptive', effort: 'high' },
    };
  }
  const thinkingConfig = model === 'gemini-3.5-flash-lite' ? { thinkingLevel: 'MINIMAL' } : undefined;
  return {
    url: `https://opencode.ai/inference/google/v1beta/models/${model}:generateContent`, headers: {},
    body: { systemInstruction: { parts: [{ text: prompt }] }, contents: [{ role: 'user', parts }],
      generationConfig: { maxOutputTokens, responseMimeType: 'application/json', responseJsonSchema: schema,
        ...(thinkingConfig ? { thinkingConfig } : {}) } }, thinkingConfig: thinkingConfig ?? null,
  };
}

export function mealModelResponse(model, payload) {
  if (model !== HAIKU_MODEL) return {
    complete: payload?.candidates?.[0]?.finishReason === 'STOP',
    text: payload?.candidates?.[0]?.content?.parts?.filter(part => part.text && !part.thought).map(part => part.text).join(''),
    usage: payload?.usageMetadata ?? null,
  };
  const usage = payload?.usage;
  const valid = usage && ['input_tokens', 'output_tokens'].every(key => Number.isSafeInteger(usage[key]) && usage[key] >= 0)
    && ['cache_read_input_tokens', 'cache_creation_input_tokens'].every(key => usage[key] == null || Number.isSafeInteger(usage[key]) && usage[key] >= 0);
  return {
    complete: payload?.stop_reason === 'end_turn',
    text: payload?.content?.filter(part => part.type === 'text').map(part => part.text).join(''),
    // Anthropic excludes cache tokens from input_tokens; output_tokens already includes thinking.
    usage: valid ? { promptTokenCount: usage.input_tokens + (usage.cache_read_input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0),
      candidatesTokenCount: usage.output_tokens, cachedContentTokenCount: usage.cache_read_input_tokens ?? 0,
      cacheCreationTokenCount: usage.cache_creation_input_tokens ?? 0,
      ...(Number.isFinite(usage.cost) && usage.cost >= 0 ? { cost: usage.cost, costIsEstimate: usage.opencode?.estimated === true } : {}) } : null,
  };
}
