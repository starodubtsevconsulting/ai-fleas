/**
 * Run: node ai-commands/data/financial-records/tax-normalization/tax-normalization-contract.test.mjs
 * Passing verifies proposal revision binding, reviewed normalization state, confirmation lifecycle, and reconciliation
 * for sanitized objects. It does not publish files, authorize payment, or establish settlement.
 */
import assert from 'node:assert/strict';
import {
  buildTaxReviewArtifact, normalizedTaxExtraction, reconcileTaxExtraction,
  reviewMatchesPrepared, taxProposalRevision,
} from './tax-normalization-contract.mjs';

const sha256 = 'a'.repeat(64);
const extraction = {
  schemaVersion: 1, recordType: 'payroll-tax-document', recordId: `sha256:${sha256}`,
  adapter: { id: 'canadian-payroll-tax', version: 1 },
  source: { sha256, mediaType: 'application/pdf', textSource: 'provided-pdf-text' },
  documentRole: 'submission-confirmation', jurisdiction: 'ca-qc', currency: 'CAD',
  operationalPeriod: { year: '2031', quarter: 'q4' },
  reportingPeriod: { start: '2031-07-01', end: '2031-09-30' },
  dates: { submissionDate: '2031-10-04', scheduledExecutionDate: '2031-10-12' },
  amounts: { components: {}, arithmetic: { total: 2369.24, computedTotal: 2369.24, matches: true } },
  completeness: { physicalPageCount: 1, expectedPageCount: 1, complete: true, warnings: [] },
  processing: { state: 'processing-pending', reviewRequired: true },
  obligationLifecycle: { state: 'scheduled', providerStatus: 'to-be-processed', settlement: 'pending' },
  relations: [{ type: 'confirms-submission-of', targetRef: 'tax-obligation:ca-qc:2031-09-30' }],
  provenance: { 'amounts.arithmetic.total': {
    source: 'source-pdf-visible-content', location: 'labelled-field-or-bounded-form-layout', confidence: 'exact',
  } },
};
const proposal = {
  schemaVersion: 1, operation: 'prepare-tax-from-source', status: 'prepared', applyEligible: true,
  proposedDestination: '2031/example-branch/q4/out/taxes/payroll-remittances/ca-qc/2031-09-30',
  proposedFilename: '2031-10-04_ca-qc_payroll-remittance-submission-confirmation.pdf',
  proposedSidecarFilename: '2031-10-04_ca-qc_payroll-remittance-submission-confirmation.pdf.json', extraction,
};
proposal.proposalRevision = taxProposalRevision(proposal);
const review = buildTaxReviewArtifact(proposal);
assert.equal(review.proposalRevision, proposal.proposalRevision);
assert.equal(reviewMatchesPrepared(review, proposal, proposal.proposalRevision), true);
assert.equal(reviewMatchesPrepared(review, { ...proposal, proposedDestination: proposal.proposedDestination.replace('/q4/', '/q3/') },
  proposal.proposalRevision), false);
const normalized = normalizedTaxExtraction(extraction, review);
assert.equal(normalized.processing.state, 'normalized');
assert.equal(normalized.obligationLifecycle.settlement, 'pending');
assert.equal(reconcileTaxExtraction({ extraction: normalized, pdfSha256: sha256,
  pdfFilename: proposal.proposedFilename }).status, 'normalized');
assert.equal(reconcileTaxExtraction({ extraction: normalized, pdfSha256: 'b'.repeat(64),
  pdfFilename: proposal.proposedFilename }).status, 'review-required');
assert.equal(buildTaxReviewArtifact({ ...proposal, applyEligible: false }), undefined);

const optionalConfirmation = structuredClone(proposal);
optionalConfirmation.extraction.reportingPeriod.start = undefined;
optionalConfirmation.extraction.dates.dueDate = undefined;
const beforePersistence = taxProposalRevision(optionalConfirmation);
const persistedConfirmation = JSON.parse(JSON.stringify(optionalConfirmation));
assert.equal(taxProposalRevision(persistedConfirmation), beforePersistence,
  'proposal revision must survive JSON omission of undefined optional fields');
persistedConfirmation.proposalRevision = beforePersistence;
const persistedReview = buildTaxReviewArtifact(persistedConfirmation);
assert.equal(persistedReview?.proposalRevision, beforePersistence);
assert.equal(reviewMatchesPrepared(persistedReview, persistedConfirmation, beforePersistence), true);
console.log('tax-normalization contract: PASS');
