# Phase 2 moderation validation

## Scope

This evidence validates the generic serving adapter and its enforcement ordering. A controlled loopback decision-service
test double returned deterministic allow/deny/malformed/unavailable decisions. It does **not** establish semantic
accuracy and must not be described as a production moderator evaluation.

## GX10 integration evidence — 2026-09-23

The active `education-child` profile enabled both semantic gates against the loopback decision service. Health reported
the selected profile and both gates as active. Tests used a 256×256, one-step candidate solely to exercise routing with
minimal compute; the normal configured image size was not changed.

| Case | Expected | Evidence |
|---|---|---|
| Semantic input denial using wording not covered by the Phase 1 expressions | Reject before inference | HTTP 400, neutral refusal, `test_denied`; retained-output count unchanged at 7 |
| Decision service unavailable | Fail closed before inference | HTTP 503, neutral refusal, `moderation_unavailable`; retained-output count unchanged at 7 |
| Semantic output denial after a benign input | Generate privately, reject before publication | HTTP 400 in 2 seconds, `test_denied`; retained-output count unchanged at 7 |
| Benign input and output allowed | Publish only after both decisions allow | HTTP 200 in 1 second; retained-output count changed from 7 to 8; the exact test image was deleted after validation |
| Streaming output denial | Return bounded policy error and close stream | HTTP 200 SSE in 3 seconds with `policy_error`, `test_denied`, and `[DONE]`; retained-output count unchanged |
| Lookup/resume of denied stream | Replay the same terminal denial without new inference | lookup reported `is_done: true`; replay returned the same policy error and `[DONE]` |

The initial streaming denial uncovered a task-observation bug that left the SSE session open after an output-policy
exception. The producer now observes task completion without propagating the exception outside its policy-error handler.
The container-side resumable-stream regression covers this failure and passed before the live retry.

After integration testing, the temporary decision service was stopped, its one published benign test image was removed,
and the live service configuration was restored to `semantic_input: false` and `semantic_output: false`. Phase 1 remains
active until a real evaluator is selected and accepted.

## Automated evidence

- 3 runtime-memory/safety tests pass.
- 9 policy composition and deterministic-language tests pass.
- 6 semantic decision-contract tests pass, including allow, deny, output payload, unavailable, uncertain, malformed,
  mismatched request ID, disabled, unrestricted, and missing-configuration behavior.
- The container-side resumable-stream test passes for success/replay and terminal policy-error behavior.
- Runtime Python compilation, shell syntax, diff checks, and the SDD guard pass.

## Remaining production acceptance

Choose and configure an actual text-and-image evaluator, then record its immutable identity/version and repeat the live
matrix with a representative corpus: paraphrases, euphemisms, misspellings, prompt injection, all supported languages,
harmless sensitive-word contexts, and unsafe image candidates from benign prompts. Measure evaluator latency, false
positives/negatives, memory impact, timeout behavior, browser/tunnel behavior, and recovery. Until those checks pass,
Phase 2 is implemented but not active or semantically accepted for the public service.
