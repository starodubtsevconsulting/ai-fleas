/**
 * Purpose: validate and normalize bounded PDF read plans without embedding financial-domain assumptions.
 * Caller: PdfReader.read and named domain read-plan modules.
 * Input/output: a plain read-plan object; returns a frozen validated plan.
 * Effects: validation only; this helper does not read files, render pages, run OCR, or persist evidence.
 */

export function validatedReadPlan(input) {
  if (!input || typeof input !== 'object' || !/^[a-z][a-z0-9-]{0,63}$/.test(String(input.id || ''))) {
    throw new Error('invalid-read-plan');
  }
  const maxPages = boundedInteger(input.maxPages, 1, 25);
  const maxTextItemsPerPage = boundedInteger(input.maxTextItemsPerPage, 1, 10000);
  const maxTextChars = boundedInteger(input.maxTextChars, 1024, 32 * 1024);
  const layout = input.layoutTokens || {};
  const layoutTokens = {
    numeric: layout.numeric === true,
    maxTokens: boundedInteger(layout.maxTokens ?? 1, 1, 2000),
    maxDigits: boundedInteger(layout.maxDigits ?? 1, 1, 12),
  };
  const renderInput = input.renderLimits || {};
  const renderLimits = {
    maxPixelsPerPage: boundedInteger(renderInput.maxPixelsPerPage, 1, 64 * 1024 * 1024),
    maxPixelsTotal: boundedInteger(renderInput.maxPixelsTotal, 1, 128 * 1024 * 1024),
  };
  if (renderLimits.maxPixelsTotal < renderLimits.maxPixelsPerPage) throw new Error('invalid-read-plan');
  const ocrInput = input.ocr || {};
  const enabled = ocrInput.enabled === true;
  const languages = Array.isArray(ocrInput.languages) ? ocrInput.languages.map(String) : [];
  if (enabled && (languages.length !== 1 || languages[0] !== 'eng')) throw new Error('invalid-read-plan');
  const ocr = {
    enabled,
    triggerBelowCompactChars: boundedInteger(ocrInput.triggerBelowCompactChars ?? 0, 0, maxTextChars),
    languages,
    pageSegmentationMode: String(ocrInput.pageSegmentationMode ?? '3'),
    scale: boundedNumber(ocrInput.scale ?? 2, 1, 4),
  };
  if (!new Set(['3', '4', '6', '11']).has(ocr.pageSegmentationMode)) throw new Error('invalid-read-plan');
  return deepFreeze({ id: input.id, maxPages, maxTextItemsPerPage, maxTextChars,
    layoutTokens, renderLimits, ocr });
}

export function boundedRenderDimensions(viewport, pixelsAlreadyRendered, readPlan) {
  const width = Math.ceil(Number(viewport?.width));
  const height = Math.ceil(Number(viewport?.height));
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width <= 0 || height <= 0
    || !Number.isSafeInteger(pixelsAlreadyRendered) || pixelsAlreadyRendered < 0) {
    throw new Error('render-size-limit');
  }
  const pixels = width * height;
  if (!Number.isSafeInteger(pixels) || pixels > readPlan.renderLimits.maxPixelsPerPage
    || pixelsAlreadyRendered + pixels > readPlan.renderLimits.maxPixelsTotal) {
    throw new Error('render-size-limit');
  }
  return { width, height, pixels, cumulativePixels: pixelsAlreadyRendered + pixels };
}

function boundedInteger(value, minimum, maximum) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) throw new Error('invalid-read-plan');
  return value;
}

function boundedNumber(value, minimum, maximum) {
  if (!Number.isFinite(value) || value < minimum || value > maximum) throw new Error('invalid-read-plan');
  return value;
}

function deepFreeze(value) {
  for (const child of Object.values(value)) if (child && typeof child === 'object') deepFreeze(child);
  return Object.freeze(value);
}
