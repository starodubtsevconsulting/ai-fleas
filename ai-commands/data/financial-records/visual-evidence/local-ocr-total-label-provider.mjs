import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCanvas } from '@napi-rs/canvas';
import { createWorker } from 'tesseract.js';
import { createRequire } from 'node:module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const require = createRequire(path.resolve(__dirname, 'package.json'));

const PROVIDER = 'tesseract-js-local-eng-v1';
const MAX_REGIONS = 3;
const OCR_TIMEOUT_MS = 8_000;

export class NapiCanvasFactory {
  create(width, height) {
    const canvas = createCanvas(width, height);
    return { canvas, context: canvas.getContext('2d') };
  }
  reset(entry, width, height) {
    if (!entry?.canvas || width <= 0 || height <= 0) throw new Error('Invalid canvas reset');
    entry.canvas.width = width; entry.canvas.height = height;
  }
  destroy(entry) {
    if (!entry?.canvas) return;
    entry.canvas.width = 0; entry.canvas.height = 0; entry.canvas = null; entry.context = null;
  }
}

/** Local-only OCR. It never persists a crop or returns OCR text. */
export async function detectSupportedTotalLabel(page, candidate) {
  if (!page || !candidate || !Number.isFinite(candidate.x) || !Number.isFinite(candidate.y)) {
    return { outcome: 'unavailable', failureCode: 'visual-evidence-invalid-candidate', provider: PROVIDER };
  }
  try {
    const viewport = page.getViewport({ scale: 2 });
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    await page.render({ canvasContext: canvas.getContext('2d'), viewport, canvasFactory: new NapiCanvasFactory() }).promise;
    const scale = 2;
    // Booking renders its visual label in a separate layout block.  Keep the
    // region bounded, but include the label block above and beside the amount.
    const left = Math.max(0, Math.floor(candidate.x * scale - 200 * scale));
    const top = Math.max(0, Math.floor(viewport.height - (candidate.y + candidate.height + 140) * scale));
    const width = Math.min(canvas.width - left, Math.ceil(500 * scale));
    const height = Math.min(canvas.height - top, Math.ceil(260 * scale));
    if (width <= 0 || height <= 0) return { outcome: 'unavailable', failureCode: 'visual-evidence-invalid-bounds', provider: PROVIDER };
    const crop = createCanvas(width, height);
    crop.getContext('2d').drawImage(canvas, left, top, width, height, 0, 0, width, height);
    const langPath = path.dirname(require.resolve('@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz'));
    let worker;
    try {
      worker = await withinBudget(createWorker('eng', 1, { langPath, gzip: true, cacheMethod: 'none', logger: () => undefined }));
      const result = await withinBudget(worker.recognize(crop.toBuffer('image/png'), {}, { text: true }));
      const text = String(result.data.text || '').toLowerCase();
      const labelCategory = /total\s+room\s+price/.test(text) ? 'total-room-price' : /total\s+price/.test(text) ? 'total-price' : '';
      return labelCategory
        ? { outcome: 'matched', labelCategory, confidence: 0.9, normalizedBounds: { x: left / canvas.width, y: top / canvas.height, width: width / canvas.width, height: height / canvas.height }, provider: PROVIDER }
        : { outcome: 'none', provider: PROVIDER };
    } finally { if (worker) await worker.terminate().catch(() => undefined); }
  } catch {
    return { outcome: 'unavailable', failureCode: 'visual-evidence-provider-timeout-or-unavailable', provider: PROVIDER };
  }
}

export function boundedCandidateLimit(candidates) { return candidates.slice(0, MAX_REGIONS); }

function withinBudget(promise) {
  let timer;
  return Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('timeout')), OCR_TIMEOUT_MS); })]).finally(() => clearTimeout(timer));
}
