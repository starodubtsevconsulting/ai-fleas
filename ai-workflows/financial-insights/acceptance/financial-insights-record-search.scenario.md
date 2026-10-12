# Cross-business financial record search

This fictional acceptance scenario checks whether a Financial Insights run can
locate and reconcile relevant source records across selected business folders
for one quarter. It supplements the tax-PDF extraction scenarios with a
read-only, workflow-shaped search over incoming invoices, outgoing expenses,
and statements. It does not claim that the current `financial-records`
implementation supports general vendor-invoice or statement processing.

## Scope and fixture

The public test data is owned by the [example human profile](../../../ai-profile/example/data/financial-insights/README.md)
and described in its [Q4 search fixture guide](../../../ai-profile/example/data/financial-insights/search-fixture/README.md).
For Q4 2026, search the `in`, `out`, and `statements` trees recursively for
these fictional businesses:

```text
corporate/reports/2026/
  example-lodging/q4/{in/,out/,statements/}
  example-media/q4/{in/,out/,statements/}
  example-consulting/q4/{in/,out/,statements/}
```

The fixture includes three incoming customer invoices, AI-compute vendor
invoices, a credit/refund, a duplicate invoice copy filed under a different
business folder, a cloud-storage expense, an additional explicitly unpaid
AI-compute invoice, another invoice without matching payment evidence, and
statements containing payment, refund, and unrelated activity. Filenames
are deliberately generic; document content determines business, vendor, topic,
amount, period, and record role. The data generator and evaluator-only
reference facts live with the example profile data. The model must not receive
the answer key or generated evaluator annotations.

All records and entities are synthetic. Q4 means October 1 through December
31, 2026, based on the source document's invoice/transaction date, not a due
date, statement retrieval date, folder label alone, or a later payment date.
Keep income evidence separate from expenses; do not offset customer invoices
against vendor costs.

## Required behavior

1. Search only the authorized reports root and Q4 folders for the three named
   fictional businesses. Discover candidates by bounded recursive listing or
   targeted search; inspect source PDFs and statement contents to verify
   relevant evidence. A filename match by itself is not evidence.
2. Identify unique AI-compute vendor invoices and report each document's
   stated business, its folder location, exact relative path, supplier,
   document date, amount, currency, and whether payment is evidenced. Show
   subtotals for each business named in the invoice and the combined amount.
3. Detect the repeated copy of an invoice and count that economic event once.
   Identify the separate cloud-storage bill and explain why it is outside the
   requested AI-compute category. Keep the credit/refund separate from gross
   invoices. Distinguish the explicitly unpaid AI-compute invoice from
   invoices with no matching payment evidence. If an invoice appears under a
   different business folder than the business named in its contents, report
   both the stated business and the folder location.
4. Inspect the statements for transactions that can be matched to the AI
   invoices or credit. A vendor invoice, due date, payment term, or status
   printed on an invoice does not establish settlement. Count a payment only
   when a statement contains a corresponding transaction; preserve
   unmatched and ambiguous cases explicitly.
5. Report gross unique AI-compute invoices by stated business and overall,
   credit amount, invoice total after credit, matched gross payments, refunds
   separately, and net cash paid. Separate explicitly unpaid invoices from
   invoices with no matching payment evidence. Show reproducible arithmetic
   and keep currency explicit. List incoming customer invoices separately as
   income evidence; report statement payment matches where present, but do not include customer
   receipts in expense totals.
6. Cite every material inclusion, exclusion, match, and calculated total to
   exact relative source path and PDF page or statement row. Report searched
   businesses/sections, discovered files, unreadable or missing evidence, and
   uncertainty. Do not claim completeness beyond the inspected Q4 scope.

This is a search and evidence-reconciliation test only. It does not authorize
normalization, canonical renaming, sidecar creation, publication, payment, or
any file mutation. The current portable command's supported `Out` operations
do not include ordinary vendor invoices, and no general statement matching
command is available; the existing statement command does not parse this
fixture's CSV statements. A test may assess read-only reasoning against the
fictional fixture, but must not report unsupported command processing as
completed work. This scenario makes no GST/QST or tax-classification claim.

## Evaluation boundary

The deterministic evaluator uses independently reviewed source facts and
statement-to-invoice links. It scores discovery coverage, business/direction/
topic classification, duplicate and decoy exclusion, credit handling,
payment matching, arithmetic, citations, and correct unknown/missing states
separately. Unreadable, unsupported, or ambiguous sources do not become
positive evidence. The evaluator-only reference facts are never model input.
Passing this fictional fixture does not establish general invoice-recognition,
accounting, or statement-adapter capability.
