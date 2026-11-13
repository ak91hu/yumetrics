CREATE TABLE food_api_cache(cache_key TEXT PRIMARY KEY,value TEXT NOT NULL,expires_at TEXT NOT NULL);
CREATE INDEX food_api_cache_expiry ON food_api_cache(expires_at);
CREATE TABLE food_api_limits(bucket TEXT PRIMARY KEY,requests INTEGER NOT NULL,expires_at TEXT NOT NULL);
CREATE TABLE off_product_records(record_key TEXT PRIMARY KEY,record TEXT NOT NULL,retrieved_at TEXT NOT NULL);
