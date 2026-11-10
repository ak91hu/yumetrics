ALTER TABLE ai_requests ADD COLUMN request_meta TEXT;
ALTER TABLE ai_requests ADD COLUMN response_text TEXT;
ALTER TABLE ai_requests ADD COLUMN response_meta TEXT;
ALTER TABLE ai_requests ADD COLUMN response_truncated INTEGER NOT NULL DEFAULT 0;
ALTER TABLE ai_requests ADD COLUMN result_analysis TEXT;
ALTER TABLE ai_requests ADD COLUMN reviewed_analysis TEXT;
ALTER TABLE ai_requests ADD COLUMN reviewed_at TEXT;
ALTER TABLE ai_requests ADD COLUMN reviewed_revision INTEGER;
