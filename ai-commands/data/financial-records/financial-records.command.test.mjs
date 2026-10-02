/**
 * Run: node ai-commands/data/financial-records/financial-records.command.test.mjs
 * Passing verifies command validation, bounded preparation, and guarded synthetic Booking publication wiring.
 * It does not authorize or exercise live financial-record publication, tax submission, or settlement.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FinancialRecordsCommand } from './financial-records.command.mjs';
import { taxProposalRevision } from './tax-normalization/tax-normalization-contract.mjs';

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

const taxCommand = new FinancialRecordsCommand();
taxCommand.pdfReader = { async read(_source, readPlan) {
  assert.equal(readPlan?.id, 'payroll-tax');
  const normalizedText = [
    'Revenu Quebec payroll source deductions', 'Reporting period start: 2031-07-01',
    'Reporting period end: 2031-09-30', 'Due date: 2031-10-18', 'Income tax: 1,234.56',
    'QPP: 789.01', 'Health Services Fund: 234.56', 'QPIP: 111.11', 'CNESST: 0.00',
    'Total remittance: 2,369.24', 'Page 1 of 1',
  ].join(' ');
  return { pageCount: 1, normalizedText, compactText: normalizedText.toLowerCase().replace(/[^a-z0-9]/g, '') };
} };
const taxArgs = (overrides = {}) => [
  'prepare-tax-from-source', '--root', root, '--source', path.join(root, 'booking-in.pdf'),
  '--branch', overrides.branch || 'example-branch', '--year', overrides.year || '2031',
  '--quarter', overrides.quarter || 'q4', '--section', overrides.section || 'out',
];
const taxPreview = await taxCommand.run(taxArgs());
assert.equal(taxPreview.operation, 'prepare-tax-from-source');
assert.equal(taxPreview.status, 'prepared');
assert.equal(taxPreview.proposedFilename, '2031-09-30_ca-qc_payroll-remittance-obligation.pdf');
assert.match(taxPreview.extraction.source.sha256, /^[a-f0-9]{64}$/);
assert.equal(taxPreview.extraction.adapter.id, 'canadian-payroll-tax');
assert.equal(taxPreview.applyEligible, true);
assert.doesNotMatch(JSON.stringify(taxPreview), /test-fixtures|booking-in|raw text/i);
assert.equal((await taxCommand.run(taxArgs({ quarter: 'q2' }))).reason, 'wrong-reporting-period');
await assert.rejects(taxCommand.run(taxArgs({ section: 'in' })), /INVALID_EXPECTATION/);
console.log('financial-records prepare-tax-from-source: PASS');

const taxProposalPath = path.join(root, 'tax-proposal.runtime.json');
const taxReviewPath = path.join(root, 'tax-review.runtime.json');
const taxDestination = path.join(root, taxPreview.proposedDestination);
const taxPdfPath = path.join(taxDestination, taxPreview.proposedFilename);
const taxSidecarPath = `${taxPdfPath}.json`;
const taxRuntimeFiles = [taxProposalPath, taxReviewPath, taxSidecarPath, taxPdfPath];
const taxOcrProposalPath = path.join(root, 'tax-ocr-proposal.runtime.json');
taxRuntimeFiles.push(taxOcrProposalPath);
try {
  fs.writeFileSync(taxProposalPath, `${JSON.stringify(taxPreview)}\n`, { flag: 'wx' });
  const taxReview = await taxCommand.run([
    'review-tax-proposal', '--root', root, '--proposal', taxProposalPath,
  ]);
  assert.equal(taxReview.reviewState, 'reviewed');
  assert.equal(taxReview.proposalRevision, taxPreview.proposalRevision);
  fs.writeFileSync(taxReviewPath, `${JSON.stringify(taxReview)}\n`, { flag: 'wx' });
  const ocrProposal = structuredClone(taxPreview);
  ocrProposal.applyEligible = false;
  ocrProposal.extraction.ocrVerificationRequired = ['amounts.arithmetic.total'];
  ocrProposal.extraction.provenance['amounts.arithmetic.total'] = {
    source: 'ocr-layout', confidence: 0.91, bbox: { x: 0.2, y: 0.3, width: 0.1, height: 0.02 },
  };
  ocrProposal.proposalRevision = taxProposalRevision(ocrProposal);
  fs.writeFileSync(taxOcrProposalPath, `${JSON.stringify(ocrProposal)}\n`, { flag: 'wx' });
  await assert.rejects(taxCommand.run([
    'review-tax-proposal', '--root', root, '--proposal', taxOcrProposalPath,
  ]), /OCR_VERIFICATION_REQUIRED/);
  await assert.rejects(taxCommand.run([
    'review-tax-proposal', '--root', root, '--proposal', taxOcrProposalPath,
    '--verify-ocr-fields', 'dates.dueDate',
  ]), /INVALID_PROPOSAL/);
  const ocrReview = await taxCommand.run([
    'review-tax-proposal', '--root', root, '--proposal', taxOcrProposalPath,
    '--verify-ocr-fields', 'amounts.arithmetic.total',
  ]);
  assert.deepEqual(ocrReview.ocrVerification,
    { requiredFields: ['amounts.arithmetic.total'], attested: true });
  await assert.rejects(taxCommand.run([
    'apply-tax-from-source', '--root', root, '--source', path.join(root, 'booking-in.pdf'),
    '--destination', taxDestination, '--review', taxReviewPath, '--branch', 'example-branch',
    '--year', '2031', '--quarter', 'q3', '--section', 'out',
    '--expected-proposal-revision', taxPreview.proposalRevision,
  ]), /CLOSED_PERIOD/);
  const taxApplied = await taxCommand.run([
    'apply-tax-from-source', '--root', root, '--source', path.join(root, 'booking-in.pdf'),
    '--destination', taxDestination, '--review', taxReviewPath, '--branch', 'example-branch',
    '--year', '2031', '--quarter', 'q4', '--section', 'out',
    '--expected-proposal-revision', taxPreview.proposalRevision,
  ]);
  assert.equal(taxApplied.status, 'applied');
  assert.equal(fs.existsSync(path.join(root, 'booking-in.pdf')), true, 'source must be preserved');
  const normalizedTax = JSON.parse(fs.readFileSync(taxSidecarPath, 'utf8'));
  assert.equal(normalizedTax.processing.state, 'normalized');
  assert.equal(normalizedTax.obligationLifecycle.state, 'obligation-recorded');
  const reconciledTax = await taxCommand.run([
    'reconcile-tax-record', '--root', root, '--pdf', taxPdfPath, '--sidecar', taxSidecarPath,
    '--branch', 'example-branch', '--year', '2031', '--quarter', 'q4', '--section', 'out',
  ]);
  assert.equal(reconciledTax.status, 'normalized');
  console.log('financial-records tax review/apply/reconcile: PASS');
} finally {
  for (const file of taxRuntimeFiles) if (fs.existsSync(file)) fs.unlinkSync(file);
}

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

const reportsRoot = path.join(root, 'reports-root');
const separateDestination = path.join(reportsRoot, '2026', 'chalet', 'q3', 'in');
const separateCommand = new FinancialRecordsCommand();
let separatePublication;
separateCommand.publisher = { publish(input) {
  separatePublication = input;
  return { status: 'applied', sha256: sourcePreview.sourceEvidence.sha256, stagingCleanupRequired: false };
} };
const separateArgs = [
  '--source-root', root, '--reports-root', reportsRoot,
  '--source', path.join(root, 'booking-in.pdf'), '--destination', separateDestination,
  '--branch', 'chalet', '--year', '2026', '--quarter', 'q3', '--section', 'in',
  '--expected-sha256', sourcePreview.sourceEvidence.sha256,
  '--expected-filename', sourcePreview.proposedFilename,
];
const separatePrepared = await separateCommand.run(['prepare-from-source',
  '--source-root', root, '--reports-root', reportsRoot, '--source', path.join(root, 'booking-in.pdf'),
  '--branch', 'chalet', '--year', '2026', '--quarter', 'q3', '--section', 'in',
]);
assert.equal(separatePrepared.status, 'eligible');
assert.equal((await separateCommand.run(['apply-from-source', ...separateArgs])).status, 'applied');
assert.equal(separatePublication.pdfPath, path.join(separateDestination, sourcePreview.proposedFilename));
await assert.rejects(separateCommand.run(['apply-from-source', ...separateArgs,
  '--root', root]), /USAGE/);
await assert.rejects(separateCommand.run(['apply-from-source', ...separateArgs.slice(2)]), /USAGE/);
await assert.rejects(separateCommand.run(['apply-from-source', ...separateArgs.map((value) =>
  value === separateDestination ? destination : value)]), /DESTINATION_OUTSIDE_ROOT/);
await assert.rejects(separateCommand.run(['apply-from-source', ...separateArgs.map((value) =>
  value === root ? path.join(root, '2026', 'chalet', 'q3', 'in') : value)]), /SOURCE_OUTSIDE_ROOT/);
await assert.rejects(separateCommand.run(['apply-from-source', ...separateArgs.map((value) =>
  value === reportsRoot ? path.join(root, 'booking-in.pdf') : value)]), /INVALID_ROOT_NOT_DIRECTORY/);
await assert.rejects(separateCommand.run(['apply-from-source', ...separateArgs.map((value) =>
  value === sourcePreview.sourceEvidence.sha256 ? '0'.repeat(64) : value)]), /PREVIEW_MISMATCH/);

const sourceLink = path.join(destination, 'linked-booking-in.pdf');
assert.equal(fs.existsSync(sourceLink), false);
fs.symlinkSync(path.join(root, 'booking-in.pdf'), sourceLink);
const sourceLinkStat = fs.lstatSync(sourceLink);
try {
  await assert.rejects(separateCommand.run(['prepare-from-source',
    '--source-root', destination, '--reports-root', reportsRoot, '--source', sourceLink,
    '--branch', 'chalet', '--year', '2026', '--quarter', 'q3', '--section', 'in',
  ]), /SOURCE_OUTSIDE_ROOT/);
} finally {
  const current = fs.lstatSync(sourceLink);
  assert.equal(current.dev, sourceLinkStat.dev);
  assert.equal(current.ino, sourceLinkStat.ino);
  assert.equal(fs.readlinkSync(sourceLink), path.join(root, 'booking-in.pdf'));
  fs.unlinkSync(sourceLink);
}
console.log('financial-records separate roots and escapes: PASS');

const realCommand = new FinancialRecordsCommand();
const source = path.join(root, 'booking-in.pdf');
const pdfPath = path.join(destination, sourcePreview.proposedFilename);
const sidecarPath = `${pdfPath}.json`;
const fingerprint = (file) => {
  const stat = fs.lstatSync(file);
  return { dev: stat.dev, ino: stat.ino, sha256: createHash('sha256').update(fs.readFileSync(file)).digest('hex') };
};
assert.equal(fs.existsSync(pdfPath), false, 'synthetic PDF target must start absent');
assert.equal(fs.existsSync(sidecarPath), false, 'synthetic sidecar target must start absent');
const created = new Map();
try {
  const realApply = () => realCommand.run([
    'apply-from-source', '--root', root, '--source', source,
    '--destination', destination, '--branch', 'chalet', '--year', '2026',
    '--quarter', 'q3', '--section', 'in',
    '--expected-sha256', sourcePreview.sourceEvidence.sha256,
    '--expected-filename', sourcePreview.proposedFilename,
  ]);
  const result = await realApply();
  for (const file of [pdfPath, sidecarPath]) created.set(file, fingerprint(file));
  assert.equal(result.status, 'applied');
  assert.equal(result.stagingCleanupRequired, false);
  assert.deepEqual(fs.readFileSync(pdfPath), fs.readFileSync(source));
  assert.deepEqual(JSON.parse(fs.readFileSync(sidecarPath, 'utf8')), sourcePreview.extraction);
  await assert.rejects(realApply(), /PUBLICATION_COLLISION/);
  for (const [file, original] of created) assert.deepEqual(fingerprint(file), original);
  console.log('financial-records apply-from-source real publisher: PASS');
} finally {
  for (const file of [sidecarPath, pdfPath]) {
    const original = created.get(file);
    if (!original) continue;
    assert.deepEqual(fingerprint(file), original, `refusing to remove changed fixture output: ${file}`);
    fs.unlinkSync(file);
  }
}
