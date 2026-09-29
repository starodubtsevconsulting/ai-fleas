# Three-arm domain-context handoff comparison

Question: Does the **way domain facts are explained** change accepted coding work for the same local Coder?

- **A, task only:** the unchanged [`TASK.md`](TASK.md) assignment.
- **B, raw domain context:** the frozen technical/domain block in [`DOMAIN_CONTEXT.md`](DOMAIN_CONTEXT.md), followed by the unchanged assignment.
- **C, translated domain context:** the frozen analogy, positive and misleading examples, invariant, and code-boundary mapping in [`DOMAIN_CONTEXT_TRANSLATED.md`](DOMAIN_CONTEXT_TRANSLATED.md), followed by the unchanged assignment.

Each run begins with the same French-only [starter](starter/recognizers/snow-removal-contract-recognizer.mjs) in the visible checkout. Use fresh Hermes sessions with the configured Qwen3-Coder-Next Q5_K_M profile, existing compression settings, `chat -Q` CLI delegate, 20-turn cap, 180-second process deadline, and `HERMES_WRITE_SAFE_ROOT` set to the exact checkout target file. Coder may read the task and target but may edit only the target; it must not inspect the verifier, run tests, create scratch files, commit, or push. Admin runs the unchanged [`verify.mjs`](verify.mjs) after the Coder process stops, saves the candidate, checks the checkout scope, and restores the starter before the next run.

Run three cycles of **ABC, BCA, CAB**: nine fresh runs per arm, balanced so every arm occurs in each sequence position three times. Freeze all three prompt texts before the first run. Do not revise them in response to individual failures. Record first-pass acceptance, wall time, model calls and tokens, compaction, denied writes, process stop, and whether the completion claim matches the verifier.

For each initial failure, allow exactly one correction in a fresh session on its saved candidate, with identical verifier feedback for all arms: English `PAYMENT` must be a standalone word in `normalizedText`; reject `REPAYMENT` and `PAYMENTS` alone, accept a separate `PAYMENT` beside `REPAYMENT`, preserve French behavior, and edit only the target. Rerun the independent verifier. Report initial and post-correction acceptance separately; include correction time in total accepted-work time. A correction is workflow recovery evidence, not evidence that its initial handoff succeeded.

The acceptance gate is the fixture verifier, exact-file scope, process exit, and source review. A faster rejected result is not a speed improvement. Compare the three arms only after the fixed run order finishes; distinguish the overlap in facts between B and C from C's additional operational translation. If C materially improves acceptance over both A and B, test the pattern on another coding fixture before making a general claim.

The [sanitized 27-run record](../../../../models/qwen3-coder-next/benchmarks/gx10/domain-context-three-arm-2026-09-28.json) contains the completed comparison. Exact prompts, saved candidates, logs, and correction outputs remain in ignored local `runs/` artifacts.
