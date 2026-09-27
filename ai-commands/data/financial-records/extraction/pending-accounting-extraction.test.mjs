import assert from 'node:assert/strict';
import { test } from 'node:test';

test('builds a bounded validated extraction preview only from eligible safe recognition', async () => {
  const { buildPendingAccountingExtraction, validPendingAccountingExtraction } = await import('./pending-accounting-extraction.mjs');
  const extraction = buildPendingAccountingExtraction({
    status: 'eligible', documentKind: 'marketplace-reservation', destination: 'in',
    issuer: 'Booking.com', documentDate: '2026-08-07', year: '2026', quarter: 'q3',
    confidence: 1, reasons: ['reservation-details', 'credible-date', 'unsafe value 123'],
    primaryTotal: { amount: 1475.76, currency: 'CAD', label: 'total-price', provenance: 'visible-pdf-total' },
  });
  assert.equal(validPendingAccountingExtraction(extraction), true);
  assert.deepEqual(extraction.period, { year: 2026, quarter: 3, documentBucketDate: '2026-08-07' });
  assert.deepEqual(extraction.tags, ['reservation-details', 'credible-date']);
  assert.doesNotMatch(JSON.stringify(extraction), /guest|property|reservation number|raw text/i);
  assert.ok(Buffer.byteLength(JSON.stringify(extraction)) < 16 * 1024);
});

test('fails closed for uncertain, incompatible, or invalid extraction inputs', async () => {
  const { buildPendingAccountingExtraction, validPendingAccountingExtraction } = await import('./pending-accounting-extraction.mjs');
  const base = { status: 'eligible', documentKind: 'marketplace-reservation', destination: 'in', issuer: 'Booking.com', documentDate: '2026-08-07', year: '2026', quarter: 'q3', confidence: 1, reasons: [], primaryTotal: { amount: 1475.76, currency: 'CAD', label: 'total-price', provenance: 'visible-pdf-total' } };
  for (const change of [
    { status: 'review-required' }, { destination: 'out' }, { issuer: 'arbitrary' },
    { documentDate: 'not-a-date' }, { quarter: 'q5' }, { confidence: 0.79 },
    { primaryTotal: { amount: Number.NaN, currency: 'CAD', label: 'total-price' } },
  ]) assert.equal(buildPendingAccountingExtraction({ ...base, ...change }), undefined);
  assert.equal(validPendingAccountingExtraction({ schema: 'sc.accounting.document-extraction' }), false);
});
