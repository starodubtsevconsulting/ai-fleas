/**
 * Purpose: bind reviewed payroll-tax preparation proposals to guarded normalization and reconciliation.
 * Caller: financial-records.command.mjs tax review/apply/reconcile operations and focused tests.
 * Input/output: bounded prepare/review/sidecar objects and source hashes; returns immutable review artifacts,
 * normalized sidecars, or reconciliation verdicts.
 * Effects: pure validation and transformation only; filesystem publication remains owned by ReviewPublisher.
 */
import { createHash } from 'node:crypto';

const ADAPTER_ID = 'canadian-payroll-tax';
const ADAPTER_VERSION = 2;
const EXTRACTION_SCHEMA_VERSION = 2;

/**
 * Owns the pure review, normalization, and reconciliation contract. The original PDF remains authoritative; this
 * class only binds reviewed structured evidence and never reads, writes, publishes, or submits anything.
 */
class TaxNormalizationContract {
  extractionRevision(extraction) {
    const persisted = JSON.parse(JSON.stringify(extractionCore(extraction)));
    return createHash('sha256').update(stableJson(persisted)).digest('hex');
  }

  proposalRevision(proposal) {
    const bounded = proposalCore(proposal);
    // Match JSON persistence semantics so omitted optional fields cannot change a saved proposal's revision.
    const persisted = JSON.parse(JSON.stringify(bounded));
    return createHash('sha256').update(stableJson(persisted)).digest('hex');
  }

  buildReviewArtifact(proposal, verifiedOcrFields = []) {
    if (!validPreparedProposal(proposal)) return undefined;
    const requiredFields = normalizedFieldList(proposal.extraction.ocrVerificationRequired || []);
    const verifiedFields = normalizedFieldList(verifiedOcrFields);
    if (!requiredFields || !verifiedFields || !sameList(requiredFields, verifiedFields)) return undefined;
    const proposalRevision = this.proposalRevision(proposal);
    const extractionRevision = this.extractionRevision(proposal.extraction);
    return {
      schemaVersion: 2,
      artifactType: 'payroll-tax-normalization-review',
      reviewState: 'reviewed',
      proposalRevision,
      extractionRevision,
      sourceSha256: proposal.extraction.source.sha256,
      adapter: { id: ADAPTER_ID, version: ADAPTER_VERSION },
      extractionSchemaVersion: proposal.extraction.schemaVersion,
      proposedDestination: proposal.proposedDestination,
      proposedFilename: proposal.proposedFilename,
      proposedSidecarFilename: proposal.proposedSidecarFilename,
      ocrVerification: { requiredFields, attested: requiredFields.length > 0 },
    };
  }

  reviewMatchesPrepared(review, proposal, expectedRevision) {
    if (!review || review.schemaVersion !== 2 || review.artifactType !== 'payroll-tax-normalization-review'
      || review.reviewState !== 'reviewed' || review.adapter?.id !== ADAPTER_ID
      || review.adapter?.version !== ADAPTER_VERSION || review.extractionSchemaVersion !== EXTRACTION_SCHEMA_VERSION
      || !/^[a-f0-9]{64}$/.test(String(review.sourceSha256 || ''))
      || !/^[a-f0-9]{64}$/.test(String(review.proposalRevision || ''))
      || !/^[a-f0-9]{64}$/.test(String(review.extractionRevision || ''))) return false;
    const revision = this.proposalRevision(proposal);
    const requiredFields = normalizedFieldList(proposal.extraction?.ocrVerificationRequired || []);
    const attestedFields = normalizedFieldList(review.ocrVerification?.requiredFields || []);
    return proposal.reviewEligible === true && proposal.status === 'prepared'
      && requiredFields && attestedFields && sameList(requiredFields, attestedFields)
      && review.ocrVerification?.attested === (requiredFields.length > 0)
      && expectedRevision === revision && review.proposalRevision === revision
      && review.extractionRevision === this.extractionRevision(proposal.extraction)
      && review.sourceSha256 === proposal.extraction.source.sha256
      && review.proposedDestination === proposal.proposedDestination
      && review.proposedFilename === proposal.proposedFilename
      && review.proposedSidecarFilename === proposal.proposedSidecarFilename;
  }

  normalize(extraction, review) {
    if (!extraction || review?.reviewState !== 'reviewed') return undefined;
    return {
      ...structuredClone(extraction),
      processing: { state: 'normalized', reviewRequired: false },
      normalization: {
        schemaVersion: 1,
        proposalRevision: review.proposalRevision,
        extractionRevision: review.extractionRevision,
        reviewed: true,
        ocrVerification: structuredClone(review.ocrVerification),
      },
    };
  }

  reconcile({ extraction, pdfSha256, pdfFilename }) {
    // Version 1 lacked field-local evidence and content binding; regenerate it rather than upgrading in place.
    if (extraction?.schemaVersion === 1 || extraction?.adapter?.version === 1) {
      return { status: 'review-required', reason: 'legacy-renormalization-required' };
    }
    if (!extraction || extraction.schemaVersion !== EXTRACTION_SCHEMA_VERSION
      || extraction.recordType !== 'payroll-tax-document'
      || extraction.adapter?.id !== ADAPTER_ID || extraction.adapter?.version !== ADAPTER_VERSION
      || extraction.source?.sha256 !== pdfSha256 || extraction.source?.mediaType !== 'application/pdf'
      || extraction.processing?.state !== 'normalized' || extraction.processing?.reviewRequired !== false
      || extraction.normalization?.schemaVersion !== 1 || extraction.normalization?.reviewed !== true
      || !/^[a-f0-9]{64}$/.test(String(extraction.normalization?.proposalRevision || ''))
      || extraction.normalization?.extractionRevision !== this.extractionRevision(extraction)
      || !validProvenance(extraction.provenance)
      || !validOcrAttestation(extraction)) return { status: 'review-required', reason: 'invalid-sidecar' };
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
}

Object.freeze(TaxNormalizationContract.prototype);
const taxContract = Object.freeze(new TaxNormalizationContract());
const boundExtractionRevision = taxContract.extractionRevision.bind(taxContract);
const boundProposalRevision = taxContract.proposalRevision.bind(taxContract);
const boundBuildReview = taxContract.buildReviewArtifact.bind(taxContract);
const boundReviewMatches = taxContract.reviewMatchesPrepared.bind(taxContract);
const boundNormalize = taxContract.normalize.bind(taxContract);
const boundReconcile = taxContract.reconcile.bind(taxContract);

// Captured bound references keep the public functional API independent of later global/prototype mutation.
export const taxExtractionRevision = (extraction) => boundExtractionRevision(extraction);
export const taxProposalRevision = (proposal) => boundProposalRevision(proposal);
export const buildTaxReviewArtifact = (proposal, fields = []) => boundBuildReview(proposal, fields);
export const reviewMatchesPrepared = (review, proposal, revision) =>
  boundReviewMatches(review, proposal, revision);
export const normalizedTaxExtraction = (extraction, review) => boundNormalize(extraction, review);
export const reconcileTaxExtraction = (input) => boundReconcile(input);

function validPreparedProposal(proposal) {
  return proposal?.schemaVersion === 1 && proposal.operation === 'prepare-tax-from-source'
    && proposal.status === 'prepared' && proposal.reviewEligible === true
    && proposal.extraction?.schemaVersion === EXTRACTION_SCHEMA_VERSION && proposal.extraction?.adapter?.id === ADAPTER_ID
    && proposal.extraction?.adapter?.version === ADAPTER_VERSION
    && proposal.extraction?.completeness?.complete === true
    && proposal.extraction?.processing?.state === 'processing-pending'
    && /^[a-f0-9]{64}$/.test(String(proposal.extraction?.source?.sha256 || ''))
    && typeof proposal.proposedDestination === 'string' && typeof proposal.proposedFilename === 'string'
    && proposal.proposedSidecarFilename === `${proposal.proposedFilename}.json`;
}

function extractionCore(extraction) {
  if (!extraction || typeof extraction !== 'object') return extraction;
  // Only the review publication wrapper and its processing transition may change after human review.
  const { normalization, processing, ...material } = extraction;
  return material;
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
    && Object.values(provenance).every((item) => {
      if (!['labelled-embedded-text', 'embedded-layout', 'ocr-text', 'ocr-layout',
        'derived-arithmetic', 'derived-rule', 'unresolved'].includes(item?.source)) return false;
      if (['labelled-embedded-text', 'derived-arithmetic', 'derived-rule'].includes(item.source)) {
        return item.confidence === 'exact';
      }
      if (item.source === 'ocr-text') return item.confidence === 'candidate';
      if (item.source === 'ocr-layout') {
        return Number.isFinite(item.confidence) && item.confidence >= 0 && item.confidence <= 1
          && item.page === 1 && validNormalizedBbox(item.bbox);
      }
      if (item.source === 'embedded-layout') return item.confidence === 'exact'
        && item.page === 1 && validNormalizedBbox(item.bbox);
      return item.source === 'unresolved';
    });
}

function validOcrAttestation(extraction) {
  const required = normalizedFieldList(extraction.ocrVerificationRequired || []);
  const attested = normalizedFieldList(extraction.normalization?.ocrVerification?.requiredFields || []);
  const unresolved = normalizedFieldList(extraction.unresolvedCriticalFields || []);
  const critical = criticalFieldPaths(extraction);
  const expectedOcr = normalizedFieldList(critical.filter((field) =>
    ['ocr-text', 'ocr-layout'].includes(extraction.provenance?.[field]?.source)));
  const expectedUnresolved = normalizedFieldList(critical.filter((field) =>
    extraction.provenance?.[field]?.source === 'unresolved' || !extraction.provenance?.[field]));
  // Validate both directions: no OCR critical field may escape attestation, and no attested path may lack OCR evidence.
  return required && attested && unresolved && expectedOcr && expectedUnresolved
    && expectedUnresolved.length === 0 && sameList(unresolved, expectedUnresolved)
    && sameList(required, expectedOcr) && sameList(required, attested)
    && extraction.normalization?.ocrVerification?.attested === (required.length > 0);
}

function criticalFieldPaths(extraction) {
  const fields = ['documentRole', 'jurisdiction', 'reportingPeriod.end',
    ...Object.keys(extraction.dates || {}).map((key) => `dates.${key}`),
    ...Object.keys(extraction.amounts?.components || {}).map((key) => `amounts.components.${key}`),
    'amounts.arithmetic.total'];
  if (extraction.reportingPeriod?.start) fields.push('reportingPeriod.start');
  if (extraction.obligationLifecycle?.providerStatus) fields.push('obligationLifecycle.providerStatus');
  fields.push('obligationLifecycle.state', 'obligationLifecycle.settlement');
  if (extraction.documentRole === 'submission-confirmation' && extraction.confirmationReferencePresent === true) {
    fields.push('confirmationReferencePresent');
  }
  return [...new Set(fields)].sort();
}

function validNormalizedBbox(bbox) {
  return bbox && ['x', 'y', 'width', 'height'].every((key) => Number.isFinite(bbox[key])
    && bbox[key] >= 0 && bbox[key] <= 1);
}

function normalizedFieldList(fields) {
  if (!Array.isArray(fields) || fields.length > 32
    || fields.some((field) => !/^[A-Za-z][A-Za-z0-9]*(?:\.[A-Za-z][A-Za-z0-9]*){0,3}$/.test(field))) return undefined;
  return [...new Set(fields)].sort();
}

function sameList(left, right) {
  return left.length === right.length && left.every((field, index) => field === right[index]);
}
