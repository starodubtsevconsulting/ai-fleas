# Q4 cross-business AI expense search

Medium-scale public workflow-shaped benchmark. The selected profile supplies
the authorized reports root. This prompt is read-only: it initializes no role,
does not invoke unsupported financial-records operations, and authorizes no
financial action.

## Runtime inputs

Launch context supplies `REPORTS_ROOT`, the authorized root containing the
business/year/quarter folders. Use only its Q4 2026 records for
`example-lodging`, `example-media`, and `example-consulting`.

## Initial prompt

```text
Find the unique AI-compute expenses for Q4 2026 across the three fictional businesses in the selected reports root.

Search recursively within each business's Q4 `in`, `out`, and `statements` folders. Use filenames only to discover candidates; inspect source document content to confirm the business, record direction, subject, date, amount, currency, and status. Do not read evaluator references, answer keys, generated annotations, or unrelated periods/businesses.

Identify customer invoices separately from vendor expenses. For every unique AI-compute invoice, report the business named in the document, its folder location, supplier, exact relative source path, page, invoice date, amount and currency, and whether payment is evidenced. Show subtotals by the business named in each invoice as well as one combined total. Detect the repeated copy filed under a different business folder and count that invoice only once. Identify the cloud-storage bill as a separate expense outside the AI-compute request. Keep any credit/refund separate from gross invoices. Distinguish the explicitly unpaid AI-compute invoice from invoices with no matching payment evidence.

Inspect statements for matching transactions. An invoice, due date, payment term, or invoice status alone does not prove settlement. Count a payment only when a corresponding transaction appears on a statement. If the match, currency, business, date, or status is uncertain, say so and do not include it as confirmed paid.

Report gross unique AI-compute invoices, credits separately, invoice total after credit, matched gross payments, refunds separately, net cash paid, explicitly unpaid invoices, and invoices with no matching payment evidence. Show reproducible arithmetic and preserve the source currency; do not invent exchange rates or silently net unlike categories. List incoming customer invoices separately as income evidence and report their statement payment status where a matching receipt exists; keep all customer receipts out of expense totals.

Cite every inclusion, material exclusion, duplicate, payment match, and total to the exact relative source path plus PDF page or statement row. State which businesses and sections you searched, what you found, and any unreadable, missing, unsupported, or ambiguous evidence. Limit completeness claims to the inspected Q4 scope.

Return only one valid JSON object with this shape (no Markdown fences or prose outside JSON):
{
  "searched": [{"business": "...", "sections": ["in", "out", "statements"]}],
  "records": [{"ref": "...", "kind": "customer-invoice|vendor-invoice|vendor-credit-note|duplicate-copy", "business": "business named in document", "folder_business": "business folder", "source": "exact relative path", "page": 1, "amount": "decimal string", "currency": "CAD", "payment_status": "...", "citations": ["relative/path.pdf page 1", "relative/path.csv row 2"]}],
  "totals": {"ai_compute_gross": "decimal string", "credit": "decimal string", "ai_compute_net_of_credit": "decimal string", "matched_gross_payments": "decimal string", "refunds": "decimal string", "net_cash_outflow": "decimal string", "unmatched_invoice_amount": "decimal string"},
  "exclusions": [{"ref": "...", "reason": "...", "source": "exact relative path", "page": 1}],
  "notes": ["..."],
  "limitations": ["..."]
}
Include each distinct source record you rely on, including customer invoices, the credit, decoy, and misplaced duplicate. For statements, add evidence as citation entries on the related record using its exact CSV path and one-based row number including the header. `searched` must cover all three requested businesses and all three requested sections. Use empty arrays when there are no notes or limitations. The evaluator checks factual fields, required evidence citations, handling of the duplicate/decoy, and totals; this schema does not reveal the expected records or answers.

This is a read-only search and evidence summary. Do not normalize, rename, create sidecars, publish, reconcile by writing, make payments, or modify files. Do not claim that an unsupported financial-records command processed vendor invoices or statements. Do not provide GST/QST or tax classifications.
```

## Evaluator boundary

The evaluator compares the response with the fictional source set and
independently reviewed references. Do not expose references, hidden record
links, or expected totals to the model. The prompt tests discovery and
evidence-based grouping, duplicate/decoy exclusion, credit arithmetic, and
statement-supported payment status; it does not test command-based invoice
normalization or statement-adapter execution.
