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
import { PayrollTaxSourceRecognition } from '../recognizers/payroll-tax-source-recognition.mjs';

const sha256 = 'a'.repeat(64);
const extraction = {
  schemaVersion: 2, recordType: 'payroll-tax-document', recordId: `sha256:${sha256}`,
  adapter: { id: 'canadian-payroll-tax', version: 2 },
  source: { sha256, mediaType: 'application/pdf', textSource: 'provided-pdf-text' },
  documentRole: 'submission-confirmation', jurisdiction: 'ca-qc', currency: 'CAD',
  operationalPeriod: { year: '2031', quarter: 'q4' },
  reportingPeriod: { start: '2031-07-01', end: '2031-09-30' },
  dates: { submissionDate: '2031-10-04', scheduledExecutionDate: '2031-10-12' },
  amounts: { components: {}, arithmetic: { total: 2369.24, computedTotal: 2369.24, matches: true } },
  completeness: { physicalPageCount: 1, expectedPageCount: 1, complete: true, warnings: [] },
  processing: { state: 'processing-pending', reviewRequired: true },
  ocrVerificationRequired: [], unresolvedCriticalFields: [],
  obligationLifecycle: { state: 'scheduled', providerStatus: 'to-be-processed', settlement: 'pending' },
  relations: [{ type: 'confirms-submission-of', targetRef: 'tax-obligation:ca-qc:2031-09-30' }],
  confirmationReferencePresent: true,
  provenance: Object.fromEntries(['documentRole', 'jurisdiction', 'reportingPeriod.start', 'reportingPeriod.end',
    'dates.submissionDate', 'dates.scheduledExecutionDate', 'amounts.arithmetic.total',
    'obligationLifecycle.providerStatus', 'confirmationReferencePresent'].map((field) =>
    [field, { source: 'labelled-embedded-text', confidence: 'exact' }])),
};
extraction.provenance['obligationLifecycle.state'] = { source: 'derived-rule', confidence: 'exact' };
extraction.provenance['obligationLifecycle.settlement'] = { source: 'derived-rule', confidence: 'exact' };
const proposal = {
  schemaVersion: 1, operation: 'prepare-tax-from-source', status: 'prepared', reviewEligible: true, applyEligible: true,
  proposedDestination: '2031/example-branch/q4/out/taxes/payroll-remittances/ca-qc/2031-09-30',
  proposedFilename: '2031-10-04_ca-qc_payroll-remittance-submission-confirmation.pdf',
  proposedSidecarFilename: '2031-10-04_ca-qc_payroll-remittance-submission-confirmation.pdf.json', extraction,
};
proposal.proposalRevision = taxProposalRevision(proposal);
const review = buildTaxReviewArtifact(proposal);
const originalBind = Function.prototype.bind;
let revisionDuringGlobalMutation;
try {
  Function.prototype.bind = () => () => 'prototype-mutation';
  revisionDuringGlobalMutation = taxProposalRevision(proposal);
} finally {
  Function.prototype.bind = originalBind;
}
assert.equal(revisionDuringGlobalMutation, proposal.proposalRevision,
  'captured contract wrappers must ignore later global binding mutation');
assert.equal(review.proposalRevision, proposal.proposalRevision);
assert.equal(reviewMatchesPrepared(review, proposal, proposal.proposalRevision), true);
assert.equal(reviewMatchesPrepared(review, { ...proposal, proposedDestination: proposal.proposedDestination.replace('/q4/', '/q3/') },
  proposal.proposalRevision), false);
const normalized = normalizedTaxExtraction(extraction, review);
assert.equal(normalized.processing.state, 'normalized');
assert.equal(normalized.obligationLifecycle.settlement, 'pending');
assert.equal(reconcileTaxExtraction({ extraction: normalized, pdfSha256: sha256,
  pdfFilename: proposal.proposedFilename }).status, 'normalized');
const changedTotal = structuredClone(normalized);
changedTotal.amounts.arithmetic.total += 0.01;
assert.equal(reconcileTaxExtraction({ extraction: changedTotal, pdfSha256: sha256,
  pdfFilename: proposal.proposedFilename }).status, 'review-required');
const changedProvenance = structuredClone(normalized);
changedProvenance.provenance['amounts.arithmetic.total'] = { source: 'ocr-text', confidence: 'candidate' };
assert.equal(reconcileTaxExtraction({ extraction: changedProvenance, pdfSha256: sha256,
  pdfFilename: proposal.proposedFilename }).status, 'review-required');
assert.equal(reconcileTaxExtraction({ extraction: normalized, pdfSha256: 'b'.repeat(64),
  pdfFilename: proposal.proposedFilename }).status, 'review-required');
assert.equal(buildTaxReviewArtifact({ ...proposal, reviewEligible: false }), undefined);

const ocrProposal = structuredClone(proposal);
ocrProposal.applyEligible = false;
ocrProposal.extraction.ocrVerificationRequired = ['dates.submissionDate', 'amounts.arithmetic.total'];
ocrProposal.extraction.provenance['dates.submissionDate'] = { source: 'ocr-text', confidence: 'candidate' };
ocrProposal.extraction.provenance['amounts.arithmetic.total'] = {
  source: 'ocr-layout', confidence: 0.88, page: 1, bbox: { x: 0.2, y: 0.3, width: 0.1, height: 0.02 },
};
ocrProposal.proposalRevision = taxProposalRevision(ocrProposal);
assert.equal(buildTaxReviewArtifact(ocrProposal), undefined);
assert.equal(buildTaxReviewArtifact(ocrProposal, ['dates.submissionDate']), undefined);
const ocrReview = buildTaxReviewArtifact(ocrProposal,
  ['amounts.arithmetic.total', 'dates.submissionDate']);
assert.deepEqual(ocrReview.ocrVerification.requiredFields,
  ['amounts.arithmetic.total', 'dates.submissionDate']);
assert.equal(reviewMatchesPrepared(ocrReview, ocrProposal, ocrProposal.proposalRevision), true);
const normalizedOcr = normalizedTaxExtraction(ocrProposal.extraction, ocrReview);
assert.equal(reconcileTaxExtraction({ extraction: normalizedOcr, pdfSha256: sha256,
  pdfFilename: proposal.proposedFilename }).status, 'normalized');
const invalidOcrBounds = structuredClone(normalizedOcr);
invalidOcrBounds.provenance['amounts.arithmetic.total'].bbox.width = 1.01;
assert.equal(reconcileTaxExtraction({ extraction: invalidOcrBounds, pdfSha256: sha256,
  pdfFilename: proposal.proposedFilename }).status, 'review-required');
const invalidOcrPage = structuredClone(normalizedOcr);
invalidOcrPage.provenance['amounts.arithmetic.total'].page = 2;
assert.equal(reconcileTaxExtraction({ extraction: invalidOcrPage, pdfSha256: sha256,
  pdfFilename: proposal.proposedFilename }).status, 'review-required');
const unresolvedOcr = structuredClone(normalizedOcr);
unresolvedOcr.unresolvedCriticalFields = ['dates.scheduledExecutionDate'];
assert.equal(reconcileTaxExtraction({ extraction: unresolvedOcr, pdfSha256: sha256,
  pdfFilename: proposal.proposedFilename }).status, 'review-required');
normalizedOcr.normalization.ocrVerification.requiredFields = ['dates.submissionDate'];
assert.equal(reconcileTaxExtraction({ extraction: normalizedOcr, pdfSha256: sha256,
  pdfFilename: proposal.proposedFilename }).status, 'review-required');

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
assert.deepEqual(reconcileTaxExtraction({ extraction: { schemaVersion: 1,
  adapter: { id: 'canadian-payroll-tax', version: 1 } }, pdfSha256: sha256, pdfFilename: 'legacy.pdf' }),
{ status: 'review-required', reason: 'legacy-renormalization-required' });
assert.deepEqual(reconcileTaxExtraction({ extraction: { schemaVersion: 2 },
  pdfSha256: sha256, pdfFilename: 'partial.pdf' }),
{ status: 'review-required', reason: 'invalid-sidecar' });

const federalRecognizer = new PayrollTaxSourceRecognition();
const federalPrepared = federalRecognizer.evaluate({
  normalizedText: 'Canada Revenue Agency PD7A payroll deductions Remittance period end: 2031-06-30 '
    + 'Due date: 2031-07-15 Gross payroll: 18,765.43 Number of employees: 9 '
    + 'Amount payable: 1,876.54 Page 1 of 1',
  compactText: 'canadarevenueagencypd7apayrolldeductionsremittanceperiodend20310630page1of1',
  pageCount: 1, textSource: 'embedded-pdf-text',
}, { branchId: 'example-branch', year: '2031', quarter: 'q3', section: 'out', sourceSha256: sha256 });
assert.equal(federalPrepared.status, 'prepared');
assert.equal(federalPrepared.extraction.provenance['dates.dueDate'].source, 'labelled-embedded-text');
const federalProposal = { schemaVersion: 1, operation: 'prepare-tax-from-source', ...federalPrepared };
federalProposal.proposalRevision = taxProposalRevision(federalProposal);
const federalReview = buildTaxReviewArtifact(federalProposal);
assert.ok(federalReview);
const normalizedFederal = normalizedTaxExtraction(federalProposal.extraction, federalReview);
assert.equal(reconcileTaxExtraction({ extraction: normalizedFederal, pdfSha256: sha256,
  pdfFilename: federalProposal.proposedFilename }).status, 'normalized');

const qcOcrText = 'TPZ-1015 Revenu Québec Période visée 2031-04-01 au 2031-06-30 '
  + 'Date limite 2031-07-15 A Impôt B RRQ C FSS D RQAP F CNESST Total à remettre';
const qcOcrTokens = [
  ['135791', 0.54, 0.76], ['24680', 0.54, 0.80], ['12345', 0.55, 0.83],
  ['10101', 0.69, 0.76], ['000', 0.896, 0.803], ['182917', 0.86, 0.76],
].map(([value, x, y]) => ({ value, page: 1, source: 'ocr-layout', confidence: 0.91,
  bbox: { x, y, width: 0.06, height: 0.02 } }));
const qcOcrPrepared = federalRecognizer.evaluate({ normalizedText: qcOcrText,
  compactText: qcOcrText.toLowerCase().replace(/[^a-z0-9]/g, ''), pageCount: 1,
  textSource: 'embedded-pdf-text+local-ocr', layoutTokens: qcOcrTokens,
  evidenceChannels: { embeddedText: qcOcrText, ocrText: '' },
}, { branchId: 'example-branch', year: '2031', quarter: 'q3', section: 'out', sourceSha256: sha256 });
assert.equal(qcOcrPrepared.status, 'prepared');
assert.equal(qcOcrPrepared.applyEligible, false);
const qcOcrProposal = { schemaVersion: 1, operation: 'prepare-tax-from-source', ...qcOcrPrepared };
qcOcrProposal.proposalRevision = taxProposalRevision(qcOcrProposal);
const qcOcrReview = buildTaxReviewArtifact(qcOcrProposal,
  qcOcrProposal.extraction.ocrVerificationRequired);
assert.ok(qcOcrReview);
const normalizedQcOcr = normalizedTaxExtraction(qcOcrProposal.extraction, qcOcrReview);
assert.equal(reconcileTaxExtraction({ extraction: normalizedQcOcr, pdfSha256: sha256,
  pdfFilename: qcOcrProposal.proposedFilename }).status, 'normalized');
console.log('tax-normalization contract: PASS');
