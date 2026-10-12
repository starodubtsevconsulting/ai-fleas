# Fictional Financial Insights challenge data

This public, self-contained dataset contains five invented payroll source PDFs
for extraction and visual-verification edge cases. It is separate from the
supported three-document baseline in `../financial-insights/`; do not mix its
files, hashes, facts, or benchmark observations with that baseline.

Run `python3 generate.py` from this directory to recreate the five source PDFs,
their evaluator-only `expected.json`, and manually reviewed `transcripts.json`.
All source PDFs belong under the contained corporate reports root:

```text
corporate/reports/2026/example-consulting/q4/incoming/unprocessed/
```

The expected facts and transcripts are evaluator-only. They are not model
input, OCR output, normalized sidecars, or approval to publish records. The
challenge fixture contract is defined in
`ai-workflows/financial-insights/acceptance/financial-insights-challenges.scenario.md`.

Every form has a visible `FICTIONAL TEST FIXTURE` banner and invented data.
