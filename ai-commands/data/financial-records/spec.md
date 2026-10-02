# financial-records Spec

## Purpose

Provide a portable evidence API for Financial Insights record recognition, extraction, reconciliation, and completeness.

## Rules

- Preserve source provenance through every operation.
- Recognition/extraction are separable from persistence.
- Filename and metadata are advisory, not sufficient evidence when document content is available.
- Fail closed on ambiguous project, period, section, financial identity, or collision.
- Never silently overwrite canonical evidence.
- Reconciliation is bounded to an explicitly authorized project/period/section and is idempotent.
- Return structured/bounded evidence; do not expose credentials or unrestricted raw extracted text.
- Keep payroll-tax obligations, provider submission confirmations, and bank settlement evidence as distinct roles;
  submission or scheduling never implies payment settlement.
- Canonical tax filenames encode stable document identity and dates, never mutable paid status, amounts, identifiers,
  account data, or original filenames.
- Keep obligation reporting period separate from operational/payment period. Closed Q3 evidence processed during Q4
  remains reportable as Q3 but normalizes only into the authorized Q4 `Out` tax bundle.
- Tax publication requires a reviewed source-hash-bound proposal revision and always preserves the original source.
- Provider-specific OCR/PDF/vision implementations remain adapters behind this contract.
