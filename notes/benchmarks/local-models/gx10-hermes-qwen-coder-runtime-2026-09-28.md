# GX10 Hermes Qwen Coder runtime trial — 2026-09-28

This trial asked whether Hermes compression and CLI controls improve **independently accepted coding work per minute** for Qwen3-Coder-Next Q5_K_M. It used the frozen [financial recognizer coding fixture](fixtures/hermes-financial-recognizer-coding/README.md), a 65,536-token served context, Hermes v0.21.0, and fresh sessions. The model server was unchanged. The independent verifier includes positive French and English cases, missing-signal rejections, whole-word `PAYMENT` negatives, and evidence flags.

## Compression comparison

The old settings were `threshold=0.25`, no absolute token threshold, `target_ratio=0.15`, and `protect_last_n=8`. The proposed settings were `threshold=0.75`, `threshold_tokens=32768`, `target_ratio=0.20`, and `protect_last_n=20`.

| Settings | Run 1 | Run 2 | Accepted results | Compaction |
|---|---:|---:|---:|---|
| Old | 64.78 s, 4 calls, fail | 26.90 s, 4 calls, pass | 1/2 | None |
| Proposed | 64.12 s, 6 calls, pass | 31.34 s, 4 calls, pass | 2/2 | None |

The wall-time ranges overlap. The largest single-call input was 11,884 tokens, below the proposed 32,768-token trigger. These **coding runs** cannot establish a compression speed or quality effect. A separate concise-prompt pair took 25.15 and 26.64 seconds but passed only one of two runs. Adding an explicit whole-word boundary example also passed only one of two after the verifier added a coexistence case. Neither prompt variant is an accepted default.

A separate **read-only, five-turn code-review probe** crossed the cap with frozen public Hermes runtime source packets. Under old compression settings it finished in 89.52 seconds without compaction. With the proposed 32,768-token cap and 20 protected messages, turn five spent 53.20 seconds compressing but shrank only from about 50,967 to 47,703 estimated tokens; it immediately began another summary and hit a 120-second outer limit without a final answer. Reducing the protected-message count to 3 produced the same repeated-compression outcome. A 49,152-token cap completed after one 47.69-second summary, but the five turns took 151.70 seconds and the final answer missed the specific review question. Single runs and prompt-cache order limit broad speed claims, and this is not a coding acceptance test. They do show that the proposed early cap can add substantial latency without clearing its own threshold in a real multi-turn source review. Keep the existing realized compression settings pending an accepted-code comparison.

The successful long-patch call generated 1,828 output tokens and took 35.2 seconds. A 1,024- or 1,536-token output cap risks truncating that useful tool call; a 2,048-token cap would not shorten it. Model generation and the number of turns dominated these short runs, while file tools took roughly 1–1.5 seconds per run.

## Larger coding and loop behavior

Two synthetic publication implementations, each with one correction, failed an existing ownership and collision behavior test. A smaller historical amount-recognizer repair started at 4/5 passing cases; its first edit and correction each passed only 1/5. These trials produced **no accepted larger implementation**, so faster completion text is not a usefulness gain.

One historical Hermes turn logged 313 model calls and more than 300 repeated file writes. A later bounded launcher edit still spent five patch calls on a file that already contained the requested change; four consecutive calls used identical patch arguments. The installed guard did not stop that no-change loop. Hermes [v2026.9.7 added an identical-call halt](https://github.com/NousResearch/hermes-agent/blob/v2026.9.7/agent/tool_guardrails.py), but it has not been tested live on this deployment. A historical trace replay suggests it targets a real failure mode; it does not prove accepted code or a measured speedup.

## CLI route control

The old launcher used top-level `hermes -z`. That path ignores configured `agent.max_turns`, as confirmed by a stopped 28-call run and by [upstream issue #105243](https://github.com/NousResearch/hermes-agent/issues/105243). Its 240-second run budget asks the model to wrap up but is not a process deadline. The issue remains in the [v2026.9.14 one-shot source](https://github.com/NousResearch/hermes-agent/blob/v2026.9.14/hermes_cli/oneshot.py).

The configured launcher now uses `hermes chat -Q --query`, which keeps answer-only stdout while applying the profile's 20-turn limit. A live smoke run logged `api_calls=1/20`. CLI `run` now rejects a missing `HERMES_WRITE_SAFE_ROOT`; the caller must supply the exact authorized file or directory. Shell syntax, route readiness, missing-guard rejection, and a write-denied smoke run passed. The launcher still lacks a hard process deadline, and a turn-limit summary can exit successfully despite incomplete work, so the caller must independently verify output.

With the bounded route, the frozen recognizer took 42.96 seconds and 6 model calls on its first attempt, which failed the `REPAYMENT` negative. One correction took 40.94 seconds and 9 calls; the saved result passed the full verifier. That is **one accepted small change after 83.90 seconds and 15 calls**. The changed handoff and correction prevent a direct speed ranking against the four compression runs. The controlled result establishes that the bounded route can produce accepted work with review; it does not show a faster or generally more capable agent.

## Decision

Keep the existing Q5 model and compression settings. The measured benefit so far is **better control of runaway CLI work and missing write scope**, not faster accepted coding. Next, enforce a hard process deadline, test the newer identical-call halt on a frozen loop-prone task, and run a long coding fixture that actually crosses the compression trigger. Compare pass rate, total wall time, model calls, tool repetition, scope errors, and post-compaction correctness with the same start and independent verifier.
