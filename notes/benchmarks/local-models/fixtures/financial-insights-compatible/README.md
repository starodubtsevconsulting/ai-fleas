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

Compare mechanical-only extraction and contextual visual verification under
profile-selected settings. Record the exact platform, harness, model binding,
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

## Selecting a reusable test profile

The task prompt and evaluator remain stable. A named test profile selects the
harness adapter, model binding, private transport and capability requirements,
with context/output limits, sampling and thinking resolved through its selected
variant manifest. These settings belong to configuration, not model instructions.
Test profiles do not initialize agents or change operational workflow profiles.
Unsupported adapters or capabilities fail closed before inference.

Copy [test-profiles.example.json](test-profiles.example.json) into a private
ignored configuration directory. Choose descriptive profile names appropriate
to your experiment. Profile paths resolve relative to that file. Unknown fields,
invalid types and conflicting CLI options are rejected. Use existing authorized
transport/model bindings; a profile name does not establish authority.

```sh
python3 notes/benchmarks/local-models/fixtures/financial-insights-compatible/run.py \
  --test-profile PROFILE_NAME --profile-config PRIVATE_PROFILE_CONFIG \
  --check-profile
```

Omit `--check-profile` to execute. Optional `--run-root FRESH_RUN_ROOT` and
`--results FRESH_RESULTS_JSON` select fresh outputs; existing paths are never
overwritten. Otherwise outputs go to a unique ignored visible run directory.
Every invocation verifies actual served model, context and native image modality
through a bounded live check. A saved receipt or declaration cannot replace it.
Selected adapters must observe actual images and request controls, use fresh
isolated harness state, and preserve the no-tools visual-check boundary.
Changing profiles does not itself restart or reconfigure the shared server.
Verify runtime capacity afresh rather than placing a fixed capacity in this task.

For operational workflow use, retain the existing profile-default, workflow and
role platform precedence. Test settings remain separate from those bindings.
The mechanical adapter calls the actual exported preparation engine and keeps
schema-2 snapshots review-pending; it does not publish normalized sidecars.

## Evidence index

Historical results retain their original filenames, configurations and measured
values. They do not establish production reliability or a universal ranking.

- [Historical mechanical run](../../../../../models/qwen3.8-flash-next/benchmarks/gx10/financial-insights-compatible-pi-2026-10-12.mechanical.json).
- [Historical contextual run](../../../../../models/qwen3.8-flash-next/benchmarks/gx10/financial-insights-compatible-pi-2026-10-12.json).
- [Historical blocked preflight](../../../../../models/qwen3.8-flash-next/benchmarks/gx10/financial-insights-compatible-pi-2026-10-12.hermes.json).
- [Matched configuration comparison and its captured results](../../../../../models/qwen3.8-flash-next/benchmarks/gx10/financial-insights-compatible-harness-comparison-2026-10-12.md).

After the initial capture, the evaluator was corrected to accept short exact
source quotes and normalize an equivalent printed provider status to its enum.
Raw responses and snapshots were preserved; re-evaluation was not a new model
run. Historical comparison source versions remain immutable. Public version
metadata is bounded to its first line; full diagnostic output stays private.
All results concern synthetic readable forms. Vision is advisory; human review
and publication gates remain outstanding.
