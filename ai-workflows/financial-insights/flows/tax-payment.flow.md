# Tax payment flow

Use this flow when the human wants Financial Insights to normalize tax-remittance evidence and prepare a payment in a
profile-authorized visible banking interface. It does not authorize payment submission or prove settlement.

## Required record state

A tax source is ready for payment-form preparation only when one reviewed logical normalization transaction has
produced both:

- a PDF at the approved canonical filename and destination; and
- an adjacent schema-valid sidecar named `<canonical-pdf>.json`, bound to the exact PDF SHA-256.

Conversational extraction, an unreviewed recognition artifact, a renamed PDF without JSON, JSON beside a noncanonical
PDF, or an older sidecar that fails the current schema/provenance checks is not normalized state.

## Tax-case structure and lifecycle evidence

Keep the reporting period and the physical operational bucket as separate facts. When the reporting-period quarter is
open, the tax case may be anchored there. When that quarter is closed, do not mutate it: place the case in the open
quarter where the remittance is prepared, submitted, or scheduled, and record the closed-period carry-forward
explicitly in each sidecar. Keep distinct provider-produced documents together inside that stable operational bundle:

```text
<year>/<branch>/<open-operational-quarter>/out/taxes/payroll-remittances/
  <jurisdiction>/<period-end>/
    <period-end>_<jurisdiction>_payroll-remittance-obligation.pdf
    <period-end>_<jurisdiction>_payroll-remittance-obligation.pdf.json
    <submission-date>_<jurisdiction>_payroll-remittance-submission-confirmation.pdf
    <submission-date>_<jurisdiction>_payroll-remittance-submission-confirmation.pdf.json
```

For example, an obligation whose reporting period ends `2026-09-30` remains a Q3 obligation in structured data. If Q3
is closed and the remittance is processed in Q4, its physical bundle belongs under `2026/q4` with
`physicalBucket.basis: operational-payment-activity` and `closedPeriodCarryForward: true`. A separately produced
submission confirmation stays in that same operational bundle and preserves its actual submission/confirmation date
in its filename and sidecar. Never manufacture that confirmation from the obligation form.

Keep bank statements in their natural statement/cash-period folders. Link the specific posted statement transaction
to the obligation with a source-hash-bound `settles` or `partially-settles` relation; do not copy the whole statement
into the tax bundle. A provider status such as `to be processed` supports submitted, scheduled, processing, or
settlement-pending state only. It does not prove paid or settled.

Do not encode mutable state in canonical filenames. Suffixes such as `_payed` and `_paid` are prohibited. Store two
independent axes in structured data:

- processing: `processing-pending`, `review-required`, `normalized`, `incomplete`, `unsupported`, or `collision`;
- obligation lifecycle: `obligation-recorded`, `submitted`, `scheduled`, `processing`, `settlement-pending`, `settled`,
  `failed`, `cancelled`, or `reversed`.

Use stable record IDs bound to source hashes. A submission confirmation relates to the obligation with
`confirms-submission-of`; only a posted transaction or equivalent authoritative evidence may relate with `settles`.
Derive the obligation's current lifecycle during reconciliation rather than duplicating mutable forward/backward state
across every sidecar.

## Sequence

1. **Resolve scope.** Verify the profile, project, branch/business, year, open operational quarter, `Out` tax section,
   and exact source folder. Exclude underscore-prefixed entries and symlinks. Detect whether the reporting period is
   closed. Never mutate the closed quarter; route later remittance activity to the verified open operational quarter
   while preserving the original reporting period and carry-forward reason in structured data.
2. **Prepare without writes.** Through the shared `financial-records` engine, recursively inspect each PDF and return
   its source hash, tax-document family, jurisdiction, reporting period, dates, amount components, total, currency,
   payment-evidence state, page completeness, provenance warnings, proposed canonical destination/filename, proposed
   sidecar name, and collision state. Unsupported or ambiguous files remain unchanged.
3. **Review the exact proposal.** Open the source PDF visibly. Show the human the current filename, proposed canonical
   filename, destination, extracted-field preview, warnings, and arithmetic. Bind approval to the exact PDF hash,
   adapter/schema versions, and proposal revision. The Financial Reviewer independently approves or rejects material
   evidence; review does not publish.
4. **Apply as one logical transaction.** Re-read and rehash the source, rerun preparation, compare it with the reviewed
   revision, and recheck scope and collisions. Publish the canonical PDF and adjacent JSON through the authorized
   versioned-data publisher. Never overwrite or invent a suffix. If rename or sidecar publication fails, restore or
   preserve the original source and report a partial/review-required state; never claim normalization from only one
   artifact.
5. **Reconcile.** Re-read the canonical PDF and sidecar, verify their hash/schema/provenance relationship, and classify
   the result as normalized, review-required, collision, unsupported, or incomplete. Reconciliation is idempotent.
6. **Prepare payment.** Only after successful reconciliation, use the
   [`tax-payment-entry` skill](../skills/tax-payment-entry/SKILL.md). Keep the canonical PDF open beside the banking
   form and map every entered bank field through the reviewed JSON back to its PDF provenance.
7. **Human submission and later settlement.** Stop at the provider's final submission control. The human submits.
   Normalize a separately produced provider confirmation into the existing tax-case bundle as submission evidence,
   using its actual submission/confirmation date rather than a scheduled execution date. Later reconcile a specific
   posted bank transaction before classifying the obligation as settled.

## Implementation boundary

The UI and no-UI route must call the same portable `financial-records` prepare/review/apply/reconcile implementation.
Do not reproduce recognizers, naming, extraction schemas, or collision rules in prompts or a second backend. Existing
launcher actions may be retained as compatibility surfaces only when they call this shared engine and preserve the
same review and publication gates.
