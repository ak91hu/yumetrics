import { check, TYPES } from './domain.mjs';

const DAY = 86400_000;
const dateKey = time => new Date(time).toISOString().slice(0, 10);
const dayTime = value => Date.parse(value + 'T00:00:00Z');
const round = value => Math.round(value * 10) / 10;
export function profileToday(timeZone, now = new Date()) {
  check(typeof timeZone === 'string' && timeZone.length <= 100, 'Ismeretlen időzóna.');
  let parts;
  try { parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now); }
  catch { check(false, 'Ismeretlen időzóna.'); }
  const value = name => parts.find(part => part.type === name).value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}
export function profileStatistics(loggedDays, meals, today) {
  const end = dayTime(today), start = end - 364 * DAY, startDay = dateKey(start);
  const days = new Map(loggedDays.filter(row => row.day <= today).map(row => [row.day, Number(row.meal_count)]));
  let longestStreak = 0, streak = 0, previous = -Infinity;
  for (const key of [...days.keys()].sort()) {
    const time = dayTime(key); streak = time - previous === DAY ? streak + 1 : 1;
    longestStreak = Math.max(longestStreak, streak); previous = time;
  }
  let cursor = days.has(today) ? end : end - DAY, currentStreak = 0;
  while (days.has(dateKey(cursor))) { currentStreak++; cursor -= DAY; }
  const nutrients = ['calories', 'protein', 'carbs', 'fat'];
  const dailyEnergy = new Map();
  const recent = meals.filter(meal => meal.day >= startDay && meal.day <= today);
  for (const meal of recent) {
    for (const key of nutrients) {
      const amount = Number(meal[key]); check(meal[key] != null && Number.isFinite(amount) && amount >= 0, 'A mentett tápértékadatok nem dolgozhatók fel.', 503);
    }
    dailyEnergy.set(meal.day, (dailyEnergy.get(meal.day) || 0) + Number(meal.calories));
  }
  const periods = Object.fromEntries([7, 30, 365].map(length => {
    const firstDay = dateKey(end - (length - 1) * DAY);
    const entries = recent.filter(meal => meal.day >= firstDay);
    const activeDays = new Set(entries.map(meal => meal.day)).size;
    const totals = Object.fromEntries(nutrients.map(key => [key, entries.reduce((sum, meal) => sum + Number(meal[key]), 0)]));
    return [length, {
      start: firstDay, end: today, days: length, mealCount: entries.length, activeDays,
      averageMealsPerDay: activeDays ? round(entries.length / activeDays) : null,
      averagePerLoggedDay: Object.fromEntries(nutrients.map(key => [key, activeDays ? round(totals[key] / activeDays) : null])),
      averagePerMeal: Object.fromEntries(nutrients.map(key => [key, entries.length ? round(totals[key] / entries.length) : null])),
      mealTypes: TYPES.map(type => {
        const group = entries.filter(meal => meal.type === type);
        return { type, count: group.length, averageCalories: group.length ? round(group.reduce((sum, meal) => sum + Number(meal.calories), 0) / group.length) : null };
      }),
    }];
  }));
  return {
    period: { start: startDay, end: today, days: 365 },
    lifetime: { mealCount: [...days.values()].reduce((a, b) => a + b, 0), activeDays: days.size, currentStreak, longestStreak, lastLoggedDay: [...days.keys()].sort().at(-1) || null },
    recent: periods[365], periods,
    calendar: Array.from({ length: 365 }, (_, index) => {
      const day = dateKey(start + index * DAY);
      return { day, count: days.get(day) || 0, calories: dailyEnergy.has(day) ? round(dailyEnergy.get(day)) : null };
    }),
  };
}
export async function userProfile(db, userId, timeZone = 'Europe/Budapest', now = new Date()) {
  const today = profileToday(timeZone, now), start = dateKey(dayTime(today) - 364 * DAY);
  return db.transaction(async transaction => {
    if (db.dialect === 'postgres') await transaction.prepare('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY').bind().run();
    const profile = await transaction.prepare('SELECT name,email,avatar_url,created_at,calorie_goal FROM users WHERE id=?').bind(userId).first();
    check(profile, 'A felhasználói fiók nem található.', 404);
    const scope = "m.user_id=? AND m.status='saved' AND m.day<=? AND NOT EXISTS(SELECT 1 FROM analysis_jobs j WHERE j.meal_id=m.id AND j.kind='delete')";
    const days = await transaction.prepare(`SELECT m.day,COUNT(*) AS meal_count FROM meals m WHERE ${scope} GROUP BY m.day ORDER BY m.day`).bind(userId, today).all();
    const pg = db.dialect === 'postgres';
    const value = key => pg ? `(i.value->>'${key}')::double precision` : `json_extract(i.value,'$.${key}')`;
    const nutrients = ['calories', 'protein', 'carbs', 'fat'].map(key => {
      const sum = `SUM(${value('grams')}*${value(key)}/100.0)`;
      return `${pg ? `ROUND((${sum})::numeric,1)` : `ROUND(${sum},1)`} AS ${key}`;
    }).join(',');
    const entries = pg ? "jsonb_array_elements(m.analysis::jsonb->'ingredients')" : "json_each(m.analysis,'$.ingredients')";
    const meals = await transaction.prepare(`SELECT m.id,m.day,m.type,${nutrients} FROM meals m CROSS JOIN ${entries} AS i WHERE ${scope} AND m.day>=? GROUP BY m.id ORDER BY m.day`).bind(userId, today, start).all();
    return { profile: { name: profile.name, email: profile.email, avatarUrl: profile.avatar_url, joinedAt: profile.created_at, calorieGoal: profile.calorie_goal }, statistics: { ...profileStatistics(days.results, meals.results, today), timeZone } };
  });
}
