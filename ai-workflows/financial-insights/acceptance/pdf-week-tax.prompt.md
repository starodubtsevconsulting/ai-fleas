# Weekly tax paid from original PDFs

Medium-scale public benchmark. The profile supplies only the authorized root, dates, and model. Platform safety/read
scope apply. Do not load or follow any other workflow instructions. Follow this prompt only. It bypasses workflow
processing, initializes no role, and authorizes no financial action.

Native visual input is permitted only after the serving and Pi prerequisites in
[`../../../ai-commands/install/ai-local-provider/multimodal-serving.md`](../../../ai-commands/install/ai-local-provider/multimodal-serving.md)
have passed. This reference is benchmark documentation, not model prompt content.

## Runtime inputs

Launch context supplies `CANONICAL_DATA_ROOT`, inclusive `PERIOD_START` and `PERIOD_END` (`YYYY-MM-DD`) defining one
selected calendar week. No real path, period, or expected answer belongs in this prompt.

## Initial prompt

```text
Determine taxes actually paid during the supplied calendar week from original PDFs only.

The task concerns Canadian federal and Quebec tax/payment evidence. Look for GST/QST and other taxes, including
payroll/source deductions, only where the original PDF supports them. Jurisdiction and filenames are discovery cues,
not proof of tax type, payment status, or currency. Do not assume CAD without source evidence.

Context supplies CANONICAL_DATA_ROOT and inclusive PERIOD_START/PERIOD_END. Before reading financial data, verify the
root and explicit, unambiguous, ordered dates. If anything is missing or invalid, ask once for all corrections and stop
without listing the root. Never broaden or replace the root or dates.

Obey platform safety/read scope. Do not load or follow any other workflow instructions. Follow this prompt only. Do
not run intake, normalization, sidecars, persistence, reconciliation, INIT, roster, or workflow agents.

Discover only original PDFs plausibly relevant to the supplied week. Do not read JSON, extracted text, notes,
spreadsheets, sidecars, caches, summaries, answer keys, or derived files. Write, change, move, and delete nothing.
First check whether this harness can pass an original PDF or rendered page to the model as native visual input. When
it can, inspect each selected page visually and state that method. When it cannot, record the exact unavailable
capability and use fresh text extraction/rendering/OCR only in memory/stdout. Do not claim to have used vision unless
the trace shows it.

Bound context use: perform targeted discovery, not a recursive content dump. Inspect one PDF and one page at a time.
Keep each bash/tool output <=4,000 characters using filenames, targeted searches, and short excerpts. Never dump a
whole PDF or folder. If candidate volume or readability exceeds these bounds, stop expansion, identify what was and
was not covered, and report a partial or insufficient-evidence result.

Count only completed/settled payments whose payment date falls within the inclusive week. A liability, invoice or
assessment, filing/remittance, due/submission date, payment instruction, confirmation, or scheduled transaction is not
settlement without clear completion evidence. Exclude unclear and out-of-period candidates.

Detect likely duplicates and do not double count. Report refunds/reversals separately and show gross payments,
refunds/reversals, and net without silent netting. Preserve currencies; never combine them or invent exchange rates.
If status, date, tax type, amount, currency, page, or identity is unclear, exclude it from confirmed totals and say why.

Report scope/dates, discovery and coverage, native visual-input availability and result, actual extraction method per
material PDF, unreadable/uninspected items, and unavailable capabilities. Give one row per candidate with tax type,
amount, currency, dates, status, inclusion reason, and `filename, page N` citation. Show reproducible arithmetic by
tax type and currency, then overall totals per currency. List material exclusions and missing evidence. Conclude with
confirmed totals, marked partial when needed, or state insufficient evidence. Cite every included amount and material
exclusion. Do not expose credentials or raw account identifiers, and do not claim tax advice or independent review.
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

## Fictional public fixture

For reproducible public runs, see the [fictional PDF tax fixture](../../../notes/benchmarks/local-models/fixtures/pdf-tax-evidence/README.md). Supply its model-input PDF directory through the runtime inputs above; do not expose evaluator JSON or expected answers to the model. The same prompt can use an authorized private source root. Public fixture inputs and verified fictional outputs may be published; private source evidence remains private.

A single-page run measures only that page. Week and quarter runs must report their actual discovery and coverage; completing selected pages does not establish period completeness. An unavailable visual-input path or unknown source field remains explicit, not a successful vision result.
