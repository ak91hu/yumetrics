import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { profileStatistics, profileToday, userProfile } from '../lib/profile-stats.mjs';
import { openDatabase } from '../lib/database.mjs';
import { api } from '../lib/api.mjs';

test('profile averages use logged days, zero history stays unknown and long streaks are not truncated to the heatmap', () => {
  const days = Array.from({ length: 400 }, (_, index) => ({ day: new Date(Date.UTC(2025, 9, 4 + index)).toISOString().slice(0, 10), meal_count: '1' }));
  const today = days.at(-1).day, result = profileStatistics(days, [], today);
  assert.equal(result.lifetime.currentStreak, 400); assert.equal(result.lifetime.longestStreak, 400);
  assert.equal(result.calendar.length, 365); assert.equal(result.calendar.at(-1).day, today);
  const meals = [{ day: '2026-11-05', type: 'Ebéd', calories: 300, protein: 20, carbs: 30, fat: 10 }, { day: '2026-11-05', type: 'Vacsora', calories: 500, protein: 30, carbs: 50, fat: 20 }, { day: '2026-11-06', type: 'Ebéd', calories: 400, protein: 25, carbs: 40, fat: 15 }];
  const stats = profileStatistics([{ day: '2026-11-06', meal_count: 1 }, { day: '2026-11-05', meal_count: 2 }], meals, '2026-11-07');
  assert.equal(stats.lifetime.currentStreak, 2); assert.equal(stats.recent.averagePerLoggedDay.calories, 600);
  assert.equal(stats.recent.averageMealsPerDay, 1.5); assert.equal(stats.calendar.at(-1).count, 0); assert.equal(stats.calendar.at(-1).calories, null);
  assert.equal(profileStatistics([], [], '2026-11-07').recent.averagePerLoggedDay.calories, null);
  assert.equal(profileStatistics([{ day: '2026-11-04', meal_count: 1 }], [], '2026-11-07').lifetime.currentStreak, 0);
  assert.throws(() => profileStatistics([], [{ ...meals[0], calories: null }], '2026-11-07'));
});

test('profile calendar uses the chosen time zone and handles leap days without DST gaps', () => {
  const now = new Date('2026-11-07T23:30:00Z');
  assert.equal(profileToday('Europe/Budapest', now), '2026-11-08');
  assert.equal(profileToday('America/New_York', now), '2026-11-07');
  assert.throws(() => profileToday('not/a-zone', now));
  const stats = profileStatistics([{ day: '2024-02-28', meal_count: 1 }, { day: '2024-02-29', meal_count: 1 }, { day: '2024-03-01', meal_count: 1 }], [], '2024-03-01');
  assert.equal(stats.lifetime.currentStreak, 3); assert.ok(stats.calendar.some(day => day.day === '2024-02-29'));
  assert.equal(new Set(stats.calendar.map(day => day.day)).size, 365);
});

test('profile reads real owner-scoped saved data, excludes drafts, deletion and future days, and retains fractional nutrients', async t => {
  const db = openDatabase(':memory:'); t.after(() => db.close()); const now = '2026-11-07T12:00:00.000Z';
  for (const id of ['alice', 'bob']) await db.prepare('INSERT INTO users(id,google_sub,email,name,created_at,updated_at) VALUES(?,?,?,?,?,?)').bind(id, id, id + '@example.test', id, now, now).run();
  async function meal(owner, day, calories, status = 'saved', grams = 100, deleting = false) {
    const id = randomUUID(), analysis = { name: 'Test', confidence: 'medium', ingredients: [{ name: 'Test', grams, calories, protein: 5, carbs: 10, fat: 2 }] };
    await db.prepare('INSERT INTO meals(id,user_id,day,time,type,status,analysis,photo,public_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind(id, owner, day, '12:00', 'Ebéd', status, JSON.stringify(analysis), '{}', id, now, now).run();
    if (deleting) await db.prepare("INSERT INTO analysis_jobs(meal_id,kind,state,input_hash,created_at,updated_at) VALUES(?,'delete','queued','',?,?)").bind(id, now, now).run();
    return id;
  }
  await meal('alice', '2026-11-05', 100); const editable = await meal('alice', '2026-11-05', 200);
  await meal('alice', '2026-11-06', 101, 'saved', 13);
  await meal('alice', '2026-11-07', 999, 'draft'); await meal('alice', '2026-11-08', 999);
  await meal('alice', '2026-11-07', 999, 'saved', 100, true); await meal('bob', '2026-11-07', 999);
  const result = await userProfile(db, 'alice', 'Europe/Budapest', new Date(now));
  assert.equal(result.profile.avatarUrl, null);
  assert.equal(result.profile.email, 'alice@example.test'); assert.equal(result.statistics.lifetime.mealCount, 3);
  assert.equal(result.statistics.lifetime.activeDays, 2); assert.equal(result.statistics.recent.averagePerLoggedDay.calories, 156.6);
  assert.equal(result.statistics.calendar.find(day => day.day === '2026-11-06').calories, 13.1);
  await db.prepare('UPDATE meals SET status=? WHERE id=?').bind('draft', editable).run();
  assert.equal((await userProfile(db, 'alice', 'Europe/Budapest', new Date(now))).statistics.lifetime.mealCount, 2);
  const get = (path, userId) => api(new Request('http://localhost' + path), { db, env: {}, userId });
  assert.equal((await get('/api/profile')).status, 401);
  assert.equal((await get('/api/profile?timezone=invalid', 'alice')).status, 400);
  const own = await (await get('/api/profile?userId=bob', 'alice')).json();
  assert.equal(own.profile.email, 'alice@example.test'); assert.ok(!JSON.stringify(own).includes('bob@example.test'));
});
