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

All numbers should be treated as empirical baselines for the stated hardware, runtime, model, quantization, and configuration rather than general model-performance claims.
