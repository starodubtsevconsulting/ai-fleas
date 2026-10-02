/**
 * Run: node ai-commands/data/financial-records/pdf-reader.test.mjs
 * Passing verifies that generic reads avoid domain numeric-layout evidence while the explicit payroll-tax plan
 * preserves bounded numeric tokens. It does not validate OCR accuracy or any live/private document.
 */
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PdfReader } from './pdf-reader.mjs';
import { genericReadPlan } from './read-plans/generic-read-plan.mjs';
import { payrollTaxReadPlan } from './read-plans/payroll-tax-read-plan.mjs';
import { boundedRenderDimensions, validatedReadPlan } from './read-plans/read-plan.mjs';

const fixture = path.join(path.dirname(fileURLToPath(import.meta.url)), 'test-fixtures', 'booking-in.pdf');
const reader = new PdfReader();
const generic = await reader.read(fixture);
assert.match(generic.textSource, /^embedded-pdf-text(?:\+local-ocr)?$/);
assert.deepEqual(generic.layoutTokens, []);
assert.equal(genericReadPlan.layoutTokens.numeric, false);

const payroll = await reader.read(fixture, payrollTaxReadPlan);
assert.equal(payrollTaxReadPlan.layoutTokens.numeric, true);
assert.ok(payroll.layoutTokens.length > 0);
assert.ok(payroll.layoutTokens.every((token) => /^\d{1,12}$/.test(token.value)));
assert.ok(payroll.layoutTokens.every((token) => token.source === 'embedded-layout'
  ? token.confidence === 1 : token.confidence >= 0 && token.confidence <= 1));
assert.ok(payroll.layoutTokens.every((token) => ['x', 'y', 'width', 'height']
  .every((key) => token.bbox[key] >= 0 && token.bbox[key] <= 1)));
assert.ok(payroll.layoutTokens.length <= payrollTaxReadPlan.layoutTokens.maxTokens);
assert.throws(() => validatedReadPlan({ ...payrollTaxReadPlan, maxPages: 0 }), /invalid-read-plan/);
assert.throws(() => validatedReadPlan({ ...payrollTaxReadPlan,
  ocr: { ...payrollTaxReadPlan.ocr, languages: ['fra'] } }), /invalid-read-plan/);
assert.throws(() => validatedReadPlan({ ...payrollTaxReadPlan,
  ocr: { ...payrollTaxReadPlan.ocr, pageSegmentationMode: '13' } }), /invalid-read-plan/);

const letterAtScaleTwo = boundedRenderDimensions({ width: 1224, height: 1584 }, 0, payrollTaxReadPlan);
assert.equal(letterAtScaleTwo.pixels, 1224 * 1584);
assert.throws(() => boundedRenderDimensions({ width: Number.POSITIVE_INFINITY, height: 100 }, 0,
  payrollTaxReadPlan), /render-size-limit/);
assert.throws(() => boundedRenderDimensions({
  width: payrollTaxReadPlan.renderLimits.maxPixelsPerPage + 1, height: 1,
}, 0, payrollTaxReadPlan), /render-size-limit/);
assert.throws(() => boundedRenderDimensions({ width: 100, height: 100 },
  payrollTaxReadPlan.renderLimits.maxPixelsTotal - 9999, payrollTaxReadPlan), /render-size-limit/);

const truncationPlan = validatedReadPlan({
  ...payrollTaxReadPlan,
  id: 'bounded-test',
  maxTextChars: 1024,
  layoutTokens: { ...payrollTaxReadPlan.layoutTokens, maxTokens: 2 },
});
const truncated = await reader.read(fixture, truncationPlan);
assert.ok(truncated.normalizedText.length <= 1024);
assert.ok(truncated.layoutTokens.length <= 2);
console.log('financial-records PDF read plans: PASS');
