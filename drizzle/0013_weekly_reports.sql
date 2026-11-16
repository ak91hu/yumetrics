CREATE TABLE weekly_report_preferences (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)),
  language TEXT NOT NULL DEFAULT 'hu' CHECK(language IN ('hu','en')),
  enabled_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  unsubscribe_token TEXT NOT NULL UNIQUE
);
CREATE TABLE weekly_report_deliveries (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week_start TEXT NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('pending','sending','sent','failed','skipped')),
  payload TEXT, attempts INTEGER NOT NULL DEFAULT 0,
  first_attempt_at TEXT, next_attempt_at TEXT NOT NULL,
  lease_token TEXT, lease_until TEXT, provider_id TEXT, sent_at TEXT, error TEXT,
  PRIMARY KEY(user_id,week_start)
);
CREATE INDEX weekly_reports_queue ON weekly_report_deliveries(state,next_attempt_at);
