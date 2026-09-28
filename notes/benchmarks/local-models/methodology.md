# Local Model Benchmark Methodology

The benchmarks are practical acceptance tests for local AI workers rather than attempts to produce universal model rankings.

## Goal

Find the strongest local model that can run at acceptable speed and reliability on the available hardware. The target is not simply the largest model that fits in memory, but a model capable enough to be useful as a real worker while remaining fast enough for sustained or on-demand operation.

## What is measured

Where practical, results record:

- model and quantization
- model size and memory residency
- configured and native context
- prompt-processing throughput
- generation throughput
- time to first token
- task wall time
- Hermes/tool-use compatibility
- independent verification of task output

## Controlled Hermes tool-use fixture

Worker-model comparisons use the checked-in [Hermes file-tools fixture](fixtures/hermes-file-tools/README.md). The model must use shell/filesystem tools to sort and deduplicate a fixed seven-line input, write normalized data and a computed report, and verify both files before completion. A separate script then compares the generated files byte-for-byte with the expected outputs.

The fixture, task text, success check, and timing boundary stay fixed across candidates. The run also retains the Hermes usage summary so input/output token counts and model API-call count can be reported alongside wall time.

## Controlled Hermes coding fixture

The checked-in [financial recognizer coding fixture](fixtures/hermes-financial-recognizer-coding/README.md) adds a
repeatable real-code task derived from the September 2026 Financial Insights exercise. It starts from the exact
French-only snow-removal recognizer that preceded the matched A2A/CLI experiment and asks the worker to add a bounded
English recognition path while preserving existing behavior and changing only one file.

Use this fixture when evaluating configuration changes that may affect **agent completion quality** rather than basic
tool compatibility, including context-compression policy, transport, model choice, or serving-runtime changes.

Keep the assignment and starter source fixed. Change one experimental variable at a time. Independent verification
checks behavior and scope after the worker stops. Record wall time, usage/API calls, unexpected files, and actual
process/gateway termination separately from the agent's completion prose.

The coding fixture does not replace the file-tools fixture: the file-tools task remains the simpler cross-model
compatibility baseline, while the coding task exercises a more realistic multi-turn implementation loop.

## Benchmark purpose profile

Every hardware/model report should state, before presenting numbers:

- the practical job being evaluated;
- the benchmark role of each candidate;
- intended users and workload shape;
- capabilities in and out of scope;
- the acceptance criteria for a practical winner;
- licensing or deployment constraints that can disqualify an otherwise strong result.

A benchmark result does not imply production eligibility. Quality, performance, operational fit, and license fit are separate decisions.

## Public-result privacy

Public benchmark artifacts use non-identifying hardware labels. They must not contain hostnames, IP addresses, account names, personal names, secret identifiers, private service URLs, tokens, or personal filesystem paths. Machine-specific operational evidence belongs in a private runbook; public reports retain only the sanitized facts needed to reproduce and interpret the result.

## Interpretation

Direct inference measurements and full Hermes-agent measurements answer different questions and should not be treated as interchangeable.

Direct tests primarily measure the model/runtime/hardware path. Hermes tests additionally include agent prompts, tool schemas, conversation history, scheduling, multiple model calls, and other orchestration overhead.

Operational tests using existing conversations are identified as such because their prompt size and history differ from controlled synthetic tests.

Cross-agent delegation exercises are recorded separately from the controlled fixture. They assess routing, task completion, scope compliance, timeout behavior, and independent review across the coordinator, transport, Hermes harness, model, and serving runtime. A failure in that chain should not be attributed to the model without diagnostic evidence. Report the exact transport and task boundary, distinguish observed behavior from recommendations, and do not add variable-task wall times to the controlled benchmark table.

All numbers should be treated as empirical baselines for the stated hardware, runtime, model, quantization, and configuration rather than general model-performance claims.
