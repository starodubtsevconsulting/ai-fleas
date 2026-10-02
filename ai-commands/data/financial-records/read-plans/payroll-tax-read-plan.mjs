/**
 * Purpose: opt payroll-tax form preparation into bounded OCR and numeric form-layout evidence.
 * Caller: financial-records.command.mjs prepare-tax-from-source through PdfReader.read.
 * Input/output: exports one immutable validated payroll-tax read plan.
 * Effects: configuration only; OCR remains local/in-memory and layout tokens remain bounded internal evidence.
 */
import { validatedReadPlan } from './read-plan.mjs';

export const payrollTaxReadPlan = validatedReadPlan({
  id: 'payroll-tax',
  maxPages: 5,
  maxTextItemsPerPage: 10000,
  maxTextChars: 32 * 1024,
  layoutTokens: { numeric: true, maxTokens: 2000, maxDigits: 12 },
  renderLimits: { maxPixelsPerPage: 8 * 1024 * 1024, maxPixelsTotal: 20 * 1024 * 1024 },
  ocr: { enabled: true, triggerBelowCompactChars: 1024, languages: ['eng'], pageSegmentationMode: '6', scale: 2 },
});
