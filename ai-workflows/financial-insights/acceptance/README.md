# Financial Insights benchmark prompts

Model assignment documents use `<domain>-<scope>.prompt.md`. The `Initial prompt` text fence is the model input; runtime-input descriptions, prerequisites and evaluator guidance outside it are harness documentation. Keep exactly one text fence so the launcher can select that input without leaking evaluator instructions.

- [Single PDF](pdf-single-tax.prompt.md): one named original PDF.
- [Week](pdf-week-tax.prompt.md): confirmed payments within inclusive supplied dates.
- [Quarter](pdf-quarter-tax.prompt.md): confirmed payments within a supplied quarter.

Use `.scenario.md` for normative behavior/scenario documents rather than the filename of these model assignments. This convention is scoped to these benchmark prompts; unrelated repository files are unchanged. Historical benchmark JSON retains its original `.scenario.md` task paths as execution evidence.

The [fictional public PDF fixture](../../../notes/benchmarks/local-models/fixtures/pdf-tax-evidence/README.md) provides shareable test inputs and evaluator references. Only its model-input PDFs belong in the model read boundary. JSON and expected answers are evaluator-only, even when all fixture data is public. Runtime context selects the authorized root and dates; the generic prompts do not hardcode fixture paths. Keep private financial inputs, source linkage and raw comparisons private.

Single-page results do not establish week or quarter completeness. Unknown evidence and unavailable vision remain explicit outcomes; period tasks must separately report discovery, coverage, exclusions and arithmetic.

The [Financial Insights compatible scenario](financial-insights-compatible.scenario.md)
defines a separate workflow-shaped benchmark: supported fictional payroll forms,
actual mechanical preparation, then contextual visual verification of candidate
JSON with seeded-error controls. Its [fixture overview](../../../notes/benchmarks/local-models/fixtures/financial-insights-compatible/README.md)
preserves the report hierarchy and canonical destination contract. It does not
replace blind-vision evidence or authorize canonical publication.
