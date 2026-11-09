ALTER TABLE users ADD COLUMN blocked INTEGER NOT NULL DEFAULT 0;
CREATE TABLE app_settings(id INTEGER PRIMARY KEY CHECK(id=1), value TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 0);
INSERT INTO app_settings(id,value) VALUES(1,'{}');
CREATE TABLE admin_audit(id TEXT PRIMARY KEY, actor_id TEXT NOT NULL REFERENCES users(id), action TEXT NOT NULL, target TEXT NOT NULL, details TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE INDEX admin_audit_date ON admin_audit(created_at);
CREATE INDEX meals_created ON meals(created_at);
CREATE INDEX attempts_date ON analysis_attempts(created_at);
