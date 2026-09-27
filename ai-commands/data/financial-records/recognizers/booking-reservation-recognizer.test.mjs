import assert from 'node:assert/strict';
import { test } from 'node:test';

async function recognizer() {
  return import('./booking-reservation-recognizer.mjs');
}

function input(parts, branchId = 'chalet') {
  const normalizedText = parts.join(' ');
  return { normalizedText, compactText: parts.join('').toLowerCase().replace(/[^a-z0-9]/g, ''), context: { branchId } };
}

test('recognizes fragmented two-page-style Booking reservation evidence without exposing property text', async () => {
  const { recognizeBookingReservation } = await recognizer();
  const parts = [
    'B','o','o','k','i','n','g','.','c','o','m',' ', 'R','e','s','e','r','v','a','t','i','o','n',' ', 'D','e','t','a','i','l','s',' ',
    'Accommodation: ', 'Chalet ', 'Fictional ', 'Retreat ', 'Reservation ', 'Number: ', 'ZZ-000 ',
    'Check-in: ', 'Aug ', '14, ', '2026 ', 'Check-out: ', 'Aug ', '18, ', '2026 ',
    '4 nights ', '2 guests ', '1 room ', 'Total price ', '— ', 'CAD ', '1,475.76 ', 'Taxes CAD 90.00 ',
    'Booking.com facilitated guest payment ', 'Commissionable amount CAD 800.00 ', 'Estimated commission CAD 120.00',
  ];
  const result = recognizeBookingReservation(input(parts)).result;
  assert.deepEqual({ kind: result.documentKind, section: result.section, year: result.year, quarter: result.quarter, branch: result.branchId, issuer: result.issuer, classification: result.classification },
    { kind: 'marketplace-reservation', section: 'in', year: '2026', quarter: 'q3', branch: 'chalet', issuer: 'Booking.com', classification: 'accepted' });
  assert.deepEqual(result.primaryTotal, { amount: 1475.76, currency: 'CAD', label: 'total-price' });
  assert.doesNotMatch(JSON.stringify(result), /Fictional|Retreat|ZZ-000|800|120/);
});

test('recognizes the separated total-room-price Booking layout deterministically', async () => {
  const { recognizeBookingReservation } = await recognizer();
  const parts = [
    'Booking.com Reservation Details Accommodation: Chalet Reservation Number: BK-1475 ',
    'Check-in: Aug 14 2026 Check-out: Aug 18 2026 4 nights 1 room ',
    'Total room price\n—\nCAD\n1,475.76 ',
    'Booking.com facilitated guest payment Commissionable amount CAD 1200.00 Estimated commission CAD 150.00',
  ];
  const result = recognizeBookingReservation(input(parts)).result;
  assert.deepEqual(result.primaryTotal, { amount: 1475.76, currency: 'CAD', label: 'total-room-price' });
});

test('fails closed for crossing stays, brand-only pages, vendor confirmations, and conflicting branches', async () => {
  const { recognizeBookingReservation } = await recognizer();
  const base = ['Booking.com Reservation Details Accommodation: Other Place Reservation Number: ZZ-1 Check-in: Sep 30 2026 Check-out: Oct 2 2026 2 nights Total CAD 200.00 Booking.com facilitated guest payment Commissionable amount CAD 180.00 Estimated commission CAD 20.00'];
  const crossing = recognizeBookingReservation(input(base)).result;
  assert.equal(crossing.classification, 'uncertain');
  assert.equal(crossing.branchId, 'different-branch');
  assert.equal(recognizeBookingReservation(input(['Booking.com Reservation Details'])).result.classification, 'uncertain');
  assert.equal(recognizeBookingReservation(input(['Booking.com Reservation Details Reservation Number ZZ-2 Check-in Aug 1 2026 Check-out Aug 2 2026 1 night Total CAD 100.00 Vendor amount due'])).result.classification, 'uncertain');
});

test('recognizes total without separator (unlabeled-space-only) for plain-space total', async () => {
  const { recognizeBookingReservation } = await recognizer();
  const parts = [
    'Booking.com Reservation Details Accommodation: Chalet Reservation Number: BK-1475 ',
    'Check-in: Aug 14 2026 Check-out: Aug 18 2026 4 nights 1 room ',
    'Total price CAD 1,475.76 ',
    'Booking.com facilitated guest payment Commissionable amount CAD 1200.00 Estimated commission CAD 150.00',
  ];
  const result = recognizeBookingReservation(input(parts)).result;
  assert.deepEqual(result.primaryTotal, { amount: 1475.76, currency: 'CAD', label: 'total-price' });
});

test('reads a complete ungrouped amount and rejects partial malformed totals', async () => {
  const { recognizeBookingReservation } = await recognizer();
  const prefix = 'Booking.com Reservation Details Accommodation: Chalet Reservation Number: BK-1475 '
    + 'Check-in: Aug 14 2026 Check-out: Aug 18 2026 4 nights 1 room '
    + 'Booking.com facilitated guest payment Commissionable amount CAD 1200.00 ';
  assert.deepEqual(recognizeBookingReservation(input([prefix, 'Total room price CAD 1475.76'])).result.primaryTotal,
    { amount: 1475.76, currency: 'CAD', label: 'total-room-price' });
  assert.equal(recognizeBookingReservation(input([prefix, 'Total room price CAD 1475.7'])).result.primaryTotal, undefined);
  assert.equal(recognizeBookingReservation(input([prefix, 'Total room price CAD 1,47'])).result.primaryTotal, undefined);
});
