// The browser stores a near-original copy (barcode, archive); the model input is a smaller
// Cloudinary-derived copy made on the server (MODEL_IMAGE_MAX_SIDE), not here.
export const UPLOAD_MAX_SIDE = 3072;
export const UPLOAD_MAX_DATA_URL = 5_590_000;
export const UPLOAD_QUALITIES = [.92, .86, .8, .72];
export function photoDimensions(width, height, maxSide = UPLOAD_MAX_SIDE) {
  const side = typeof maxSide === 'number' ? maxSide : UPLOAD_MAX_SIDE;
  const ratio = Math.min(1, side / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * ratio)), height: Math.max(1, Math.round(height * ratio)) };
}
// Largest side first, then lower JPEG quality, then a smaller side, until the upload limit fits.
export function* encodingSteps(width, height) {
  for (const side of [UPLOAD_MAX_SIDE, 2560, 2048, 1600]) for (const quality of UPLOAD_QUALITIES) yield { ...photoDimensions(width, height, side), quality };
}
