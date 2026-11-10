CREATE TABLE weekly_activity (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week_start TEXT NOT NULL,
  activity_day TEXT NOT NULL,
  recipe INTEGER NOT NULL DEFAULT 0 CHECK (recipe IN (0,1)),
  measured INTEGER NOT NULL DEFAULT 0 CHECK (measured IN (0,1)),
  PRIMARY KEY (user_id,week_start,activity_day)
);
