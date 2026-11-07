CREATE TABLE users(id TEXT PRIMARY KEY,google_sub TEXT NOT NULL UNIQUE,email TEXT NOT NULL,name TEXT NOT NULL,avatar_url TEXT,calorie_goal REAL NOT NULL DEFAULT 2000,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
--> statement-breakpoint
CREATE TABLE sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,expires_at TEXT NOT NULL,created_at TEXT NOT NULL);
--> statement-breakpoint
CREATE INDEX sessions_expiry ON sessions(expires_at);
--> statement-breakpoint
CREATE TABLE oauth_states(state_hash TEXT PRIMARY KEY,nonce TEXT NOT NULL,verifier TEXT NOT NULL,expires_at TEXT NOT NULL);
--> statement-breakpoint
CREATE TABLE analysis_jobs(meal_id TEXT PRIMARY KEY REFERENCES meals(id) ON DELETE CASCADE,kind TEXT NOT NULL DEFAULT 'analyze',state TEXT NOT NULL DEFAULT 'uploading',input_hash TEXT NOT NULL,lease_token TEXT,lease_until TEXT,attempts INTEGER NOT NULL DEFAULT 0,error TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
--> statement-breakpoint
CREATE INDEX jobs_queue ON analysis_jobs(state,lease_until,created_at);
--> statement-breakpoint
CREATE TABLE food_records(fdc_id TEXT PRIMARY KEY,record TEXT NOT NULL,retrieved_at TEXT NOT NULL);
