# financial-records

Portable command contract for evidence-preserving Financial Insights record operations.

Implementations may use filesystem/NAS/cloud storage, PDF text extraction, OCR, vision, or provider-specific adapters,
but callers receive the same bounded result shapes. The command does not make strategic financial decisions.

## Shared execution target

This file defines the full capability contract. A read-only `recognize` executable now handles snow-removal service
contracts as review-pending evidence; it does not support `extract`, `reconcile`, `completeness`, normalization, or
sidecar publication. Invoke it through the selected profile with
`node financial-records.command.mjs recognize --root ABSOLUTE_ROOT --source ABSOLUTE_PDF`.

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
