# Weekly tax paid from original PDFs

Medium-scale public benchmark. The profile supplies only the authorized root, dates, and model. Platform safety/read
scope apply. Do not load or follow any other workflow instructions. Follow this scenario only. It bypasses workflow
processing, initializes no role, and authorizes no financial action.

Native visual input is permitted only after the serving and Pi prerequisites in
[`../../../ai-commands/install/ai-local-provider/multimodal-serving.md`](../../../ai-commands/install/ai-local-provider/multimodal-serving.md)
have passed. This reference is benchmark documentation, not scenario prompt content.

## Runtime inputs

Launch context supplies `CANONICAL_DATA_ROOT`, inclusive `PERIOD_START` and `PERIOD_END` (`YYYY-MM-DD`) defining one
selected calendar week. No real path, period, or expected answer belongs in this scenario.

## Initial prompt

```text
Determine taxes actually paid during the supplied calendar week from original PDFs only.

Context supplies CANONICAL_DATA_ROOT and inclusive PERIOD_START/PERIOD_END. Before reading financial data, verify the
root and explicit, unambiguous, ordered dates. If anything is missing or invalid, ask once for all corrections and stop
without listing the root. Never broaden or replace the root or dates.

Obey platform safety/read scope. Do not load or follow any other workflow instructions. Follow this scenario only. Do
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
