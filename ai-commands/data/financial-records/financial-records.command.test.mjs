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

const fromSource = (name, overrides = {}, selectedRoot = root) => command.run([
  'prepare-from-source', '--root', selectedRoot, '--source', path.join(root, name),
  '--branch', overrides.branch || 'chalet', '--year', overrides.year || '2026',
  '--quarter', overrides.quarter || 'q3', '--section', overrides.section || 'in',
]);
const sourcePreview = await fromSource('booking-in.pdf');
assert.equal(sourcePreview.status, 'eligible');
assert.equal(sourcePreview.proposedFilename, '2026-08-14_booking_marketplace-reservation.pdf');
assert.equal(sourcePreview.extraction.totals.primary.amount, 1475.76);
assert.match(sourcePreview.sourceEvidence.sha256, /^[a-f0-9]{64}$/);
assert.equal(sourcePreview.sourceEvidence.provenance, 'visible-pdf-text-total');
assert.doesNotMatch(JSON.stringify(sourcePreview), /test-fixtures|Reservation Number|BK-1475/i);
assert.equal((await fromSource('booking-no-visible-total.pdf')).reason, 'no-visible-labelled-total');
assert.equal((await fromSource('booking-in.pdf', { branch: 'other' })).reason, 'context-mismatch');
assert.equal((await fromSource('booking-in.pdf', { year: '2025' })).reason, 'context-mismatch');
assert.equal((await fromSource('booking-in.pdf', { quarter: 'q4' })).reason, 'context-mismatch');
assert.equal((await fromSource('booking-in.pdf', { section: 'out' })).reason, 'invalid-context');
await assert.rejects(fromSource('booking-in.pdf', {}, path.join(path.dirname(root), 'extraction')), /SOURCE_OUTSIDE_ROOT/);
await assert.rejects(fromSource('invalid.json'), /INVALID_SOURCE_NOT_PDF/);
console.log('financial-records prepare-from-source: PASS');

const destination = path.join(root, '2026', 'chalet', 'q3', 'in');
let published;
command.publisher = { publish(input) {
  published = input;
  return { status: 'applied', sha256: sourcePreview.sourceEvidence.sha256, stagingCleanupRequired: false };
} };
const apply = (name = 'booking-in.pdf', overrides = {}) => command.run([
  'apply-from-source', '--root', root, '--source', path.join(root, name),
  '--destination', overrides.destination || destination, '--branch', overrides.branch || 'chalet',
  '--year', overrides.year || '2026', '--quarter', overrides.quarter || 'q3',
  '--section', overrides.section || 'in',
  '--expected-sha256', overrides.sha256 || sourcePreview.sourceEvidence.sha256,
  '--expected-filename', overrides.filename || sourcePreview.proposedFilename,
]);
const applied = await apply();
assert.equal(applied.status, 'applied');
assert.equal(applied.proposedFilename, sourcePreview.proposedFilename);
assert.equal(published.extraction.totals.primary.amount, 1475.76);
assert.equal(published.pdfPath, path.join(destination, sourcePreview.proposedFilename));
assert.equal(published.sidecarPath, `${published.pdfPath}.json`);
assert.match(published.sourceBytes.toString('ascii', 0, 4), /%PDF/);
published = undefined;
await assert.rejects(apply('booking-in.pdf', { sha256: '0'.repeat(64) }), /PREVIEW_MISMATCH/);
await assert.rejects(apply('booking-in.pdf', { filename: '2026-08-15_booking_marketplace-reservation.pdf' }), /PREVIEW_MISMATCH/);
await assert.rejects(apply('booking-in.pdf', { destination: path.join(path.dirname(root), 'extraction') }), /DESTINATION_OUTSIDE_ROOT/);
await assert.rejects(apply('booking-in.pdf', { year: '2025' }), /DESTINATION_OUTSIDE_ROOT/);
assert.equal((await apply('booking-no-visible-total.pdf')).reason, 'no-visible-labelled-total');
assert.equal(published, undefined);
command.publisher = { publish() { throw new Error('PUBLICATION_COLLISION'); } };
await assert.rejects(apply(), /PUBLICATION_COLLISION/);
console.log('financial-records apply-from-source wiring: PASS');
