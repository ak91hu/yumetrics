CREATE TABLE ai_requests(id TEXT PRIMARY KEY,meal_id TEXT,user_id TEXT,model TEXT NOT NULL,state TEXT NOT NULL,usage TEXT,input_tokens BIGINT,output_tokens BIGINT,cached_tokens BIGINT,thought_tokens BIGINT,cost_usd DOUBLE PRECISION,pricing TEXT,http_status INTEGER,latency_ms INTEGER,created_at TEXT NOT NULL,finished_at TEXT);
CREATE INDEX ai_requests_date ON ai_requests(created_at);
CREATE INDEX ai_requests_meal ON ai_requests(meal_id);
CREATE TABLE app_logs(id TEXT PRIMARY KEY,level TEXT NOT NULL,category TEXT NOT NULL,event TEXT NOT NULL,message TEXT NOT NULL,user_id TEXT,meal_id TEXT,code TEXT,created_at TEXT NOT NULL);
CREATE INDEX app_logs_date ON app_logs(created_at);
