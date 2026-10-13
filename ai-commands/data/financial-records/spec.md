# financial-records Spec

## Shared record organization

Follow the [Financial Insights record organization flow](../../../ai-workflows/financial-insights/flows/record-organization.flow.md) within the selected profile's authorized mapping. Keep source-adjacent CSV/JSON, preserve existing `.pdf.json` schema conventions and provenance, and use one mapped `_common/qN/summary.md` for current coverage and unresolved work. Compose aggregates on demand instead of retaining duplicate extracts. This contract does not add a generic CSV exporter, change supported operations, or waive persistence gates. Existing command output/checkpoint behavior remains compatible; publication or cleanup needs its authorized route.

The flow's intake completion invariant also applies: copying is not completion. In the same authorized intake operation, prepare/review canonical normalization and validate adjacent extraction independently before claiming the record processed. Start intake, quarter-readiness and inventory work with a scoped catch-up scan for unfinished names/destinations and absent, invalid or stale sidecars, including images. Skip unchanged validated pairs; changed sources require renewed source-bound preparation/review. Use only actually supported adapters and publication routes; isolate failures and record per-record pending reasons/next actions in the one quarter summary. This contract adds no background watcher or generic executable scan/reconcile operation.

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
