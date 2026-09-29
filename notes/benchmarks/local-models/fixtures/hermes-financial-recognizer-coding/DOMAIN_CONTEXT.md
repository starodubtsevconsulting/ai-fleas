# Domain-context handoff preface

For the domain-context arm, place this text **before** the unchanged [`TASK.md`](TASK.md) assignment. The task-only arm receives `TASK.md` without this preface. Use the same model, starter, exact-file write boundary, route, turn/process limits, and independent verifier in both arms.

> Domain context before the coding request:
> - This recognizer processes normalized text extracted from financial PDFs.
> - normalizedText preserves word boundaries. compactText is intentionally permissive and may join text, so substring matching there is unsafe for exact English keywords.
> - The business invariant is that standalone PAYMENT counts, REPAYMENT alone does not, and a separate PAYMENT still counts beside REPAYMENT.
> - The existing French behavior is production behavior and must remain unchanged.
>
> Requested change and scope follow unchanged:

Run fresh sessions in an interleaved A, B, B, A sequence and reset the starter after each run. Coder may inspect the target and task reference, but must not inspect the verifier, edit other files, run tests, or create scratch files. Admin runs [`verify.mjs`](verify.mjs) after the Coder process exits and checks its source, scope, and cleanup. Do not count a completion message alone as acceptance. The [2026-09-28 pilot](../../../../models/qwen3-coder-next/benchmarks/gx10/domain-context-handoff-pilot-2026-09-28.json) used four A, B, B, A blocks with no corrections.
