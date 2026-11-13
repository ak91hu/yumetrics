UPDATE app_settings SET value=json_set(value,'$.model','gemini-3.5-flash-lite','$.maxOutputTokens',1600),revision=revision+1 WHERE id=1;
