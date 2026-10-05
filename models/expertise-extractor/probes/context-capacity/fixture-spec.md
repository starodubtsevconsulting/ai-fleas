# Context Capacity fixture specification

## Status

Frozen-input specification only. No context-capacity run or result is claimed here.

## Primary integration task

Use the checked-in `hermes-context-capacity-integration` fixture without altering its three distributed contracts, final task, starter, or independent verifier. Its exact artifact hashes and delivery contract are frozen in `integration-task-packet.json`; its exact token positions and 53 ordered message hashes are frozen in `packet-manifest.json`.

The worker may write only `recognizers/change-approval-recognizer.mjs`. It may not inspect or run the verifier. The external verifier reports 21 assertions grouped as EARLY (6), MIDDLE (6), LATE (2), and LEGACY (7).

## Secondary financial-retention control

The checked-in `hermes-financial-recognizer-coding` fixture remains an unchanged small control, not the primary capacity task.

| Artifact | Repository-relative path | SHA-256 |
| --- | --- | --- |
| Task | `notes/benchmarks/local-models/fixtures/hermes-financial-recognizer-coding/TASK.md` | `8b79e41c8a6caf56434b4f2f86fe388d2a9d6aacf3620452dfe5fdaaae8449fe` |
| Translated domain contract | `notes/benchmarks/local-models/fixtures/hermes-financial-recognizer-coding/DOMAIN_CONTEXT_TRANSLATED.md` | `0fa2ad7b3be314ef0233741e993b4d6ccd9814ee7b81a9659a395f6f8c121ddb` |
| Starter | `notes/benchmarks/local-models/fixtures/hermes-financial-recognizer-coding/starter/recognizers/snow-removal-contract-recognizer.mjs` | `f2bd6a54760cf87b2a668772bd6bbfe8820efc9701f8b6a8ce90e0f2fcf4adf3` |
| Verifier | `notes/benchmarks/local-models/fixtures/hermes-financial-recognizer-coding/verify.mjs` | `41a44f7c71df3501082298f612d162b1e7a55f80d92bbd60b27ad26287e450a5` |
| Baseline record | `models/qwen3-coder-next/benchmarks/gx10/domain-context-three-arm-2026-09-28.json` | `4fd169f6b989552c25bd9d33bbca6b8f6ce0c109015bf683349d4220d306421d` |

The secondary target file is exactly `recognizers/snow-removal-contract-recognizer.mjs`. A worker may read its frozen task, staged target, and generated control packet, but may write only that target. It may not inspect or run the verifier.

## Frozen domain invariant

- `normalizedText` preserves word boundaries.
- `compactText` is a permissive representation and cannot establish an exact English `PAYMENT` word match.
- Standalone `PAYMENT` is positive.
- `REPAYMENT` or `PAYMENTS` alone is negative.
- A separate `PAYMENT` remains positive when `REPAYMENT` also appears.
- Existing French recognition and the result contract must remain intact.

The translated domain contract appears exactly once in the secondary control. The unchanged task appears exactly once at the end. Neither may be restated by the packet generator.

## Independent acceptance

A first-pass result is accepted only when all seven gates hold:

1. the frozen verifier exits zero;
2. only the requested recognizer file changed;
3. existing French behavior remains intact;
4. English recognition requires both required English signals;
5. the existing result contract remains intact;
6. the worker process is confirmed stopped before verification;
7. completion prose does not contradict the resulting file state.

Verifier execution, source review, scope review, evidence capture, and restoration are Admin/Command Runner work, never worker self-grading.

## Correction

An initially rejected primary run receives at most one correction in a fresh session on its saved candidate. The correction text is frozen in `integration-task-packet.json`; only the enumerated verifier feedback fields may be substituted. The secondary control retains its own correction contract in `task-packet.json`. First-pass acceptance is the promotion measure. Corrected acceptance is secondary recovery evidence.

## Provenance

The prior three-arm comparison produced 3/9 task-only, 5/9 raw-domain, and 8/9 translated-domain first-pass acceptance. Those values justify using the translated contract here; they are provenance, not context-capacity results.
