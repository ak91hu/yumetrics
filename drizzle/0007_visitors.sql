CREATE TABLE visitor_stats (
  day TEXT NOT NULL,
  dimension TEXT NOT NULL CHECK (dimension IN ('total','page','country','browser','os','device','source','language','hour')),
  value TEXT NOT NULL,
  views INTEGER NOT NULL DEFAULT 0 CHECK (views >= 0),
  PRIMARY KEY (day, dimension, value)
);
