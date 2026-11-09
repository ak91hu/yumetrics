import { check } from './domain.mjs';
import { DEFAULT_MODEL } from './providers.mjs';

export const ADMIN_EMAIL = 'thisisnotka@gmail.com';
export const isAdmin = user => user?.email?.toLowerCase() === ADMIN_EMAIL;
export async function appSettings(db, env) {
  const row = await db.prepare('SELECT value,revision FROM app_settings WHERE id=1').bind().first();
  return { revision: row.revision, settings: { analysesEnabled: true, registrationEnabled: true, hourlyLimit: 20, dailyLimit: 50, defaultCalorieGoal: 2000, model: env.OPENCODE_MODEL || DEFAULT_MODEL, maxOutputTokens: 10000, aiTimeoutSeconds: 75, ...JSON.parse(row.value) } };
}
export function validateSettings(value) {
  check(value && typeof value === 'object' && !Array.isArray(value), 'Hibás beállítások.');
  const fields = ['analysesEnabled', 'registrationEnabled', 'hourlyLimit', 'dailyLimit', 'defaultCalorieGoal', 'model', 'maxOutputTokens', 'aiTimeoutSeconds'];
  check(Object.keys(value).length === fields.length && fields.every(key => Object.hasOwn(value, key)), 'Ismeretlen vagy hiányzó beállítás.');
  for (const key of ['analysesEnabled', 'registrationEnabled']) check(typeof value[key] === 'boolean', 'Hibás kapcsolóérték.');
  for (const [key, min, max] of [['hourlyLimit',1,1000], ['dailyLimit',1,10000], ['defaultCalorieGoal',500,10000], ['maxOutputTokens',1000,30000], ['aiTimeoutSeconds',10,75]]) check(Number.isInteger(value[key]) && value[key] >= min && value[key] <= max, `Hibás beállítás: ${key}.`);
  check(value.dailyLimit >= value.hourlyLimit, 'A napi korlát nem lehet kisebb az óránkénti korlátnál.');
  check(typeof value.model === 'string' && /^[a-z0-9][a-z0-9.-]{0,99}$/.test(value.model), 'Hibás modellazonosító.');
  return value;
}
export async function runtimeSettings(db, env) {
  const { settings } = await appSettings(db, env);
  return { ...env, OPENCODE_MODEL: settings.model, AI_MAX_OUTPUT_TOKENS: settings.maxOutputTokens, AI_TIMEOUT_SECONDS: settings.aiTimeoutSeconds, ...settings };
}
