/**
 * Purpose: define the domain-neutral default PDF read limits used by Financial Records callers.
 * Caller: PdfReader.read when no explicit read plan is supplied.
 * Input/output: exports one immutable validated read plan.
 * Effects: configuration only; generic reads preserve the bounded OCR fallback but collect no numeric layout tokens.
 */
import { validatedReadPlan } from './read-plan.mjs';

export const genericReadPlan = validatedReadPlan({
  id: 'generic',
  maxPages: 5,
  maxTextItemsPerPage: 10000,
  maxTextChars: 32 * 1024,
  layoutTokens: { numeric: false, maxTokens: 1, maxDigits: 1 },
  renderLimits: { maxPixelsPerPage: 8 * 1024 * 1024, maxPixelsTotal: 20 * 1024 * 1024 },
  ocr: { enabled: true, triggerBelowCompactChars: 1024, languages: ['eng'], pageSegmentationMode: '6', scale: 2 },
});
