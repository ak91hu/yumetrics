-- Additive only: no DROP, TRUNCATE, column removal or type change on existing tables.
-- The automatically pinned low-cost model (0009) is unpinned; OPENCODE_MODEL / the code default decides.
UPDATE app_settings SET value = (value::jsonb - 'model' - 'maxOutputTokens')::text, revision=revision+1
  WHERE id=1 AND value::jsonb->>'model' = 'gemini-3.5-flash-lite' AND (value::jsonb->>'maxOutputTokens') = '1600';
-- Personal portion and preparation prior per canonical dish (architecture plan: user_correction).
CREATE TABLE IF NOT EXISTS user_correction (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  dish_key TEXT NOT NULL,
  portion_factor DOUBLE PRECISION,
  preparation TEXT,
  samples INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, dish_key)
);
-- Food-R1 escalation queue; the job references the stored Cloudinary photo, no copy.
CREATE TABLE IF NOT EXISTS food_r1_job (
  meal_id TEXT PRIMARY KEY REFERENCES meals(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  image_ref TEXT,
  state TEXT NOT NULL DEFAULT 'queued',
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TEXT NOT NULL,
  lease_token TEXT,
  lease_until TEXT,
  base_revision INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  result TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS food_r1_job_queue ON food_r1_job(state, next_attempt_at);
-- Nullable state of the second estimate shown with the fast result.
ALTER TABLE meals ADD COLUMN IF NOT EXISTS refinement TEXT;
