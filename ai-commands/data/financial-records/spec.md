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
- Provider-specific OCR/PDF/vision implementations remain adapters behind this contract.
