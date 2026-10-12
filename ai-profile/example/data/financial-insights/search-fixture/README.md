# Fictional Q4 search and reconciliation fixture

This additive fixture exercises retrieval across three invented businesses in
Q4 2026. It contains three customer invoices, four unique AI-compute vendor
invoices, one cloud-storage decoy, one credit note, one duplicate invoice copy,
and three synthetic CSV account statements. Generic PDF names require the
reader to inspect document contents and compare invoice references across
business folders.

The records are stored in the ordinary profile-owned report tree:

```text
corporate/reports/2026/{example-consulting,example-lodging,example-media}/q4/
  in/                    customer invoices
  out/expenses/          vendor invoices and credit note
  statements/            synthetic Q4 CSV activity
```

`generate.py` reproducibly creates the ten one-page PDFs, three CSV statements,
and evaluator-only `expected.json`. The answer key carries exact source paths
and SHA-256 hashes. All names, references, dates, amounts, and records are
fictional; amounts are CAD. The expected data is not source evidence and must
not be included in a model's prompt.

The core retrieval check finds unique AI-compute invoice amounts while
excluding cloud storage and the duplicate copy. It separately accounts for a
credit and a refund, matches statement rows by invoice reference, and reports
invoices with no payment evidence without guessing their status. The sample
client invoices provide a separate `in/` lookup case.

The CSV statements are synthetic evidence for manual retrieval and matching;
the current `statements` command reads PDF statements and does not parse this
fixture's CSV files. Ordinary vendor `Out` invoice normalization is also not
supported by the current `financial-records` implementation. This fixture
therefore tests finding and reasoning from existing evidence only; it grants no
write, normalization, tax-credit, or payment authority.

Run the generator from any directory with Python and ReportLab:

```bash
python3 ai-profile/example/data/financial-insights/search-fixture/generate.py
```

The Q4 prompt requires a JSON response with records, source citations, payment
statuses, and calculated totals. After saving a model response as JSON, score it
against the hidden answer key with:

```bash
python3 ai-profile/example/data/financial-insights/search-fixture/evaluate_response.py path/to/response.json
```

The evaluator reports passed checks and factual/evidence errors. Run its
standard-library positive and negative tests with:

```bash
python3 -m unittest discover -s ai-profile/example/data/financial-insights/search-fixture -p 'test_*.py' -v
```

The score checks each source record, document/folder business, amount and
currency, duplicate and storage-decoy treatment, payment evidence and status,
exact PDF and statement citations, and the headline arithmetic. The expected
file remains evaluator-only; it is not injected into the prompt.
