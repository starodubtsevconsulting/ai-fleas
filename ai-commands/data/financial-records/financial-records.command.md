# financial-records

Portable command contract for evidence-preserving Financial Insights record operations.

Implementations may use filesystem/NAS/cloud storage, PDF text extraction, OCR, vision, or provider-specific adapters,
but callers receive the same bounded result shapes. The command does not make strategic financial decisions.

## Shared execution target

This file defines the full capability contract. A read-only `recognize` executable handles snow-removal service
contracts as review-pending evidence. A read-only `prepare-review` operation derives a bounded Booking reservation
filename and extraction preview from an existing eligible `In` recognition artifact. `prepare-from-source` derives
the same preview from PDF text and explicit selected context. These operations do not support
`reconcile`, `completeness`, normalization, or sidecar publication. Invoke recognition through the selected profile with
`node financial-records.command.mjs recognize --root ABSOLUTE_ROOT --source ABSOLUTE_PDF`.

Invoke the preview with `node financial-records.command.mjs prepare-review --root ABSOLUTE_ROOT --recognition ABSOLUTE_JSON`.
The recognition file must be a regular JSON file inside the real root and at most 16 KiB. The command returns
`proposedFilename` and a validated `extraction` without source paths, raw document text, or writes. Unsupported,
uncertain, and `Out` documents remain review pending. A caller must still check destination collisions and use an
explicit, separately authorized apply step before writing a sidecar or renaming a PDF.

Invoke source-backed preparation with `node financial-records.command.mjs prepare-from-source --root ABSOLUTE_ROOT
--source ABSOLUTE_PDF --branch BRANCH_ID --year YYYY --quarter q1..q4 --section in`. The command checks PDF magic,
size, and real-path containment, reads bounded text, and requires Booking reservation evidence, a labelled visible
monetary total, and an exact branch and period match. It returns a canonical filename, validated extraction, and a
source SHA-256 fingerprint without raw text or paths. Missing text totals that need visual evidence remain review
required. The artifact-based `prepare-review` result is advisory and cannot authorize apply.

### Apply-review safety gate

`apply-review` is not executable yet. Artifact-based preparation validates recognition fields but cannot prove that
the artifact belongs to the supplied PDF. Matching an artifact filename to a PDF filename is insufficient: either
file can change between review and apply. Source-backed preparation independently reads the PDF, but is advisory
until recomputed immediately before a write. The backend also uses bounded visual total evidence when text extraction
is insufficient; that case remains review required in the shared command. A PDF header check alone cannot replace
document validation.

Before adding an apply operation, the shared command must independently validate the PDF and its monetary evidence,
bind a versioned preview to the exact PDF bytes, recognition artifact, selected `In` section and period, and recheck
that binding immediately before writing. The caller must supply an authorized root, source PDF, recognition artifact,
selected section root, and destination directory; real paths for all inputs must stay within the root, and the
destination must stay within that selected section. `Out` invoices remain unsupported.

Publication must reject existing canonical PDF, recognition, and extraction-sidecar paths, including concurrent
creations. It must preserve original PDF and recognition evidence until a complete canonical PDF plus validated
sidecar exists. Because two filesystem entries cannot be published as one atomic operation, the command must define
an observable partial state and a retry/recovery rule before any write path is enabled. A failed write must never
silently overwrite, discard, or claim a completed extraction.

The intended full implementation is one
executable command for both no-UI workflow callers and the platform backend. Keep recognition, canonical naming,
structured extraction, and reconciliation in that shared implementation; the backend may provide UI context and
display review results, but must not maintain a separate copy of those rules. Profile-authorized adapters select the
storage and document drivers. A caller must not treat an unsupported document section as processed merely because the
contract defines its result shape.

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
