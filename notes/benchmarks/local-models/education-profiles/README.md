# Model education profiles

Canonical machine-readable descriptions of **how to communicate with benchmarked models**, separate from runtime settings.

Vocabulary:
- `declared_education`: upstream-supported training/specialization.
- `observed_capability`: AI-Fleas benchmark/review evidence.
- `unknown_or_unverified`: do not assume; translate or probe.
- `communication`: how to hand unfamiliar work to this model.
- `role_fit`: provisional job fit from evidence.
- `deployment_variants`: quantization/runtime representation; **not education**.

Never infer education from parameter count or Q4/Q5/Q8/NVFP4. Never turn one fixture into a global capability claim. Keep declared and observed evidence separate and preserve contradictions.

The catalog describes model families. Its `ai-fleas-model-education.v1` vocabulary is not yet validated or
loaded by a delegate launcher. The [Qwen Q5 handoff profile](../../../../ai-workflows/dev/agents/delegation-strategies/model-profiles/qwen3-coder-next-q5km.education.yml)
adds direct sources and scoped evidence for a selected provider-model and route. A family observation can
suggest a probe; it does not establish the same behavior for another quantization, transport, or task.
Check the route profile's scope and evidence before applying a catalog claim to an actual handoff.

`source_status` is a review marker, not a citation. A review-needed entry is a hypothesis until its upstream
document and precise claim are checked. Even a reviewed marker does not replace a direct source link for a
declared claim used in a real assignment. Treat `role_fit` as a candidate for a scoped test, not an automatic
worker-selection rule.

The family catalog and route profile use different YAML shapes. A shared schema should retain the model-family
identity for declared design, attach deployment, transport, and task scope to each local observation, and require
direct source and evidence links with interpretation limits. Do not merge different routes into one unqualified
strength or limit.

Delegation question: **Who did we hire, what conceptual language does this worker already speak, and what must we teach or verify?**
