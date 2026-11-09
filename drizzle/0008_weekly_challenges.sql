CREATE TABLE weekly_challenges (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week_start TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('three_days','recipe','measured')),
  selected_at TEXT NOT NULL,
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 3),
  last_day TEXT,
  completed_at TEXT,
  PRIMARY KEY (user_id, week_start)
);
