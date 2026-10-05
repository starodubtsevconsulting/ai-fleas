# Domain Context Handoff

**Translate the domain. Don’t dump the domain.**

Use this as a handoff pattern *within* a selected focused-implementation or bounded-exploration strategy when a coding decision depends on an unfamiliar domain rule. It changes the explanation in the assignment; it does not change the authorized project, transport, model, file scope, or who verifies the result.

Give the Coder the smallest model of the domain that lets it make the specific code decision:

1. **What it is:** Name the domain objects and the task's goal in plain terms.
2. **Translate into familiar concepts:** Relate domain representations or states to programming concepts the Coder can act on. Explain what information each representation preserves or loses.
3. **Why it matters:** State the failure caused by choosing the wrong representation or assumption.
4. **Positive and misleading examples:** Show one input that must count and a near match that must not; include a coexistence case when both may appear.
5. **Invariants:** State what must remain true, including existing production behavior.
6. **Relevant code boundary:** Point to the decision or data boundary where the invariant belongs, without expanding write authority.
7. **Task:** Give the unchanged requested code change and explicit allowed write/read roots.
8. **Acceptance checks:** State the behavior and scope Admin will verify independently, then the stop condition.

Keep the explanation small. Facts without their operational consequence may be ignored; an analogy without exact invariants may mislead. Do not rely on a successful-sounding completion message. If the Coder's result is rejected, give specific verifier feedback in a bounded correction and measure that correction separately from first-pass success.

## Evidence and limit

In one frozen recognizer fixture, nine interleaved runs per arm passed the independent verifier on the first try **3/9 with the task alone, 5/9 with raw domain facts, and 8/9 with translated context**. The translated arm produced 1.033 accepted results per initial Coder minute, compared with 0.600 and 0.536; its individual attempts were not uniformly faster. With one identical correction for every failed candidate, final acceptance was 7/9, 9/9, and 8/9 respectively. One translated-context run attempted an out-of-scope test-file write that the exact-file guard denied. The [protocol](../../../../notes/benchmarks/local-models/fixtures/hermes-financial-recognizer-coding/THREE_ARM_PROTOCOL.md) and [sanitized record](../../../../notes/models/qwen3-coder-next/benchmarks/gx10/domain-context-three-arm-2026-09-28.json) provide the exact treatment and measurements.

This remains **provisional evidence**. The translated arm bundled an analogy, examples, and a code-boundary hint, so the experiment does not identify which component helped. Even so, the selected target model's expertise profile is always applied: use this pattern when that profile calls for translation, while preserving its scope and uncertainty. On a separate process-group fixture, task-only and raw-context arms each had 0/8 accepted first passes. A later [translated-context transfer probe](../../../../notes/models/qwen3-coder-next/benchmarks/gx10/process-group-translated-pilot-2026-09-28.json) also had 0/8 accepted first passes despite stating the cleanup algorithm; one of eight became source-accepted after identical verifier-backed correction. Because this translated batch ran later, its time is not a matched ranking against the earlier arms. Verify the pattern on a second task with an accepted baseline before claiming a general coding-speed gain.
