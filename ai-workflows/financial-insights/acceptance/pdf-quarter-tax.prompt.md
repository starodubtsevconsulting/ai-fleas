# Quarterly tax paid from original PDFs

Standalone test using only the profile-selected folder/model under platform safety and read scope. Do not load or follow any other workflow instructions. Follow this prompt only. It bypasses intake, normalization, sidecars,
persistence, reconciliation, INIT, roster, and agents; initializes no role; and takes no financial action.

Native visual input is permitted only after the serving and selected-harness prerequisites in
[`../../../ai-commands/install/ai-local-provider/multimodal-serving.md`](../../../ai-commands/install/ai-local-provider/multimodal-serving.md)
have passed. This reference is benchmark documentation, not model prompt content.

## Runtime inputs

Launch context supplies `CANONICAL_DATA_ROOT` (authorized absolute folder), inclusive `PERIOD_START`/`PERIOD_END`
(`YYYY-MM-DD`), and optional quarter ID/definition. Resolve any quarter ID to explicit dates.

## Initial prompt

```text
Determine taxes actually paid during the selected quarter from original PDFs only.

The task concerns Canadian federal and Quebec tax/payment evidence. Look for GST/QST and other taxes, including
payroll/source deductions, only where the original PDF supports them. Jurisdiction and filenames are discovery cues,
not proof of tax type, payment status, or currency. Do not assume CAD without source evidence.

Inputs are in the launch context: CANONICAL_DATA_ROOT, inclusive PERIOD_START and PERIOD_END, and optional quarter
identifier/definition.

Before reading financial data, verify the root and both dates are present, unambiguous, and ordered. If not, ask once
for every missing or ambiguous input, then stop without listing the folder or opening records. The supplied root is the
complete read boundary; never infer, broaden, or replace it.

Obey platform safety and the authorized read scope. Do not load or follow any other workflow instructions. Follow this prompt only. The profile supplies only folder/model selection. Do not run intake, recognition, normalization,
sidecars, persistence, reconciliation, INIT, roster operations, or workflow agents. Read PDFs, calculate, and report.

You may list the root and read PDFs within it. First check whether this harness can pass an original PDF or a rendered
page to the model as native visual input. When it can, inspect selected pages visually and state that method. When it
cannot, record the exact unavailable capability and use fresh text extraction/rendering/OCR only in memory/stdout. Do
not claim to have used vision unless the trace shows it. Do not read existing JSON, extracted text, notes,
spreadsheets, sidecars, caches, summaries, answer keys, or derived financial files. Do not create, modify, rename,
move, or delete files; persist records; or prepare/perform payments.

State each material PDF's actual extraction method. Report unavailable capabilities and coverage impact.

Count an amount only when an original PDF supports a completed or settled payment dated within the inclusive period.
Do not treat invoice/assessment tax, a liability or filing period, due/submission date, remittance acknowledgement,
payment instruction, confirmation, or scheduled transaction as settlement unless the PDF clearly shows completion or
settlement. Keep those candidates distinct. Exclude and explain unclear or out-of-period items.

Detect likely duplicates and do not double count them. Report refunds and reversals separately; show gross payments,
refunds/reversals, and net amounts without silent netting. Preserve source currencies, never combine currencies, and
do not invent exchange rates. If status, settlement date, tax type, amount, currency, page, or identity is unclear,
exclude the item from confirmed totals and report insufficient evidence rather than guessing.

Report:
1. Root/dates, PDFs inspected, discovery, native visual-input availability and result, and extraction method per
   material PDF, unreadable PDFs, unavailable capabilities, and coverage limits.
2. One row per candidate: tax type, amount, currency, relevant dates, settlement date, classification/status,
   included/excluded reason, and `filename, page N` citation.
3. Reproducible line-item arithmetic by tax type and currency, then overall totals per currency. Show gross payments,
   refunds/reversals, and net separately when applicable.
4. Material exclusions: liabilities/invoice tax, filings/remittances, confirmations, scheduled items, duplicates,
   refunds/reversals, out-of-period items, and unclear evidence.
5. Confirmed result per currency, marked partial when applicable, or an explicit insufficient-evidence conclusion with
   what original evidence is missing.

Cite every included amount and material exclusion to an original PDF filename and page. Do not expose unrelated
records, unrestricted extracted text, credentials, or raw account identifiers. Do not claim professional tax advice
or independent financial review.
```

## Evaluator boundary and paired-JSON verification

This section is evaluator/harness guidance, outside the initial model prompt. The human-authorized test harness may
render original PDF pages and capture private evidence in its authorized runtime workspace outside the canonical
source root. It must not mutate canonical source files or run the data-processing pipeline. The test agent remains
read-only and receives only the permitted original PDF/page visual inputs; its no-write and no-sidecar constraints
remain in force.

Capture the blind test-agent output and its actual visual-input trace before the evaluator opens or prepares the paired parsed JSON.
Do not include JSON, parsed fields, expected answers, or evaluator findings in the test agent's context or tools. Pair records by
exact existing source linkage or an unambiguous matching stem within the authorized source set. If a pairing is
ambiguous, stop that comparison and record it as unavailable. Missing JSON may be prepared only with explicit human
authorization, from the original PDF after blind capture, in the evaluator's private runtime workspace; never use
the test agent's output or desired answers to prepare it. Without that authorization, missing pairing remains unavailable.

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
