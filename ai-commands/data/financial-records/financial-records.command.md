# financial-records

Portable command contract for evidence-preserving Financial Insights record operations.

Implementations may use filesystem/NAS/cloud storage, PDF text extraction, OCR, vision, or provider-specific adapters,
but callers receive the same bounded result shapes. The command does not make strategic financial decisions.

## Shared execution target

This file defines the full capability contract. A read-only `recognize` executable handles snow-removal service
contracts as review-pending evidence. A read-only `prepare-review` operation derives a bounded Booking reservation
filename and extraction preview from an existing eligible `In` recognition artifact. `prepare-from-source` derives
the same preview from PDF text and explicit selected context. `apply-from-source` can publish that currently supported
Booking `In` PDF and extraction sidecar after a fresh source-backed check. These operations do not support
`reconcile` or `completeness`. Invoke recognition through the selected profile with
`node financial-records.command.mjs recognize --root ABSOLUTE_ROOT --source ABSOLUTE_PDF`.

Invoke the preview with `node financial-records.command.mjs prepare-review --root ABSOLUTE_ROOT --recognition ABSOLUTE_JSON`.
The recognition file must be a regular JSON file inside the real root and at most 16 KiB. The command returns
`proposedFilename` and a validated `extraction` without source paths, raw document text, or writes. Unsupported,
uncertain, and `Out` documents remain review pending. This artifact-based preview is advisory and cannot authorize
publication.

Invoke source-backed preparation with `node financial-records.command.mjs prepare-from-source --root ABSOLUTE_ROOT
--source ABSOLUTE_PDF --branch BRANCH_ID --year YYYY --quarter q1..q4 --section in`. The command checks PDF magic,
size, and real-path containment, reads bounded text, and requires Booking reservation evidence, a labelled visible
monetary total, and an exact branch and period match. It returns a canonical filename, validated extraction, and a
source SHA-256 fingerprint without raw text or paths. Missing text totals that need visual evidence remain review
required. The artifact-based `prepare-review` result is advisory and cannot authorize apply.

Invoke `apply-from-source` with `--root ABSOLUTE_REPORTS_ROOT --source ABSOLUTE_PDF --destination ABSOLUTE_DIRECTORY
--branch BRANCH_ID --year YYYY --quarter q1..q4 --section in --expected-sha256 SHA256 --expected-filename CANONICAL_PDF`.
The caller must select an authorized reports root and an existing destination exactly at
`root/year/branch/quarter/in`; the command creates no directory. It recomputes source-backed preparation, compares
both expected values, rehashes the source bytes, and publishes the canonical PDF copy and validated `.pdf.json`
sidecar exclusively. It leaves the original source untouched, returns no raw text or machine path, and rejects
existing targets. `Out` invoices and records requiring visual total evidence remain review required.

### Apply-review safety gate

Artifact-based preparation validates recognition fields but cannot prove that
the artifact belongs to the supplied PDF. Matching an artifact filename to a PDF filename is insufficient: either
file can change between review and apply. Source-backed preparation independently reads the PDF, and
`apply-from-source` recomputes it immediately before writing. The backend also uses bounded visual total evidence when text extraction
is insufficient; that case remains review required in the shared command. A PDF header check alone cannot replace
document validation.

The caller supplies the authorized reports root, source PDF, selected `In` section and period, and existing destination.
The command checks real-path containment and the exact `root/year/branch/quarter/in` layout. The supplied fingerprint
and canonical filename must match a freshly computed eligible preview. The recognition JSON artifact is never used
as apply evidence. `Out` invoices remain unsupported.

Publication rejects existing canonical PDF and extraction-sidecar paths, including concurrent
creations. It preserves the original source PDF until a complete canonical PDF plus validated
sidecar exists. Because two filesystem entries cannot be published as one atomic operation, the command must define
an observable partial state and a retry/recovery rule before any write path is enabled. A failed write must never
silently overwrite, discard, or claim a completed extraction.

The internal `ReviewPublisher` primitive backs `apply-from-source`. Given freshly validated
PDF bytes, extraction, and canonical target paths, it stages both files with exclusive creation in the destination
directory, verifies the staged PDF hash, and publishes each target with an exclusive hard link. A collision leaves
existing targets intact. If sidecar publication fails after the PDF link, rollback removes that PDF only when its
device and inode still match the primitive's own staged file; a changed target is retained and reported as partial.
Staging entries are removed when still owned by this invocation. A process crash between the two links can leave a
canonical PDF without its sidecar and owned staging entries. A future apply caller must detect that state and require
review before retrying; it must not overwrite or silently infer completion from the PDF alone.

The intended full implementation is one
executable command for both no-UI workflow callers and the platform backend. Keep recognition, canonical naming,
structured extraction, and reconciliation in that shared implementation; the backend may provide UI context and
display review results, but must not maintain a separate copy of those rules. Profile-authorized adapters select the
storage and document drivers. A caller must not treat an unsupported document section as processed merely because the
contract defines its result shape.

### Payroll-tax source preparation

Invoke `prepare-tax-from-source` with `--root ABSOLUTE_AUTHORIZED_ROOT --source ABSOLUTE_PDF --branch BRANCH_ID
--year YYYY --quarter q1..q4 --section out`. This read-only operation accepts only a contained PDF and explicit `Out`
context. It classifies supported Canadian federal payroll-remittance obligations, federal PD7A/EMPTX provider
submission confirmations, Quebec payroll-remittance obligations, and Quebec provider submission confirmations as
distinct document roles. Confirmation references are retained only as a presence boolean; identifier values are never
returned or stored. Its bounded result includes the
source SHA-256, schema and adapter versions, jurisdiction, reporting period, dates, amount components and arithmetic,
page completeness, separate processing and obligation lifecycle states, relations, field provenance, and a canonical
bundle destination/filename proposal.

The original PDF remains authoritative. Embedded labelled text and embedded layout evidence may be exact; OCR text
and OCR layout are candidate evidence only. Preparation lists every payment-critical OCR-only field in the sorted,
bounded `ocrVerificationRequired` array and remains ineligible for apply until a human verifies that exact list against
the open source PDF. Raw OCR text, screenshots, account identifiers, and confirmation identifiers are never written to
the normalized sidecar.

This evidence-local contract is extraction schema `2` with Canadian payroll-tax adapter version `2`. Schema/adapter
version `1` sidecars are not upgraded in place: reconciliation returns deterministic
`legacy-renormalization-required`, and the original PDF must pass the current prepare, human review, apply, and
reconcile path again. Each review binds a stable extraction-content revision covering material values, dates,
lifecycle, provenance, critical-field lists, and source hash; normalized sidecars retain that revision and
reconciliation rejects any post-review material change.

The shared PDF reader remains domain-neutral and plan-driven. Generic callers use the bounded generic plan without
numeric layout-token extraction. Payroll-tax preparation explicitly selects the payroll-tax read plan, which owns its
OCR trigger, language, page-segmentation mode, page/text/token limits, and numeric layout-token policy.
Plans also impose explicit per-page and cumulative rendered-pixel budgets before any canvas allocation. The current
local runtime supports the `eng` OCR data package and PSM values `3`, `4`, `6`, and `11`; other languages or modes fail
plan validation rather than reaching Tesseract implicitly.

Unsupported, ambiguous, wrong-period, wrong-section, missing-total, arithmetic-mismatched, or conflicting evidence
fails closed. An incomplete federal page set may return an extraction for review, but remains `incomplete`,
`review-required`, and ineligible for apply. A provider status such as `to be processed` is submission/scheduling
evidence with settlement pending; it is never paid or settled evidence. Preparation keeps `reportingPeriod` separate
from `operationalPeriod`. A Q3 reporting-period obligation selected as current Q4 payment work proposes a Q4 `Out`
bundle while retaining its Q3 period end in the sidecar.

Save the bounded preparation JSON inside the authorized root, inspect it, then explicitly invoke
`review-tax-proposal --root ABSOLUTE_AUTHORIZED_ROOT --proposal ABSOLUTE_PREPARE_JSON`. Review is read-only and returns
a source-hash/schema/adapter/destination/filename-bound revision. It rejects incomplete or non-applicable proposals.
When `ocrVerificationRequired` is non-empty, keep the original PDF open beside the proposal, verify every listed field,
and pass the exact list with `--verify-ocr-fields field.path,field.path`; review fails closed if the flag is absent,
contains a different field, or omits one. The artifact stores only the verified field paths and binding hashes—not
human notes or sensitive values. A proposal with no OCR-only critical fields does not require this flag.

Invoke `apply-tax-from-source --root ABSOLUTE_AUTHORIZED_ROOT --source ABSOLUTE_PDF --destination
ABSOLUTE_EXISTING_CANONICAL_DIRECTORY --review ABSOLUTE_REVIEW_JSON --branch BRANCH_ID --year YYYY --quarter q4
--section out --expected-proposal-revision SHA256`. Apply reruns source preparation and requires the exact reviewed
revision, source hash, adapter/schema, and proposal. It rejects symlinks, Q3 destinations, escapes, missing directories,
collisions, and incomplete evidence. It publishes a canonical PDF copy plus adjacent `.pdf.json` through the exclusive
two-artifact publisher and preserves the original source.

Invoke `reconcile-tax-record --root ABSOLUTE_AUTHORIZED_ROOT --pdf ABSOLUTE_CANONICAL_PDF --sidecar
ABSOLUTE_CANONICAL_PDF_JSON --branch BRANCH_ID --year YYYY --quarter q4 --section out`. Reconcile is read-only. It
checks exact Q4 routing, PDF hash, filename, schema/adapter, normalized processing state, independent obligation
lifecycle, richer field provenance, the exact OCR verification attestation, and the confirmation relation when
applicable.

Direct CLI failures emit fixed JSON error codes. Tax-specific codes include `INVALID_PROPOSAL`, `INVALID_REVIEW`,
`OCR_VERIFICATION_REQUIRED`, `REVIEW_MISMATCH`, `INVALID_SIDECAR`, and `CLOSED_PERIOD`; known
validation/publication failures retain the shared fixed codes instead of silently degrading to `INTERNAL_ERROR`.

The backend should become a thin caller: verify the selected profile, project, period, section, and caller authority;
pass bounded source and destination context to the command; then present its structured result. The command owns PDF
recognition, field extraction, naming proposals, collision checks, and any authorized normalization or sidecar write.
Read-only preparation and mutating apply must be distinct operations so the same command can serve review in the UI
and no-UI workflows. Porting the current backend's `In`-specific implementation does not establish `Out` support;
vendor invoices need their own recognized, tested rules before they can be applied.

## Operations

### recognize

Input: one authorized source document plus selected project context.

Returns a bounded recognition result:

- source reference/provenance;
- proposed kind: invoice, receipt, payout, bill, statement, tax-document, other, or uncertain;
- proposed section: In, Out, Statements, or Review;
- primary date and derived year/quarter when unambiguous;
- currency and bounded identity/evidence signals when available;
- confidence/uncertainty reasons;
- collision/proposed-destination state.

Recognition is prepare-only. It must not persist or rename the source.

### extract

Returns schema-versioned structured financial fields plus provenance. Raw OCR/text need not be retained and must not be
returned when the profile forbids it. Missing fields remain missing; implementations must not invent values.

### reconcile

Operates only inside an authorized project/period/section. Reuses recognition/extraction rules for filesystem-present
records and returns counts/items for canonical, normalized, extracted, uncertain, skipped, missing, duplicate, and
collision states. Reconciliation must be idempotent and never overwrite silently.

### completeness

Returns bounded evidence about expected versus observed sections/periods and unresolved items. It reports missing or
uncertain evidence; it does not manufacture bookkeeping completeness.

## Safety

All writes require profile-authorized persistence behavior. Ambiguous ownership, period, section, totals, currency,
classification, extraction schema, or collisions remain review-pending. Real account identifiers, credentials,
machine paths, and unrestricted raw document text must not appear in generic command results.
