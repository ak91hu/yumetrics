CREATE TABLE request_limits(bucket TEXT PRIMARY KEY, hits INTEGER NOT NULL, expires_at TEXT NOT NULL);
CREATE INDEX request_limits_expiry ON request_limits(expires_at);
