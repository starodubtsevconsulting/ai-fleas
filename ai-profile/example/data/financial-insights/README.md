# Fictional example profile financial data

This directory owns public fictional financial source data for the human-owned example profile and its Financial Insights use cases.
It contains the invented Example Consulting organization and 2026 Q1-Q4 record
skeleton, three supported fictional payroll forms, and an additive Q4 search
fixture for three invented businesses. No real financial records, organization
identifiers, operational profiles or credentials are included.

The separate [fictional business-context map](business-context.md) illustrates
activities, income origins, accounts, service partners and money routes as clues.
Its invented confirmations and expectations are explicitly labelled; they do not
describe verified relationships in these benchmark fixtures or replace evaluator
reference facts.

```text
corporate/reports/2026/example-consulting/
  q1/{in/, out/taxes/, statements/}
  q2/{in/, out/taxes/, statements/}
  q3/{in/, out/taxes/, statements/}
  q4/{in/, out/taxes/, statements/}
    incoming/unprocessed/{three fictional payroll PDFs}
    out/taxes/payroll-remittances/{ca-federal,ca-qc}/2026-09-30/
corporate/reports/2026/{example-lodging,example-media}/q4/
  in/ out/expenses/ statements/
search-fixture/{generate.py,expected.json}
```

`in` reserves incoming invoices and source documents, `out` outgoing evidence
with its tax section, and `statements` bank/account activity. Q1-Q3 are currently
empty. Q4 contains a federal submission confirmation, a Quebec submission
confirmation and a Quebec obligation. These original PDFs are unnormalized source
documents; the proposed payroll bundle folders contain no canonical PDFs or
reviewed sidecars. The additive [`search-fixture`](search-fixture/README.md)
adds fictional Q4 customer invoices, vendor expenses, a credit, a duplicate,
and synthetic CSV statement rows across Example Consulting, Example Lodging,
and Example Media Studio. README placeholders keep empty sections tracked.

The command root is `corporate/reports`; reporting and operational periods remain
separate. The [workflow scenario](../../../../ai-workflows/financial-insights/acceptance/financial-insights-compatible.scenario.md)
owns intended behavior and normalization gates.

## Generation and reference facts

`generate.py` reproducibly writes the fictional source forms and empty skeleton.
Run it with Python plus ReportLab; use the available bundled document runtime.
`expected.json` contains independently inspectable evaluator-only facts and
canonical destination expectations. It is withheld from model input and is not
an approved normalized sidecar or authority to publish records.

## Consumers

[Local model tools](../../../../notes/benchmarks/local-models/fixtures/financial-insights-compatible/README.md)
reference this single data source and copy it into ignored isolated runs.
Harness settings, prompts, evaluators and metrics remain outside this directory.

Layout revision 4 relocates unchanged source bytes into their profile-owned home.
The reusable workflow does not own or duplicate financial data.
Historical consumer records retain their original paths, hashes and measurements.

The sibling [challenge dataset](../financial-insights-challenges/README.md) adds raster, sideways, multi-page and incomplete or conflicting source forms while keeping this dataset unchanged. Its source documents and evaluator references remain owned by the example human profile.
