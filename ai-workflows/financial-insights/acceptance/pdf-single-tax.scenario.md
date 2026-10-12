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

## Evaluator boundary and paired-JSON verification

This section is evaluator/harness guidance, outside the initial model prompt. The human-authorized test harness may
render original PDF pages and capture private evidence in its authorized runtime workspace outside the canonical
source root. It must not mutate canonical source files or run the data-processing pipeline. Pi itself remains
read-only and receives only the permitted original PDF/page visual inputs; its no-write and no-sidecar constraints
remain in force.

Capture the blind Pi output and its actual visual-input trace before the evaluator opens or prepares the paired parsed JSON.
Do not include JSON, parsed fields, expected answers, or evaluator findings in Pi's context or tools. Pair records by
exact existing source linkage or an unambiguous matching stem within the authorized source set. If a pairing is
ambiguous, stop that comparison and record it as unavailable. Missing JSON may be prepared only with explicit human
authorization, from the original PDF after blind capture, in the evaluator's private runtime workspace; never use
Pi's output or desired answers to prepare it. Without that authorization, missing pairing remains unavailable.

Before treating existing or prepared JSON as a usable baseline, manually verify literal, source-supported fields
against the relevant original pages. Distinguish normalized/inferred values, including inferred currency, from visible
evidence. Preserve correction, uncertainty and page provenance in a private verifier overlay and runtime references;
do not overwrite the source baseline without a separate request.

Compare tax type, amount, currency, relevant dates, payment status and settlement classification. Record matches,
omissions, contradictions and unavailable/unknown fields separately. Parsed JSON is a comparison baseline, not
infallible truth: adjudicate disagreements against the original cited page and leave unresolved cases explicit.
Keep raw field comparisons, source linkage, images and reports private. Publish only sanitized aggregate metrics and
outcomes, baseline validation status and aggregate prepared/verified/corrected field counts for every attempted
page/run under the
[benchmark reporting methodology](../../../models/qwen3.8-flash-next/benchmarks/gx10/pdf-evidence-pi-2026-10-12.md).
Do not publish financial values, source identifiers or source-content hashes. Limited candidate/page coverage does
not establish week or quarter completeness.
