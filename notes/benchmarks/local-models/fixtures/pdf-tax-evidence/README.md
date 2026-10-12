# Fictional PDF tax evidence

This is the normative scenario for a public, blind PDF-vision benchmark. Every
party, reference and transaction is fictional. The documents are deliberately
simple test records, not government forms or professional tax examples.

The actor inspects nine PDF pages for Canada/Quebec GST/QST evidence, extracts
printed fields, and reports payments for April 1-7, 2026 and Q2 (April 1-June 30,
2026), both inclusive. Only settled payments and completed refunds count.
Deduplicate identical transaction IDs; keep currencies separate. Missing
currency remains null even when the amount includes a dollar sign. Scheduled
payments and liabilities are not settled payments. Do not infer settlement or
currency from tax context. Report exclusions and contradictory/missing evidence.

| Document | Scenario | Expected treatment |
| --- | --- | --- |
| receipt-01 | Settled GST 100 CAD, April 3 | Include |
| receipt-02 | Settled QST 200 CAD, April 6 | Include |
| receipt-03 | Duplicate of receipt-01 transaction | Exclude duplicate |
| receipt-04 | Scheduled GST 300 CAD, April 5 | Exclude unsettled |
| receipt-05 | QST liability 400 CAD, April 4 | Exclude liability |
| receipt-06 | Settled QST 500 CAD, July 1 | Exclude outside either period |
| receipt-07 | Completed GST refund 20 CAD, April 7 | Subtract refund |
| receipt-08 | Settled GST 25 USD, May 2 | Include as USD in quarter only |
| receipt-09 | Settled GST $30, currency blank, April 4 | Exclude unknown currency |

Both periods yield CAD gross 300, refunds 20, net 280. The first week has
USD gross/refunds/net 0; the quarter has USD gross/net 25 and refunds 0. The USD tax entry is an unusual synthetic currency-preservation
challenge, not a representation of accepted tax payment practice.

`expected.json` is verifier-only: never pass it, this README, or the generator
to Pi. Give the agent only rendered pages and the selected `.prompt.md` task.
The independent verifier checks the document fields and totals after the run;
completion is not correctness. Keep run timing and configuration with actual
results, including failures. Public evidence can include these fictional PDFs
and results, but never private documents or profile/runtime secrets.

Run `python3 generate.py` with ReportLab installed to reproduce all nine PDFs.
The generator uses invariant PDF metadata and fixed document content. Each
`documents/receipt-NN.pdf` has one page. `expected.json` schema version 1 uses
`documents` entries with `document`, `file`, `page`, `expected` fields
(transaction_id, tax_type, amount, currency, date, status), and `periods` with
inclusive dates, included_documents, excluded_documents and currency_totals.

## Reproduce a benchmark run

[run-pi.py](run-pi.py) renders the PDFs, runs blind page extraction and period
aggregation, and records independent verification. [verify.py](verify.py)
contains the deterministic field and totals checks. The agent tasks are
[page-extraction.prompt.md](page-extraction.prompt.md) and
[period-totals.prompt.md](period-totals.prompt.md); `.prompt.md` identifies files
whose text is sent to the model.

Prerequisites are Python 3, Pi, a verified Poppler `pdftoppm` renderer, and a
provider/model declaration supporting image input. ReportLab is needed only to
regenerate the fixture with `generate.py`. Resolve Pi and the renderer explicitly
before inference. Run from the repository root, replacing the placeholders:

```sh
python3 notes/benchmarks/local-models/fixtures/pdf-tax-evidence/run-pi.py \
  --agent-dir PRIVATE_AGENT_DIR \
  --provider PROVIDER \
  --model MODEL \
  --renderer VERIFIED_RENDERER_PATH \
  --run-root notes/benchmarks/local-models/runs/UNIQUE_RUN \
  --date YYYY-MM-DD \
  --results models/MODEL/benchmarks/HARDWARE/RESULT.json
```

Use a new run root that does not already exist and a distinct results filename.
The runner reads only inert provider/model transport data from the private agent
configuration; it does not adopt workflow roles, hooks, or workflow context.
The isolated run retains private transport configuration and raw logs under the
Git-ignored run root. Never give the expected answer key to the model: only page
images and extraction instructions go to vision; aggregation receives the
model's extracted records, not the expected records.

The [first recorded public run](../../../../../models/qwen3.8-flash-next/benchmarks/gx10/pdf-tax-fictional-pi-2026-10-12.json)
passed all nine page extractions and the week aggregation. Quarter aggregation
failed arithmetic, reporting CAD gross 100/net 80 instead of gross 300/net 280.
Deterministic aggregation of the extracted records passed both periods. Total
wall time was 100.045 seconds, including preflight, isolated configuration,
rendering, inference, and verification; fixture generation and manual visual QA
are excluded. This measures simple fictional layouts and does not establish
production tax reliability.
