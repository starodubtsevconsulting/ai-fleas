# Financial Insights compatible extraction and visual verification

This is the normative business scenario for a fictional, public benchmark of
Financial Insights record preparation. The human requests structured extraction
from original PDFs, then a contextual visual check of the resulting candidate
JSON. The benchmark operator selects an explicit execution variant; an
independent deterministic evaluator checks the result against human-verified
printed facts. This scenario grants no operational workflow or publication
authority.

The [tax payment flow](../flows/tax-payment.flow.md) owns canonical naming,
review, persistence and lifecycle semantics. The
[financial-records contract](../../../ai-commands/data/financial-records/financial-records.command.md)
owns the executable extraction behavior. Do not duplicate its recognizers in a
model prompt. This fixture covers supported federal and Quebec payroll-tax
forms; it makes no claim that the command supports GST/QST forms.

## Prerequisites and layout

Profile data layout revision 4 stores the fictional corporate records under
`ai-profile/example/data/financial-insights/`. Financial records belong to their
human-owned profile; reusable workflows and benchmark tools consume selected
data rather than owning it. The complete 2026 organization/quarter skeleton remains. All identities, amounts, references and document contents are fictional and
independently inspectable. Original forms preserve the supported layout and
labels without copying private identifiers or source values. The command root
is `ai-profile/example/data/financial-insights/corporate/reports`, containing `2026/example-consulting/q4/`; unprocessed originals are
staged separately from the proposed canonical bundle:

```text
ai-profile/example/data/financial-insights/corporate/
  reports/2026/example-consulting/
    q1/{in/, out/taxes/, statements/}
    q2/{in/, out/taxes/, statements/}
    q3/{in/, out/taxes/, statements/}
    q4/{in/, out/taxes/, statements/}
```

The `in` folders reserve incoming invoices and source documents; `out` reserves
outgoing/vendor evidence with its tax section; `statements` reserves bank/account
activity. Explanatory placeholders track empty sections without pretending that
an invoice, bank statement, tax summary or completed sidecar exists. The corporate
root groups the fictional organization; the command root remains its `reports`
child so the engine still receives the normative year/business/quarter tree.
Q1-Q3 are empty skeletons, not newly exercised benchmark periods.

The existing three source PDFs remain in Q4 staging:

```text
ai-profile/example/data/financial-insights/corporate/reports/2026/example-consulting/q4/
  incoming/unprocessed/
    federal-confirmation.pdf
    quebec-confirmation.pdf
    quebec-obligation.pdf
  out/taxes/payroll-remittances/
    ca-federal/2026-09-30/
    ca-qc/2026-09-30/
```

Recorded benchmark evidence from layout revision 1 retains its original
`data/reports` paths and source hashes; do not rewrite historical results to
claim it ran against a later layout. Revision 2 records retain their original
benchmark-local corporate paths. Revision 3 used workflow-owned storage; revision 4 relocates the unchanged PDF
bytes and empty sections to the public example profile; logical destination proposals stay
unchanged. The dataset generator and evaluator-only expected facts live beside the profile
data. Expected facts are reference answers, not approved normalized sidecars,
and are never model input. Harness runners, prompts, evaluators and metrics remain in their
benchmark locations and copy only this fictional workflow tree into isolated
run storage.

The reporting period remains Q3 ending September 30, 2026. Q4 is the open
operational bucket for later submission activity. Destination proposals must
preserve that distinction and the command's canonical obligation/confirmation
filenames. The run root is an isolated fictional input/output boundary within
the visible checkout, not a production report store. Adjacent canonical
`<pdf>.json` paths are asserted proposals; their presence must not be fabricated
as evidence of approved normalization.

The evaluator's answer key is derived from visual inspection of each original
page and checked arithmetic. It is never supplied as model input. Candidate
JSON from mechanical preparation is allowed visual-check input; an independently
verified answer key is not.

## FI-COMPAT-1: mechanical preparation

1. Copy only the fictional originals into a fresh contained run input root.
2. Invoke the actual registered `financial-records prepare-tax-from-source`
   operation with explicit root, source, branch, year, open quarter and `out`
   section context. A test adapter may call the command's actual exported
   preparation engine, as its unit tests do; identify that execution route and
   do not invent profile authorization. Retain actual errors and bounded JSON
   output (and the exit status for executable routes).
3. Preserve originals and record source hashes. Save the read-only proposal as
   a schema-2 review-pending benchmark artifact; assert document role, jurisdiction, reporting period,
   dates, components, totals, currency provenance, lifecycle and destination.
4. Evaluate candidate fields against independently checked original-page facts.
   Record failures, unsupported cases and review warnings honestly.

Preparation is not publication. Do not call apply, invent a human approval,
initialize agents or treat a model check as the required independent reviewer.
Any OCR-only human-verification requirement remains outstanding.

## FI-COMPAT-2: contextual visual verification

1. Give the selected model the original rendered page image and the mechanical
   candidate JSON, plus form family, Canada/Quebec context and field meanings.
2. Ask it to report each checked field as match, contradiction or unknown,
   with document/page evidence, the printed value where visible, and proposed
   corrections. Preserve distinctions among printed, inferred and unsupported
   values. A dollar sign and jurisdiction context alone do not establish a
   printed currency code. A submission, schedule or print date does not prove
   settlement or a different date role.
3. Save the model response and evaluate its schema and evidence. Do not
   automatically overwrite candidate JSON or canonical records.

This measures informed verification. Keep the existing blind PDF-vision
benchmark separate: its model does not see candidate JSON, so its results are
not interchangeable with this contextual task.

## FI-COMPAT-3: confirmation-bias and failure controls

Run unchanged candidates and copies with one evaluator-seeded wrong total,
date, settlement state or currency. Preserve originals and unmodified proposals.
The visual checker must identify the seeded contradiction without falsely
rejecting correct printed facts. Unsupported assertions must remain unknown or
be identified as unsupported; no guess counts as a correction.

The deterministic evaluator reports field matches, contradictions detected,
omissions, false positives and false negatives, with separate unchanged and
tampered-case denominators. A completed process is not a passed test. Missing
images, malformed JSON, incomplete page coverage, unavailable transport or
unsupported adapter produces a failed or blocked observation, never a pass.

## Variants, evidence and stop condition

A variant declares platform, harness, exact model binding, context/output
limits, sampling, thinking setting and verification mode. Support mechanical-only
and profile-selected JSON-aware visual-check arms with the same fixture and evaluator.
Unimplemented platform adapters remain blocked; configuration labels alone do
not prove portability. Operational profiles keep their existing registered
settings. A benchmark variant authorizes only the fictional run root and does
not register agents or create another operational sub-profile.

For every run preserve fixture/schema versions, source hashes, exact bounded
command arguments, prompt identity, effective configuration, exit statuses,
field-level outcomes and stage/whole-run wall time. Record model latency and
tokens when available; distinguish unavailable metrics from zero. State whether
setup, fixture generation and manual inspection are excluded from timing.
Public results contain only fictional evidence and sanitized configuration;
private transport settings, credentials and real financial documents stay out.

Finish when each selected arm has an observed passed, failed or blocked result,
the evaluator has scored controls and seeded cases, and shareable evidence
records limitations. An accuracy failure is a benchmark finding, not permission
to rewrite the answer key or claim production readiness.

## Matched harness comparison

A trial compares profile-selected harnesses using the same fictional pages,
candidates, task, evaluator and model artifact. Resolve matching context/output,
sampling and thinking settings from their configurations. Verify actual served
capacity before inference. Use fresh isolated harness state and observe actual
images, model and request controls. Reject fallback, unrequested tools or
auxiliary model calls, missing control evidence and unsupported capabilities.
Do not change operational profiles or imitate independent review.

Record native system-prompt differences and available API latency/tokens.
Wall time less observed API duration is combined non-inference overhead, not
pure startup time. A single pair is evidence for its configuration, not a stable
ranking. Preserve historical captured results unchanged.

## Reusable test profiles

Named benchmark test profiles select an existing variant, private transport,
model and installed harness source; they are not operational workflow profiles.
Every named-profile run first checks an explicitly configured live `/props`
endpoint for the same model alias, requested actual context and image modality.
A saved receipt cannot replace this fresh check. Probe URLs must use the selected
provider's hostname and scheme, exactly `/props`, no userinfo/query/fragment;
redirects are rejected so private headers cannot cross hosts.

Profile paths resolve relative to the private configuration file. Reject unknown
fields, invalid types and conflicting CLI settings. Settings such as context,
output, sampling and thinking stay in the existing variant manifest rather than
being duplicated in profiles. `--check-profile` performs a read-only live check
without inference or creating directories. Actual runs use a fresh isolated home
and output boundary. Switching harnesses changes no server service or operational
profile. Runtime capacity is verified per run; configuration changes remain
separate authorized operations.

## Selected profile data

The default dataset is the fully fictional public example profile. `--data-root`
or a private test profile's `data_root` selects an explicit source; discovery of
another profile never authorizes reading its records. The data root contains its
own generator, reference facts and corporate tree. Before copying sources, require
`expected.json` to declare `fictional: true`, validate contained source paths,
reject symlinks and reject unlisted financial files. These public comparison
runs remain fictional-only; real profile data is not automatically copied or
exported. Default run outputs remain private ignored artifacts until separately
reviewed for publication.
