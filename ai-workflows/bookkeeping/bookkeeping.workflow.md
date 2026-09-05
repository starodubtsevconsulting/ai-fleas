# Bookkeeping workflow

Use this workflow for explicitly requested organization and reconciliation of operational financial records such as
invoices, receipts, statements, and issued documents.

## Boundary

Bookkeeping concerns record completeness, classification, provenance, duplicate detection, and reconciliation.
Accounting interpretation, financial statements, tax treatment, compliance, and advice belong to the accounting
workflow or an appropriately qualified human.

## Required behavior

- Keep original documents authoritative and unchanged.
- Preserve provenance from every extracted or derived value to the exact source artifact.
- Mark uncertain extraction or classification for review; never silently guess material financial facts.
- Separate incoming records, outgoing records, statements, and tax-related source material using profile-defined
  conventions.
- Detect likely duplicates without deleting them automatically.
- Do not submit filings, issue invoices, move money, contact third parties, or alter accounting systems without explicit
  authorization for that exact action.
- Keep credentials, real financial data, entity details, and storage paths in private profile-scoped configuration.

Typical flow: `ingest -> preserve source -> extract -> classify -> reconcile -> flag gaps or duplicates -> human review -> prepare bounded output`.

Folder structure, naming, entities, fiscal periods, retention policy, and tools are selected by the profile rather than
this public workflow.
