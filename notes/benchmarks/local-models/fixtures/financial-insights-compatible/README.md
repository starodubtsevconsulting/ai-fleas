# Fictional Financial Insights compatible benchmark

The normative behavior is
[Financial Insights compatible extraction and visual verification](../../../../../ai-workflows/financial-insights/acceptance/financial-insights-compatible.scenario.md).
This additive fixture exercises the real payroll-tax `financial-records`
preparation path and a JSON-aware visual checker using fictional supported
forms. The existing [blind PDF tax fixture](../pdf-tax-evidence/README.md)
remains a separate benchmark.

The model's instructions use `.prompt.md`; the normative business scenario
uses `.scenario.md`. Do not pass this README, generator or independently
verified expected answers to the model. The contextual visual arm deliberately
receives the mechanical candidate JSON and original page images. Seeded wrong
candidates test whether that context causes blind agreement.

## Record layout and scope

Layout revision 2 mirrors the full corporate storage root with one fictional
organization and all four 2026 quarters:

```text
data/corporate/
  reports/2026/example-consulting/
    q1/{in/, out/taxes/, statements/}
    q2/{in/, out/taxes/, statements/}
    q3/{in/, out/taxes/, statements/}
    q4/{in/, out/taxes/, statements/}
```

`in` reserves incoming invoices, `out` outgoing/vendor documents with its tax
section, and `statements` bank/account evidence. Empty sections contain
explanatory README placeholders, not invented records or test passes.
The three supported payroll PDFs retain their exact contents in Q4 staging.
The year/business/quarter structure follows the shared `statements` and `taxes`
filesystem-provider contract. Q1-Q3 remain unpopulated and untested.

Historical October 12 benchmark JSON records retain revision 1 `data/reports`
paths and their original source hashes. Their measured runs were not repeated
for this additive structure change; revision 2 changes storage layout only.
The mechanical command root is `data/corporate/reports`, not its parent or the quarter:

```text
data/corporate/reports/2026/example-consulting/q4/
  incoming/unprocessed/
    federal-confirmation.pdf
    quebec-confirmation.pdf
    quebec-obligation.pdf
  out/taxes/payroll-remittances/
    ca-federal/2026-09-30/
    ca-qc/2026-09-30/
```

Prepare proposals target canonical obligation or submission-confirmation PDFs
with adjacent `<pdf>.json` sidecars. The September reporting period remains Q3;
Q4 holds later operational submission activity. Read-only benchmark preparation
does not publish this proposed state or bypass review gates. Run artifacts
must keep unmodified originals separate from evaluator-seeded candidate copies.

The initial scope is federal confirmation, Quebec confirmation and Quebec
obligation forms. The adapter supports four payroll document roles; this first
fixture covers three. Familiar visual labels and structure matter; simple generic
receipts cannot substitute for supported forms. No private document contents,
identifiers, paths or values belong in these files. GST/QST workflow context
does not imply an implemented GST/QST mechanical adapter.
The report hierarchy has the same levels as the workflow; the readable form
layouts are synthetic, not pixel-identical copies of private forms.

## Comparison and evidence

Compare mechanical-only extraction and Pi contextual visual verification under
explicit variant settings. Record the exact platform, harness, model binding,
context/output limits, sampling, thinking and verification mode. Other harnesses
need implemented adapters before a run can claim success. Variants do not
modify operational profiles or register live agents.

The evaluator independently scores correct controls plus wrong total, date,
status and currency candidates. Report false positives and false negatives,
omissions, field accuracy, per-stage runtime, complete runtime and available
tokens. Never infer correctness from an exit code or JSON validity. Record
unavailable metrics and blocked stages explicitly. Public evidence may include
fictional original PDFs, proposals, verification output and sanitized metrics;
transport secrets and real financial evidence remain private.

## Selecting configuration

Operational platform selection resolves profile default, then workflow platform,
then role platform override. Reuse that existing hierarchy and the selected
profile's registered commands; a test variant ID is never workflow authority,
a new work profile or another harness selector. The
[Pi command contract](../../../../../ai-commands/system/pi-agents/pi-agents.command.md)
defines version-2 workflow `models.main`, auxiliary bindings and optional
`model_choices`. `--model ALIAS` selects a configured choice; it cannot invent a
catalog model or endpoint.

For example, an operator can compare `mechanical-only` and
`pi-contextual-check-MODEL_ALIAS` variants, resolving the alias through the
authorized provider catalog and recording all effective settings. Configure
alternate model choices in the selected private profile under the existing
version-2 contract; do not change public defaults for a benchmark. Scenario
launches are ordinary bounded Pi sessions, not managed-roster initialization.
The fixture test adapter may call the actual exported payroll preparation
engine without pretending to execute an authorized operational profile route.
Its schema-2 snapshots remain review-pending proposals, not normalized sidecars.

A generic Hermes vision adapter is not established by this fixture. Record it
as blocked until an implemented adapter proves image delivery and preserves the
same scope and evaluator contract. Model/harness comparisons require actual
runs, not merely matching configuration labels.

## Reproduce a run

Run from the repository root using fresh output paths. Variant names resolve
the explicit `adapter` in [variants.json](variants.json), not an implicit adapter
guessed from their names. `--variants FILE` selects another versioned declaration.

```sh
python3 notes/benchmarks/local-models/fixtures/financial-insights-compatible/run.py \
  --variant mechanical-only \
  --run-root notes/benchmarks/local-models/runs/FRESH_MECHANICAL_RUN \
  --results PUBLIC_RESULTS.json --date YYYY-MM-DD
```

For the Pi contextual arm, use `--variant pi-json-aware` and add
`--agent-dir PRIVATE_AGENT_DIR --provider PROVIDER_ALIAS --model MODEL_ID`.
Resolve the transport aliases from the selected authorized configuration before
running. Optional typed provider/model bindings in a variant must agree with
these CLI selections. Context and output caps may not exceed the selected
declared model; it must declare image input. Optional sampling settings include
temperature and top-p. Sol effective configuration requires low reasoning.
Thinking controls must be compatible with the actual server request contract;
they are not permission to bootstrap arbitrary providers or profiles.

`--variant hermes-json-aware --harness-source PRIVATE_SOURCE_ROOT` performs an
installed-harness compatibility check only. The captured selection requested
8192 tokens against a 64000-token Hermes minimum, so it blocked before inference.
Even a larger context would not establish an isolated runtime adapter; that
boundary remains unverified. Keep private paths out of public results.

## Recorded results

The [mechanical-only run](../../../../../models/qwen3.8-flash-next/benchmarks/gx10/financial-insights-compatible-pi-2026-10-12.mechanical.json)
passed 37/37 extracted fields, all three documents and all three destination
proposals in 1.885 seconds. This measures the actual exported command engine's
prepare operation, not normalized sidecar publication.

The [Pi JSON-aware run](../../../../../models/qwen3.8-flash-next/benchmarks/gx10/financial-insights-compatible-pi-2026-10-12.json)
passed all seven checks: 83/83 field decisions, including 6/6 seeded
contradictions, with no false acceptance or rejection. Full wall time was
259.875 seconds; visual calls totaled 252.177 seconds and 23,585 tokens.
Mechanical-only timing is a separately measured cached-environment run; do not
derive a general speed ratio from these measurements.

The [Hermes preflight](../../../../../models/qwen3.8-flash-next/benchmarks/gx10/financial-insights-compatible-pi-2026-10-12.hermes.json)
records a blocked compatibility check and no inference. These three results do
not establish portability across all harnesses or production accuracy.

After capture, the evaluator was corrected to accept short exact source quotes
and normalize the equivalent printed provider status to its schema enum. Raw
responses and captured snapshots were preserved; re-evaluation is not another
model run. All conclusions remain bounded to these readable fictional forms.
Vision findings are advisory: human review is pending, and no publication or
independent-review gate was satisfied by the model's success.
