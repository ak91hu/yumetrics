import { check } from './domain.mjs';
import { DEFAULT_MODEL, DEFAULT_MAX_OUTPUT_TOKENS } from './providers.mjs';

export const ADMIN_EMAIL = 'thisisnotka@gmail.com';
export const isAdmin = user => user?.email?.toLowerCase() === ADMIN_EMAIL;
export async function appSettings(db, env) {
  const row = await db.prepare('SELECT value,revision FROM app_settings WHERE id=1').bind().first();
  return { revision: row.revision, settings: { analysesEnabled: true, registrationEnabled: true, visitorStatsEnabled: true, hourlyLimit: 20, dailyLimit: 50, defaultCalorieGoal: 2000, model: env.OPENCODE_MODEL || DEFAULT_MODEL, maxOutputTokens: DEFAULT_MAX_OUTPUT_TOKENS, aiTimeoutSeconds: 75, ...JSON.parse(row.value) } };
}
export function validateSettings(value) {
  check(value && typeof value === 'object' && !Array.isArray(value), 'Hibás beállítások.');
  const fields = ['analysesEnabled', 'registrationEnabled', 'visitorStatsEnabled', 'hourlyLimit', 'dailyLimit', 'defaultCalorieGoal', 'model', 'maxOutputTokens', 'aiTimeoutSeconds'];
  check(Object.keys(value).length === fields.length && fields.every(key => Object.hasOwn(value, key)), 'Ismeretlen vagy hiányzó beállítás.');
  for (const key of ['analysesEnabled', 'registrationEnabled', 'visitorStatsEnabled']) check(typeof value[key] === 'boolean', 'A beállítás csak be- vagy kikapcsolható.');
  for (const [key, min, max, label] of [['hourlyLimit',1,1000,'Az óránkénti elemzési korlát'], ['dailyLimit',1,10000,'A napi elemzési korlát'], ['defaultCalorieGoal',500,10000,'Az új fiókok napi energiakerete'], ['maxOutputTokens',1000,DEFAULT_MAX_OUTPUT_TOKENS,'A válasz hosszának felső határa'], ['aiTimeoutSeconds',10,75,'A várakozási idő másodpercben']]) check(Number.isInteger(value[key]) && value[key] >= min && value[key] <= max, `${label} ${min} és ${max} közötti egész szám legyen.`);
  check(value.dailyLimit >= value.hourlyLimit, 'A napi korlát nem lehet kisebb az óránkénti korlátnál.');
  check(typeof value.model === 'string' && /^[a-z0-9][a-z0-9.-]{0,99}$/.test(value.model), 'Hibás modellazonosító.');
  return value;
}
export async function runtimeSettings(db, env) {
  const { settings } = await appSettings(db, env);
  return { ...env, OPENCODE_MODEL: settings.model, AI_MAX_OUTPUT_TOKENS: settings.maxOutputTokens, AI_TIMEOUT_SECONDS: settings.aiTimeoutSeconds, ...settings };
}
