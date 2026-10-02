/**
 * Purpose: bind reviewed payroll-tax preparation proposals to guarded normalization and reconciliation.
 * Caller: financial-records.command.mjs tax review/apply/reconcile operations and focused tests.
 * Input/output: bounded prepare/review/sidecar objects and source hashes; returns immutable review artifacts,
 * normalized sidecars, or reconciliation verdicts.
 * Effects: pure validation and transformation only; filesystem publication remains owned by ReviewPublisher.
 */
import { createHash } from 'node:crypto';

const ADAPTER_ID = 'canadian-payroll-tax';
const ADAPTER_VERSION = 1;

export function taxProposalRevision(proposal) {
  const bounded = proposalCore(proposal);
  // Proposal files are the review boundary. Canonicalize with JSON persistence semantics first so optional
  // undefined-valued object fields (which JSON omits) cannot change the revision after save/read round trips.
  const persisted = JSON.parse(JSON.stringify(bounded));
  return createHash('sha256').update(stableJson(persisted)).digest('hex');
}

export function buildTaxReviewArtifact(proposal) {
  if (!validPreparedProposal(proposal)) return undefined;
  const proposalRevision = taxProposalRevision(proposal);
  return {
    schemaVersion: 1,
    artifactType: 'payroll-tax-normalization-review',
    reviewState: 'reviewed',
    proposalRevision,
    sourceSha256: proposal.extraction.source.sha256,
    adapter: { id: ADAPTER_ID, version: ADAPTER_VERSION },
    extractionSchemaVersion: proposal.extraction.schemaVersion,
    proposedDestination: proposal.proposedDestination,
    proposedFilename: proposal.proposedFilename,
    proposedSidecarFilename: proposal.proposedSidecarFilename,
  };
}

export function reviewMatchesPrepared(review, proposal, expectedRevision) {
  if (!review || review.schemaVersion !== 1 || review.artifactType !== 'payroll-tax-normalization-review'
    || review.reviewState !== 'reviewed' || review.adapter?.id !== ADAPTER_ID
    || review.adapter?.version !== ADAPTER_VERSION || review.extractionSchemaVersion !== 1
    || !/^[a-f0-9]{64}$/.test(String(review.sourceSha256 || ''))
    || !/^[a-f0-9]{64}$/.test(String(review.proposalRevision || ''))) return false;
  const revision = taxProposalRevision(proposal);
  return proposal.applyEligible === true && proposal.status === 'prepared'
    && expectedRevision === revision && review.proposalRevision === revision
    && review.sourceSha256 === proposal.extraction.source.sha256
    && review.proposedDestination === proposal.proposedDestination
    && review.proposedFilename === proposal.proposedFilename
    && review.proposedSidecarFilename === proposal.proposedSidecarFilename;
}

export function normalizedTaxExtraction(extraction, review) {
  if (!extraction || review?.reviewState !== 'reviewed') return undefined;
  return {
    ...structuredClone(extraction),
    processing: { state: 'normalized', reviewRequired: false },
    normalization: {
      schemaVersion: 1,
      proposalRevision: review.proposalRevision,
      reviewed: true,
    },
  };
}

export function reconcileTaxExtraction({ extraction, pdfSha256, pdfFilename }) {
  if (!extraction || extraction.schemaVersion !== 1 || extraction.recordType !== 'payroll-tax-document'
    || extraction.adapter?.id !== ADAPTER_ID || extraction.adapter?.version !== ADAPTER_VERSION
    || extraction.source?.sha256 !== pdfSha256 || extraction.source?.mediaType !== 'application/pdf'
    || extraction.processing?.state !== 'normalized' || extraction.processing?.reviewRequired !== false
    || extraction.normalization?.schemaVersion !== 1 || extraction.normalization?.reviewed !== true
    || !/^[a-f0-9]{64}$/.test(String(extraction.normalization?.proposalRevision || ''))
    || !validProvenance(extraction.provenance)) return { status: 'review-required', reason: 'invalid-sidecar' };
  const expected = canonicalFilename(extraction);
  if (!expected || expected !== pdfFilename) return { status: 'review-required', reason: 'filename-mismatch' };
  if (extraction.documentRole === 'submission-confirmation') {
    const relation = extraction.relations?.find((item) => item?.type === 'confirms-submission-of');
    if (!relation?.targetRef || extraction.obligationLifecycle?.settlement !== 'pending') {
      return { status: 'review-required', reason: 'invalid-confirmation-lifecycle' };
    }
  }
  if (extraction.completeness?.complete !== true) return { status: 'incomplete', reason: 'incomplete-pages' };
  return { status: 'normalized', documentRole: extraction.documentRole, jurisdiction: extraction.jurisdiction };
}

function validPreparedProposal(proposal) {
  return proposal?.schemaVersion === 1 && proposal.operation === 'prepare-tax-from-source'
    && proposal.status === 'prepared' && proposal.applyEligible === true
    && proposal.extraction?.schemaVersion === 1 && proposal.extraction?.adapter?.id === ADAPTER_ID
    && proposal.extraction?.adapter?.version === ADAPTER_VERSION
    && proposal.extraction?.completeness?.complete === true
    && proposal.extraction?.processing?.state === 'processing-pending'
    && /^[a-f0-9]{64}$/.test(String(proposal.extraction?.source?.sha256 || ''))
    && typeof proposal.proposedDestination === 'string' && typeof proposal.proposedFilename === 'string'
    && proposal.proposedSidecarFilename === `${proposal.proposedFilename}.json`;
}

function proposalCore(proposal) {
  return {
    schemaVersion: proposal?.schemaVersion,
    operation: proposal?.operation,
    status: proposal?.status,
    applyEligible: proposal?.applyEligible,
    proposedDestination: proposal?.proposedDestination,
    proposedFilename: proposal?.proposedFilename,
    proposedSidecarFilename: proposal?.proposedSidecarFilename,
    extraction: proposal?.extraction,
  };
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort()
    .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

function canonicalFilename(extraction) {
  const date = extraction.documentRole === 'submission-confirmation'
    ? extraction.dates?.submissionDate : extraction.reportingPeriod?.end;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ''))
    || !['ca-federal', 'ca-qc'].includes(extraction.jurisdiction)
    || !['obligation', 'submission-confirmation'].includes(extraction.documentRole)) return undefined;
  return `${date}_${extraction.jurisdiction}_payroll-remittance-${extraction.documentRole}.pdf`;
}

function validProvenance(provenance) {
  return provenance && typeof provenance === 'object' && Object.keys(provenance).length > 0
    && Object.values(provenance).every((item) => item?.source === 'source-pdf-visible-content'
      && item?.location === 'labelled-field-or-bounded-form-layout');
}
