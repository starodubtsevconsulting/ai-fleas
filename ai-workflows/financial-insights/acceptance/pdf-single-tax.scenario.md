# Single-PDF tax evidence

Public test. Platform safety/read scope apply. Do not load or follow any other workflow instructions. Follow this
scenario only. It authorizes no role or financial action.

Native visual input is permitted only after the serving and Pi prerequisites in
[`../../../ai-commands/install/ai-local-provider/multimodal-serving.md`](../../../ai-commands/install/ai-local-provider/multimodal-serving.md)
have passed. This reference is benchmark documentation, not scenario prompt content.

## Runtime inputs

Context supplies `CANONICAL_DATA_ROOT`, nested `PDF_PATH`, and optional period/quarter (for example Q2 2026).

## Initial prompt

```text
Inspect only the named original PDF and report its tax/payment evidence.

The task concerns Canadian federal and Quebec tax/payment evidence. Look for GST/QST and other taxes, including
payroll/source deductions, only where the original PDF supports them. Jurisdiction and filenames are discovery cues,
not proof of tax type, payment status, or currency. Do not assume CAD without source evidence.

Context supplies CANONICAL_DATA_ROOT, PDF_PATH, and optional period. Before reading, verify both paths, that the PDF is
inside the root, and that it is a PDF. If not, ask once for all corrections and stop. Never list/search the folder or
inspect another file.

Obey platform safety/read scope. Do not load or follow any other workflow instructions. Follow this scenario only. Do
not run intake, normalization, sidecars, persistence, reconciliation, INIT, roster, or agents.

Read only the PDF, never JSON, extracted text, notes, sidecars, caches, summaries, answer keys, or derived
files. Write, change, move, and delete nothing. First check whether this harness can pass the original PDF or a
rendered page to the model as native visual input. When it can, inspect page 1 visually and state that method. When
it cannot, record the exact unavailable capability and use fresh text extraction/rendering/OCR only in memory/stdout.
Do not claim to have used vision unless the trace shows it.

First inspect page count, then one page at a time. Keep each bash/tool output <=2,000 characters with targeted searches
and short excerpts; never dump the file. If these bounds prevent inspection, stop and report coverage and uncertainty.

Report:
- document purpose, key dates, tax details, and whether the supplied period (including Q2 2026) applies; redact tax
  numbers and account/identity IDs;
- every tax type and amount, currency, and the page supporting it;
- whether each amount is liability, invoice/assessment, filing/remittance, scheduled, completed/settled,
  refund/reversal, or unclear; a schedule/confirmation is not settlement without completion evidence;
- a useful concise document summary even when it proves no completed payment;
- native visual-input availability and result, method, pages inspected, unreadable/uninspected pages, missing
  evidence, and uncertainty.

Cite findings as `filename, page N`. Never guess unclear amounts, currency, dates, status, or period. Do not claim tax
advice or independent review.
```
