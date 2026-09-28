# Hermes financial recognizer coding fixture

This is the controlled **coding** scenario derived from the September 27, 2026 Financial Insights / Hermes Coder exercise.

It complements the simpler [Hermes file-tools fixture](../hermes-file-tools/README.md). The file-tools fixture answers
“can this model use Hermes tools correctly?” This fixture answers a harder question:

> Can the same configured worker make one small real code change, preserve existing behavior, stay inside scope, and stop cleanly?

## Why this task

The task was already used in the matched GX10 transport exercise that compared Hermes A2A with Hermes CLI one-shot.
Both routes completed the one-file English snow-contract recognizer change and passed four independent behavior groups.
The observed wall times were roughly 90 seconds for A2A and 100 seconds for CLI in one run each. That was not enough
evidence to claim one transport was faster or produced better code.

This checked-in fixture freezes the starting source and assignment so future runtime/model/configuration experiments do
not silently change the workload.

## Fixed starting state

The starter recognizer is the exact French-only source from commit
`8fc4ef41a6e1049f323cf55fd45920912fbe5ce4`, before the matched English-recognition transport comparison.

The requested change is intentionally small and real:

- preserve French `CONTRAT + DÉNEIGEMENT + VERSEMENT/PAIEMENT`;
- add English `SNOW REMOVAL CONTRACT + PAYMENT`;
- preserve the existing result contract;
- write only the named recognizer file;
- create no tests/helpers/scratch files.

The independent verifier is not copied into the worker's run directory.

## CLI one-shot run

Use an already-realized Hermes profile so the run exercises that profile's actual model, context, compression, tools,
and provider configuration:

```sh
./notes/benchmarks/local-models/run-hermes-financial-recognizer-coding.sh \
  /tmp/qwen-recognizer-run sc-dev-5-coder
```

The runner:

1. creates the fixed starter tree;
2. sends the exact `TASK.md` through the selected Hermes profile;
3. records wall time and Hermes usage;
4. independently executes `verify.mjs`;
5. rejects unexpected files.

Use a fresh run directory for every trial.

## Matched A2A run

For an A2A comparison, use the same starter tree and exact `TASK.md` contents through the configured delegate launcher.
Do not add task guidance. Record:

- task ID and terminal A2A state;
- wall time to the caller's terminal state;
- whether the underlying Hermes gateway/turn actually stopped;
- model/API-call usage when available;
- verifier result;
- unexpected files.

Run the same independent verifier after the gateway/worker is confirmed stopped. A2A terminal state alone is not a
process-stop assertion.

## Configuration comparison

Change **one variable at a time**. Examples:

- old compression behavior vs an absolute `compression.threshold_tokens=32768`;
- A2A vs CLI one-shot;
- Qwen3-Coder-Next Q5_K_M vs another model;
- serving-runtime revision or tool parser, after Mac-side variables are controlled.

Do not compare two runs that changed model, transport, compression, and task text together.

## What to record

| Field | Meaning |
|---|---|
| model / quant | Exact worker model |
| provider/runtime | Serving backend and revision when known |
| Hermes profile | Exact realized profile |
| transport | CLI one-shot or A2A |
| context window | Effective configured context |
| compression trigger | Ratio and absolute token cap |
| wall time | Invocation to terminal result |
| model API calls | From Hermes usage when available |
| input/output tokens | From Hermes usage when available |
| verifier | PASS/FAIL |
| unexpected files | Count and paths |
| process stopped | Whether the worker/gateway actually exited or stopped |
| completion text accurate | Whether prose matches the visible file/result |

## Acceptance

A run is accepted only when all of these are true:

1. the independent verifier passes;
2. only the requested recognizer file changed;
3. French behavior remains intact;
4. English recognition requires both required English signals;
5. the existing result contract remains intact;
6. the worker has actually stopped;
7. completion prose does not contradict the resulting file state.

A faster failed run is not better. A run that passes behavior checks but leaves the worker writing after terminal
failure is not clean completion.

## Interpretation

This scenario is deliberately narrow. It does not rank models generally. It gives us a stable real coding task for
testing whether changes to context compression, transport, model, or serving runtime improve the behavior that caused
the original dissatisfaction.
