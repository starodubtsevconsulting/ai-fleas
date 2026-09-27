import assert from 'node:assert/strict';
import { BookingSourceRecognition } from './booking-source-recognition.mjs';
import { buildPendingAccountingExtraction, validPendingAccountingExtraction } from '../extraction/pending-accounting-extraction.mjs';

const expected = { section: 'in', year: '2026', quarter: 'q3', branchId: 'chalet' };
const details = 'Booking.com Reservation Details Accommodation: Chalet Reservation Number: BK-1475 '
  + 'Check-in: Aug 14 2026 Check-out: Aug 18 2026 4 nights 1 room '
  + 'Booking.com facilitated guest payment Commissionable amount CAD 1200.00 Estimated commission CAD 150.00 ';
const pdf = (total) => {
  const normalizedText = `${details}${total}`;
  return { pageCount: 1, normalizedText, compactText: normalizedText.toLowerCase().replace(/[^a-z0-9]/g, '') };
};
const source = new BookingSourceRecognition();

const eligible = source.evaluate(pdf('Total room price — CAD 1,475.76'), expected);
assert.equal(eligible.status, 'eligible');
assert.deepEqual(eligible.primaryTotal, {
  amount: 1475.76, currency: 'CAD', label: 'total-room-price', provenance: 'visible-pdf-total',
});
assert.equal(validPendingAccountingExtraction(buildPendingAccountingExtraction(eligible)), true);
assert.doesNotMatch(JSON.stringify(eligible), /Reservation Number|BK-1475|Accommodation/i);
assert.equal(source.evaluate(pdf('Total room price — CAD 1,475.76'), { ...expected, branchId: 'other' }).reason, 'context-mismatch');
assert.equal(source.evaluate(pdf('Total room price — CAD 1,475.76'), { ...expected, year: '2025' }).reason, 'context-mismatch');
assert.equal(source.evaluate(pdf('Total room price — CAD 1,475.76'), { ...expected, quarter: 'q4' }).reason, 'context-mismatch');
assert.equal(source.evaluate(pdf('Total room price — CAD 1,475.76'), { ...expected, section: 'out' }).reason, 'invalid-context');
assert.equal(source.evaluate(pdf('Total amount pending CAD 1,475.76'), expected).reason, 'no-visible-labelled-total');
assert.equal(source.evaluate({ ...pdf('Total room price — CAD 1,475.76'), pageCount: 0 }, expected).reason, 'invalid-pdf-evidence');
console.log('Booking source recognition: PASS');
