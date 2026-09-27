import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FinancialRecordsCommand } from './financial-records.command.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), 'test-fixtures');
const command = new FinancialRecordsCommand();
const run = (name, selectedRoot = root) => command.run([
  'prepare-review', '--root', selectedRoot, '--recognition', path.join(root, name),
]);

const preview = await run('eligible-booking-in.json');
assert.equal(preview.operation, 'prepare-review');
assert.equal(preview.proposedFilename, '2026-08-07_booking_marketplace-reservation.pdf');
assert.equal(preview.extraction.totals.primary.amount, 123.45);
assert.equal(preview.extraction.section, 'in');
assert.doesNotMatch(JSON.stringify(preview), /test-fixtures|raw text|guest/i);
assert.ok(Buffer.byteLength(JSON.stringify(preview)) < 16 * 1024);
await assert.rejects(run('unsupported-out.json'), /REVIEW_REQUIRED/);
await assert.rejects(run('invalid.json'), /INVALID_RECOGNITION/);
await assert.rejects(run('eligible-booking-in.json', path.join(path.dirname(root), 'extraction')), /RECOGNITION_OUTSIDE_ROOT/);
console.log('financial-records prepare-review: PASS');
