import { createHash } from 'node:crypto';
import { AppError } from './domain.mjs';

export async function requestLimit(db, scope, identity, limit, seconds, time = Date.now()) {
  const now = new Date(time).toISOString(), expires = new Date(time + seconds * 1000).toISOString();
  const bucket = createHash('sha256').update(scope + ':' + identity).digest('hex');
  await db.prepare('DELETE FROM request_limits WHERE expires_at<=?').bind(now).run();
  const accepted = await db.prepare('INSERT INTO request_limits(bucket,hits,expires_at) VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET hits=request_limits.hits+1 WHERE request_limits.hits<? RETURNING hits').bind(bucket, expires, limit).first();
  if (!accepted) {
    const error = new AppError('Túl sok kérés érkezett rövid idő alatt. Várj egy kicsit, majd próbáld újra.', 429);
    error.retryAfter = seconds; throw error;
  }
}
