UPDATE app_settings SET value = (value::jsonb || '{"model":"gemini-3.5-flash-lite","maxOutputTokens":1600}'::jsonb)::text, revision=revision+1 WHERE id=1;
