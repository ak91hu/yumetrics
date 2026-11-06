CREATE TABLE meals (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  day TEXT NOT NULL,
  time TEXT NOT NULL,
  type TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'analyzing' CHECK (status IN ('analyzing','draft','saved','failed')),
  analysis TEXT,
  original_analysis TEXT,
  photo TEXT,
  public_id TEXT NOT NULL,
  model TEXT,
  prompt_version TEXT,
  usage TEXT,
  latency_ms INTEGER,
  error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 0
);
--> statement-breakpoint
CREATE INDEX meals_owner_day ON meals(user_id, day, time);
--> statement-breakpoint
CREATE TABLE analysis_attempts (id TEXT PRIMARY KEY NOT NULL, user_id TEXT NOT NULL, created_at TEXT NOT NULL);
--> statement-breakpoint
CREATE INDEX attempts_owner_date ON analysis_attempts(user_id, created_at);
