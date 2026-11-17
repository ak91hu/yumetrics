import { validBarcode, offProductUrl, normalizeOffProduct } from '/barcode.mjs';

// Barcode search on the ORIGINAL resolution photo, before the upload shrinks it.
const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e'];
const ZXING_URL = '/vendor/zxing-library-0.21.3.min.js';
let zxing;
function loadZXing() {
  if (window.ZXing) return Promise.resolve(window.ZXing);
  zxing ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = ZXING_URL; script.async = true;
    script.onload = () => window.ZXing ? resolve(window.ZXing) : reject(new Error('ZXing unavailable'));
    script.onerror = () => { zxing = null; reject(new Error('ZXing unavailable')); };
    document.head.append(script);
  });
  return zxing;
}
async function nativeDetector() {
  if (!('BarcodeDetector' in window)) return null;
  try {
    const supported = (await window.BarcodeDetector.getSupportedFormats()).filter(format => FORMATS.includes(format));
    return supported.length ? new window.BarcodeDetector({ formats: supported }) : null;
  } catch { return null; }
}
const unique = codes => [...new Set(codes.map(code => String(code).trim()).filter(validBarcode))];
function luminance(canvas) {
  const { data } = canvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, canvas.width, canvas.height);
  const values = new Uint8ClampedArray(canvas.width * canvas.height);
  for (let i = 0, j = 0; j < values.length; i += 4, j++) values[j] = (data[i] * 306 + data[i + 1] * 601 + data[i + 2] * 117) >> 10;
  return values;
}
function canvasFrom(source, maxSide = 3000) {
  const width = source.videoWidth || source.naturalWidth || source.width, height = source.videoHeight || source.naturalHeight || source.height;
  const scale = Math.min(1, maxSide / Math.max(width, height)), canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale); canvas.height = Math.round(height * scale);
  canvas.getContext('2d', { willReadFrequently: true }).drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}
async function zxingDecode(canvas) {
  const ZXing = await loadZXing();
  const hints = new Map([[ZXing.DecodeHintType.POSSIBLE_FORMATS, [ZXing.BarcodeFormat.EAN_13, ZXing.BarcodeFormat.EAN_8, ZXing.BarcodeFormat.UPC_A, ZXing.BarcodeFormat.UPC_E]], [ZXing.DecodeHintType.TRY_HARDER, true]]);
  const reader = new ZXing.MultiFormatReader(); reader.setHints(hints);
  try { return [reader.decode(new ZXing.BinaryBitmap(new ZXing.HybridBinarizer(new ZXing.RGBLuminanceSource(luminance(canvas), canvas.width, canvas.height))), hints).getText()]; }
  catch { return []; }
}
// Returns every valid code found (several codes: the app asks which product it is).
export async function detectBarcodes(source, { fast = false } = {}) {
  const detector = await nativeDetector();
  if (detector) {
    try { const found = unique((await detector.detect(source)).map(item => item.rawValue)); if (found.length || fast) return found; } catch { /* Fall back to ZXing. */ }
  }
  const canvas = canvasFrom(source, fast ? 1280 : 3000);
  const found = await zxingDecode(canvas);
  if (found.length || fast) return unique(found);
  // A small code on a large photo: try a centred crop as well.
  const crop = document.createElement('canvas'); crop.width = Math.round(canvas.width / 2); crop.height = Math.round(canvas.height / 2);
  crop.getContext('2d', { willReadFrequently: true }).drawImage(canvas, canvas.width / 4, canvas.height / 4, crop.width, crop.height, 0, 0, crop.width, crop.height);
  return unique(await zxingDecode(crop));
}
// Direct Open Food Facts lookup from the device (per-user rate limit); the backend proxy is the fallback.
export async function lookupProduct(code, language, request) {
  if (!validBarcode(code)) throw new Error('Érvénytelen vonalkód.');
  try {
    const response = await fetch(offProductUrl(code), { headers: { Accept: 'application/json' }, cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer' });
    if (response.status === 404) return null;
    if (response.ok) { const payload = await response.json(); return payload?.product ? normalizeOffProduct(payload.product, language) : null; }
  } catch { /* Use the proxy. */ }
  return (await request(`/api/barcode/${code}`)).product;
}
export async function startCameraScan(video, onCode) {
  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
  video.srcObject = stream; video.hidden = false; await video.play();
  let stopped = false, busy = false;
  const stop = () => { stopped = true; clearInterval(timer); stream.getTracks().forEach(track => track.stop()); video.srcObject = null; video.hidden = true; };
  const timer = setInterval(async () => {
    if (stopped || busy || !video.videoWidth) return;
    busy = true;
    try { const [code] = await detectBarcodes(video, { fast: true }); if (code && !stopped) { stop(); onCode(code); } }
    finally { busy = false; }
  }, 350);
  return stop;
}
