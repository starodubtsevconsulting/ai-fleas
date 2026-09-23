# Phase 2 moderation validation

## Scope

This evidence validates both the generic serving adapter and the selected local evaluator. The controlled loopback
tests prove enforcement ordering and failure handling; the 2026-09-23 private-LAN deployment evidence below evaluates
the real semantic model. It remains bounded acceptance evidence rather than a claim of perfect moderation.

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
active until a real evaluator is selected and accepted. This paragraph records the earlier test-double state; the later
local-evaluator acceptance supersedes it for the current deployment.

## Local evaluator acceptance — 2026-09-23

The selected evaluator is the already-installed Ollama artifact `gemma3:4b` (`a2af6cc3eb7f`) on a separate private AI
host. The checked-in `ollama_policy_service.py` exposes only the versioned decision contract on the private LAN; Ollama
remains loopback-only. GX10 authenticates with a mounted bearer-token file. No prompt, candidate image, or credential
uses a public tunnel or external moderation service.

The evaluator uses 20 GPU layers while the host's existing Qwen text model remains active and healthy. Ollama reports
the evaluator as 65% CPU / 35% GPU with a 4,096-token context, retained in memory after the managed warm-up. Combined
GPU use was 8,623 MiB on a 12,288 MiB GPU, leaving 3,288 MiB free. Warm text and vision decisions measured about
9–14 seconds. A CPU-only baseline was approximately 13 seconds for text and 95 seconds for vision, so it was not kept.

The first real corpus run passed 18/20: it caught every prohibited case but falsely denied the Russian and Ukrainian
benign “fully clothed student” cases. The evaluator instruction was corrected to judge only requested/shown content,
distinguish policy definitions from evidence, translate semantically, and treat explicit compliant language as positive
evidence. The complete corpus then passed 20/20 with zero observed false negatives or false positives:

- prohibited: explicit wording, paraphrase, euphemism, misspelling, obfuscation, prompt injection, and all configured
  languages;
- allowed: ordinary, sensitive-context, boundary, Russian, Ukrainian, Spanish, and French cases;
- final CPU corpus median 12,976.74 ms and maximum 13,819.12 ms before the accepted partial-GPU optimization.

Seven previously retained Qwen outputs were then evaluated as a real-image corpus. Visual review confirmed all model
decisions: two benign images were allowed and five policy-violating images were denied. The five denied files predated
active Phase 2 enforcement and were moved out of the public output directory into an owner-only, recoverable quarantine.
No copy is retained in this repository.

## Active GX10 acceptance — 2026-09-23

Both semantic gates are now active for `education-child` against the authenticated private-LAN evaluator:

| Case | Evidence |
|---|---|
| Health/configuration | `status: ready`, `semantic_input: true`, `semantic_output: true`; approximately 66.7 GB host memory available |
| Semantic input denial | Euphemistic prohibited request returned HTTP 400 with `semantic_policy_denied` before inference; output count unchanged |
| Real benign generation | 512×512, 10-step Qwen generation returned HTTP 200; PNG verified RGB, non-uniform, 247,074 bytes; input and output decisions allowed |
| Output ordering | Candidate remained in memory through the output decision; the API response was temporary and deleted after verification |
| Existing real-image corpus | 2/2 benign allowed; 5/5 policy-violating denied and quarantined outside public outputs |
| Evaluator unavailable | With the evaluator deliberately stopped, a benign request returned HTTP 503 in under one second before inference; output count unchanged |
| Recovery | Evaluator restarted healthy, warmed successfully, and the existing Qwen text endpoint on its host remained healthy |
| Public boundary | Unauthenticated `https://gx10.aifleas.com/` returned the expected Cloudflare Access 302 challenge |

The active public output directory contains only the two reviewed benign retained images. The evaluator is fail-closed:
timeout, transport failure, malformed output, request-ID mismatch, unknown decision, and uncertainty never fall through
to generation or publication.

## Automated evidence

- 3 runtime-memory/safety tests pass.
- 9 policy composition and deterministic-language tests pass.
- 8 semantic decision-contract tests pass, including allow, deny, output payload, unavailable, uncertain, malformed,
  mismatched request ID, disabled, unrestricted, and missing-configuration behavior.
- 5 local Ollama adapter tests pass, including strict request validation, consistent decision normalization, unknown
  policy-ID rejection, malformed-result uncertainty, and numeric keep-alive handling.
- The container-side resumable-stream test passes for success/replay and terminal policy-error behavior.
- Runtime Python compilation, shell syntax, diff checks, and the SDD guard pass.

## Remaining assurance work

Continue expanding adversarial, multilingual, and benign-boundary corpora over time. This acceptance establishes the
selected deployment's current behavior but does not prove that a generative evaluator cannot be bypassed. A future
stronger assurance layer may add a dedicated classifier or conservative ensemble behind the same decision contract
without changing model-serving adapters or policy selection.

Run the checked-in input corpus through the profile-aware command:

```bash
${AI_COMMANDS_ROOT}/data/local-image-benchmark/local-image-benchmark.command.sh evaluate-policy \
  --endpoint http://127.0.0.1:PORT/v1/policy/decisions \
  --policy education-child
```

Use a mounted token file when the endpoint is not strictly loopback/private. Do not commit evaluator credentials or raw
provider responses containing submitted content.
