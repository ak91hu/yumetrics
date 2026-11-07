CREATE TABLE users (
  id TEXT PRIMARY KEY, google_sub TEXT NOT NULL UNIQUE, email TEXT NOT NULL,
  name TEXT NOT NULL, avatar_url TEXT, calorie_goal REAL NOT NULL DEFAULT 2000,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE INDEX sessions_expiry ON sessions(expires_at);
CREATE TABLE oauth_states (state_hash TEXT PRIMARY KEY, nonce TEXT NOT NULL, verifier TEXT NOT NULL, expires_at TEXT NOT NULL);
CREATE TABLE meals (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), day TEXT NOT NULL,
  time TEXT NOT NULL, timezone TEXT NOT NULL DEFAULT 'Europe/Budapest', type TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '', analysis_context TEXT, status TEXT NOT NULL DEFAULT 'analyzing',
  analysis TEXT, original_analysis TEXT, photo TEXT, public_id TEXT NOT NULL,
  model TEXT, prompt_version TEXT, usage TEXT, latency_ms INTEGER, error TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX meals_owner_day ON meals(user_id,day,time);
CREATE TABLE analysis_attempts(id TEXT PRIMARY KEY, user_id TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE INDEX attempts_owner_date ON analysis_attempts(user_id,created_at);
CREATE TABLE analysis_jobs (
  meal_id TEXT PRIMARY KEY REFERENCES meals(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'analyze', state TEXT NOT NULL DEFAULT 'uploading', input_hash TEXT NOT NULL,
  lease_token TEXT, lease_until TEXT, attempts INTEGER NOT NULL DEFAULT 0, error TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX jobs_queue ON analysis_jobs(state,lease_until,created_at);
CREATE TABLE food_records(fdc_id TEXT PRIMARY KEY, record TEXT NOT NULL, retrieved_at TEXT NOT NULL);
