# Fictional Financial Insights workflow data

This directory owns public fictional financial source data for Financial Insights.
It contains the invented Example Consulting organization, the 2026 Q1-Q4 record
skeleton, and three supported fictional payroll forms. No real financial records,
organization identifiers, operational profiles or credentials are included.

```text
corporate/reports/2026/example-consulting/
  q1/{in/, out/taxes/, statements/}
  q2/{in/, out/taxes/, statements/}
  q3/{in/, out/taxes/, statements/}
  q4/{in/, out/taxes/, statements/}
    incoming/unprocessed/{three fictional payroll PDFs}
    out/taxes/payroll-remittances/{ca-federal,ca-qc}/2026-09-30/
```

`in` reserves incoming invoices and source documents, `out` outgoing evidence
with its tax section, and `statements` bank/account activity. Q1-Q3 are currently
empty. Q4 contains a federal submission confirmation, a Quebec submission
confirmation and a Quebec obligation. These original PDFs are unnormalized source
documents; the proposed payroll bundle folders contain no canonical PDFs or
reviewed sidecars. README placeholders keep empty sections tracked.

The command root is `corporate/reports`; reporting and operational periods remain
separate. The [workflow scenario](../acceptance/financial-insights-compatible.scenario.md)
owns intended behavior and normalization gates.

## Generation and reference facts

`generate.py` reproducibly writes the fictional source forms and empty skeleton.
Run it with Python plus ReportLab; use the available bundled document runtime.
`expected.json` contains independently inspectable evaluator-only facts and
canonical destination expectations. It is withheld from model input and is not
an approved normalized sidecar or authority to publish records.

## Consumers

[Local model tools](../../../notes/benchmarks/local-models/fixtures/financial-insights-compatible/README.md)
reference this single data source and copy it into ignored isolated runs.
Harness settings, prompts, evaluators and metrics remain outside this directory.

Layout revision 3 relocates unchanged revision 2 source bytes into workflow data.
Historical consumer records retain their original paths, hashes and measurements.
