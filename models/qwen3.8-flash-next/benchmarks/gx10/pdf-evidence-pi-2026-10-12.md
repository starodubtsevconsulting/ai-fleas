# Pi PDF evidence benchmark reporting

Benchmark reporting date: 2026-10-12. This methodology covers the public single,
week and quarter PDF tax-evidence scenarios. It contains no financial findings.

## Public record for every run

Record every attempted run, including blocked, failed and incomplete runs, in a
sanitized public metrics record after checking it against this allowlist. Keep
raw traces, source documents and financial reports private. Use a benchmark-local
run ID unrelated to profile, task, account or source-document identity.

Allowed public fields are:

* benchmark-local run ID, benchmark date, task version and generic public scenario
  reference;
* actual served model ID, quantization, verified projector artifact identifier,
  runtime context size, harness name/version, output limit, tool/output limits,
  isolation controls and extraction/attachment method;
* measured wall time, input/output/total token counts, API-call count, tool-call
  counts by tool, stop reasons, completion status and aggregate coverage counts;
* verifier method and result, and explicit limitations or capability gaps stated
  without private source details.

Missing measurements and unverified properties are `null`, not zero or inferred
values. Record actual runtime context (8192 for the inspected binding), rather
than the model's advertised training context. Distinguish requested output limit
from observed output tokens. Count every attempt separately; do not hide failed
attempts inside a successful retry. Only include aggregate coverage counts when
they cannot disclose financial content or identities.

Never publish private roots or paths, source filenames, person/organization names,
financial amounts, source-document dates, source content, prompts containing
private inputs, raw traces, private task/profile/account identifiers, or hashes
of financial contents. Public scenario references and benchmark dates are allowed;
they do not authorize publishing the selected financial period. Do not attach or
copy a private financial report into the public metrics record.

## Keep distinct tasks distinct

| Run family | Evidence required | Interpretation |
| --- | --- | --- |
| Standalone page vision | Trace shows rendered-page image attachment and model response | Page vision capability only; not autonomous discovery or quarter completion |
| Autonomous PDF scenario | Actual discovery/tool trace and cited final scenario report | Record failures and context/tool gaps; process exit zero alone is insufficient |
| Bounded text inference | Fresh stdout/in-memory extraction and cited model report within explicit batch limits | Text evidence task with stated partial coverage; not native visual inspection |

Do not combine these families into one quality score. A passed single-page vision
probe does not erase an autonomous scenario failure or establish whole-root tax
coverage. A one-token `length` stop without a report is incomplete even when the
process exits zero. A tool call is execution evidence, not task acceptance.

Before inference, verify the exact extractor/renderer executable and Pi's actual
PDF/image attachment support outside the model conversation. Supply concrete
machine paths only in private launch context. Bound discovery and inspect one
original PDF/page at a time. Keep canonical sources unchanged and Pi's scenario
no-write rules intact. For this human-authorized test, the harness may render
page images and capture private test evidence in its authorized runtime workspace
outside the canonical source root. This permits only test preparation and capture,
not intake, sidecar generation, normalization, persistence into the source data,
or other data-pipeline execution. Pi itself may not write files. If rendering is
unavailable within that boundary, record the capability gap and use only the
scenario's permitted fresh stdout/in-memory fallback, labeled as text/OCR rather
than vision.

## Blind vision and paired parsed-JSON comparison

Capture each Pi PDF/page output and visual-input trace before the evaluator opens
or prepares its paired parsed JSON. The JSON, parsed fields and expected answers must remain
outside Pi's context and tools. Separate evaluator access from the blind inference
run so parsed data cannot substitute for page vision.

Pair by exact existing source linkage or an unambiguous matching source stem in
the authorized source set. Ambiguous pairing makes that comparison unavailable;
never select an unrelated JSON or invent an expected answer. When explicitly
human-authorized, the evaluator may prepare missing JSON from the original PDF
in its private runtime workspace after blind capture. Never derive a baseline
from Pi's output or desired answers. Otherwise, missing pairing is unavailable.
Record pairing, preparation provenance and runtime references only privately.

Before calling a baseline usable, manually verify its literal, source-supported
fields against the relevant original pages. Keep normalized or inferred values
(such as an inferred currency) separate from visibly supported evidence. Record
corrections, uncertainties and page provenance in a private verifier overlay;
do not overwrite the existing source baseline without a separate request. A
prepared baseline requires the same source-page verification as an existing one.

Compare tax type, amount, currency, relevant dates, payment status and settlement
classification. Count matched, omitted, contradictory, unknown and unavailable
fields separately; unavailable or absent baseline fields are not correct matches.
Adjudicate disagreements against the original cited page because parsed JSON can
also be wrong. Record corrected-baseline and unresolved cases distinctly, without
claiming financial correctness from agreement alone. Verify inclusion/exclusion,
duplicate treatment and arithmetic separately from field extraction when the
scenario asks for period totals.

Retain raw page outputs, paired JSON, field comparisons, citations and any
adjudication privately. Publish sanitized aggregate comparison counts, comparison
status, aggregate baseline validation status and counts of prepared, verified or
corrected fields, and coverage limitations for every attempted page/run, including
failures and blocked comparisons. The public allowlist above still applies: no financial
values, source identities, private paths or source-content hashes. A bounded
selection of pages/candidates can establish extraction results only for that
selection; it does not prove complete week or quarter discovery or totals.

## Thinking-control evidence

Inspection of the installed Pi runtime reporting version 1.1.0 found that an
omitted custom-model `reasoning` property defaults to false. Its `--thinking off`
option does not itself emit `chat_template_kwargs`. Record the requested Pi
thinking level, observed outbound server control and observed server behavior as
separate observations. Derive harness version from the actual runtime's version
report, not its installation directory name.

The supported opt-in per-run extension hook can add the server control:

```javascript
export default function (pi) {
  pi.on("before_provider_request", (event) => ({
    ...event.payload,
    chat_template_kwargs: {
      ...(event.payload.chat_template_kwargs ?? {}),
      enable_thinking: false,
    },
  }));
}
```

Select the reviewed extension explicitly with `-e VERIFIED_EXTENSION_PATH` for
that run, preserving the scenario's context/skill/template/approval isolation
controls. Keep the concrete extension path private. This does not establish a
permanent configuration change or replace live verification. The subsequent bounded-text runs verified outbound
`chat_template_kwargs.enable_thinking: false` and produced final reports with
normal stops instead of output-budget exhaustion. Their financial acceptance
still failed. This proves the observed payload and report completion, not the
server's internal thinking setting. Missing observations remain `null`; requested
control alone is not a successful test.

## Scenario references

* [Single PDF](../../../../ai-workflows/financial-insights/acceptance/pdf-single-tax.scenario.md)
* [Week](../../../../ai-workflows/financial-insights/acceptance/pdf-week-tax.scenario.md)
* [Quarter](../../../../ai-workflows/financial-insights/acceptance/pdf-quarter-tax.scenario.md)
* [Pi launch contract](../../../../ai-commands/system/pi-agents/pi-agents.command.md)
