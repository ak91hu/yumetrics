import { createHash } from 'node:crypto';
import { AppError, check, validateImage } from './domain.mjs';
import { cloudinary } from './providers.mjs';

export function photoLinks(photo, id) {
  if (!photo?.url) return null;
  const link = (item, view) => ({ url: `/api/meals/${id}/photo/${view}`, width: item.width, height: item.height, pending: item.pending });
  return { ...link(photo, 'primary'), ...(photo.additional?.url ? { additional: link(photo.additional, 'additional') } : {}) };
}
function photoUrl(photo, env) {
  const url = new URL(photo.url);
  check(url.protocol === 'https:' && url.hostname === 'res.cloudinary.com' && !url.port && !url.username && !url.password && !url.search && !url.hash && url.pathname.startsWith(`/${env.CLOUDINARY_CLOUD_NAME}/image/`) && /^[a-zA-Z0-9_-]+$/.test(env.CLOUDINARY_CLOUD_NAME), 'A tárolt képhivatkozás nem megfelelő.', 502);
  check(/^yumetrics\/[a-zA-Z0-9_-]+$/.test(photo.publicId), 'A tárolt kép azonosítója nem megfelelő.', 502);
  const path = url.pathname.split('/image/')[1];
  check(/^(upload|authenticated)\/(v\d+\/)?yumetrics\/[a-zA-Z0-9_-]+(?:\.(jpg|jpeg|png|webp))?$/.test(path) && (photo.pending || /\.(jpg|jpeg|png|webp)$/.test(path)) && path.replace(/^(upload|authenticated)\/(v\d+\/)?/, '').replace(/\.[^.]+$/, '') === photo.publicId, 'A tárolt képhivatkozás nem megfelelő.', 502);
  return url;
}
export async function securePhoto(photo, env, fetcher = fetch) {
  const url = photoUrl(photo, env);
  if (url.pathname.includes('/image/authenticated/')) return { ...photo, type: 'authenticated' };
  const secured = await cloudinary('secure', photo.publicId, env, null, fetcher);
  return secured || { ...photo, url: url.href.replace('/image/upload/', '/image/authenticated/'), type: 'authenticated', pending: true };
}
export async function secureStoredPhotos(db, env, fetcher = fetch) {
  let cursor = '', changed = 0;
  for (;;) {
    const { results } = await db.prepare('SELECT id,photo FROM meals WHERE id>? AND photo IS NOT NULL ORDER BY id LIMIT 100').bind(cursor).all();
    if (!results.length) return changed;
    for (const row of results) {
      cursor = row.id;
      const photo = JSON.parse(row.photo);
      if (!photo?.url) continue;
      const primary = await securePhoto(photo, env, fetcher);
      if (photo.additional?.url) primary.additional = await securePhoto(photo.additional, env, fetcher);
      const updated = JSON.stringify(primary);
      if (updated !== row.photo) changed += (await db.prepare('UPDATE meals SET photo=? WHERE id=? AND photo=?').bind(updated, row.id, row.photo).run()).meta.changes;
    }
  }
}
// Model input size: the original stays in Cloudinary, the model gets a derived copy.
// Cloudinary-transformáció (c_limit never upscales); the size is measured on the reference set.
export const DEFAULT_MODEL_IMAGE_SIDE = 1600;
export function modelImageTransformation(env = {}) {
  const side = Number(env.MODEL_IMAGE_MAX_SIDE ?? DEFAULT_MODEL_IMAGE_SIDE);
  const valid = Number.isInteger(side) && side >= 512 && side <= 4096 ? side : DEFAULT_MODEL_IMAGE_SIDE;
  return `c_limit,w_${valid},h_${valid},q_85,f_jpg`;
}
// Signed delivery URL for an authenticated asset: the signature covers "transformation/public_id.format", without the version.
export function signedPhotoUrl(photo, env, transformation = null) {
  check(transformation === null || /^[a-z]_[a-z0-9_]+(?:,[a-z]_[a-z0-9_]+)*$/.test(transformation), 'Hibás képtranszformáció.', 500);
  const url = photoUrl(photo, env), prefix = `/${env.CLOUDINARY_CLOUD_NAME}/image/authenticated/`;
  const path = url.pathname.slice(prefix.length), signed = (transformation ? transformation + '/' : '') + path.replace(/^v\d+\//, '');
  const signature = createHash('sha1').update(signed + env.CLOUDINARY_API_SECRET).digest('base64url').slice(0, 8);
  url.pathname = prefix + `s--${signature}--/` + (transformation ? transformation + '/' : '') + path;
  return url;
}
export async function storedPhotoData(photo, fetcher = fetch, env = {}, { transformation = null } = {}) {
  photo = await securePhoto(photo, env, fetcher);
  if (transformation) {
    // A missing or failed derived copy must not block the analysis: fall back to the stored original.
    try { return await download(signedPhotoUrl(photo, env, transformation), fetcher); } catch { /* original below */ }
  }
  return download(signedPhotoUrl(photo, env), fetcher);
}
async function download(url, fetcher) {
  let response;
  try { response = await fetcher(url.href, { redirect: 'error', signal: AbortSignal.timeout(25_000) }); }
  catch { throw new AppError('A tárolt képet most nem lehet betölteni. Próbáld újra később.', 502); }
  check(response.ok && response.body, 'A kép nem érhető el.', 502);
  const reader = response.body.getReader(), chunks = []; let size = 0;
  for (;;) { const part = await reader.read(); if (part.done) break; size += part.value.length; if (size > 4_200_000) { await reader.cancel(); throw new AppError('A tárolt kép túl nagy.', 413); } chunks.push(Buffer.from(part.value)); }
  const mime = response.headers.get('content-type')?.split(';')[0], data = `data:${mime};base64,${Buffer.concat(chunks).toString('base64')}`;
  validateImage(data); return data;
}
