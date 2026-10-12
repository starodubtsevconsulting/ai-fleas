# Quarterly tax paid from original PDFs

Standalone test using only the profile-selected folder/model under platform safety and read scope. Do not load or follow any other workflow instructions. Follow this scenario only. It bypasses intake, normalization, sidecars,
persistence, reconciliation, INIT, roster, and agents; initializes no role; and takes no financial action.

Native visual input is permitted only after the serving and Pi prerequisites in
[`../../../ai-commands/install/ai-local-provider/multimodal-serving.md`](../../../ai-commands/install/ai-local-provider/multimodal-serving.md)
have passed. This reference is benchmark documentation, not scenario prompt content.

## Runtime inputs

Launch context supplies `CANONICAL_DATA_ROOT` (authorized absolute folder), inclusive `PERIOD_START`/`PERIOD_END`
(`YYYY-MM-DD`), and optional quarter ID/definition. Resolve any quarter ID to explicit dates.

## Initial prompt

```text
Determine taxes actually paid during the selected quarter from original PDFs only.

Inputs are in the launch context: CANONICAL_DATA_ROOT, inclusive PERIOD_START and PERIOD_END, and optional quarter
identifier/definition.

Before reading financial data, verify the root and both dates are present, unambiguous, and ordered. If not, ask once
for every missing or ambiguous input, then stop without listing the folder or opening records. The supplied root is the
complete read boundary; never infer, broaden, or replace it.

Obey platform safety and the authorized read scope. Do not load or follow any other workflow instructions. Follow this scenario only. The profile supplies only folder/model selection. Do not run intake, recognition, normalization,
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
