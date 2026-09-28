# Model education profiles

These YAML files describe **how to communicate with a model**, not how to serve it.

They use one AI-Fleas vocabulary across benchmarked models:

- `declared_education`: capabilities/specialization supported by upstream model documentation.
- `observed_capability`: behavior actually demonstrated in AI-Fleas benchmarks or reviewed work.
- `unknown_or_unverified`: knowledge/capability the delegator must not silently assume.
- `communication`: conceptual language that can be used directly versus domains that should be translated/probed.
- `role_fit`: provisional jobs suggested by evidence, not a leaderboard.
- `deployment_variants`: quantization/runtime representations. Quantization is **not education**.

Rules:
1. Keep declared and observed evidence separate.
2. Do not infer domain expertise from parameter count.
3. Do not infer education from Q4/Q5/Q8/NVFP4.
4. A failed benchmark establishes a limit in that fixture, not global inability.
5. Update profiles when controlled evidence contradicts them.
6. Use Domain Context Handoff when a task depends on concepts outside demonstrated/declared education.

The goal is simple: before delegating, ask **who did we hire, what conceptual language does this worker speak, and what must we teach or verify?**
