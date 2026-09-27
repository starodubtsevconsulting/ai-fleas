import assert from 'node:assert/strict';
import { test } from 'node:test';

test('builds the exact privacy-safe Booking marketplace reservation basename', async () => {
  const { canonicalAccountingPdfBasename } = await import('./accounting-recognition-naming-policy.mjs');
  assert.equal(canonicalAccountingPdfBasename({ documentDate: '2026-08-14', issuer: 'Booking.com', documentKind: 'marketplace-reservation' }), '2026-08-14_booking_marketplace-reservation.pdf');
});

test('fails closed for missing, invalid, or non-allowlisted recognition fields', async () => {
  const { canonicalAccountingPdfBasename } = await import('./accounting-recognition-naming-policy.mjs');
  for (const value of [
    {},
    { documentDate: '2026-02-30', issuer: 'Booking.com', documentKind: 'marketplace-reservation' },
    { documentDate: '2026-08-14', issuer: 'Arbitrary Source', documentKind: 'marketplace-reservation' },
    { documentDate: '2026-08-14', issuer: 'Booking.com', documentKind: 'arbitrary-kind' },
  ]) assert.equal(canonicalAccountingPdfBasename(value), undefined);
});
