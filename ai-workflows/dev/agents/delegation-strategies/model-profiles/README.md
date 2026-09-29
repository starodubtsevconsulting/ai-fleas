# Local Coder strategy configs

The selected workflow's `local_ai.provider` and `local_ai.model` resolve the caller's model. When an execution
delegate selects a different target, resolve its configured provider and model ID in the declared `providers_config`
instead. That target model entry may declare `delegation.strategy_config`, a YAML path relative to
`ai_workflows_root`. Admin loads that config before assigning work to a local Coder and verifies its
`applies_to.provider_model` against the selected target. The bounded-model launcher validates the target strategy
path under the workflow catalog, checks the declared input/output limits against the live route binding, and reports
the path on `check`; it does not read the strategy prose into its prompt. The
execution delegate may separately declare `strategy_transport_config` for session, timeout, and status rules tied to
its platform and transport. The delegate binding still selects the actual Coder, route, project, and tools; these
configs only guide the handoff and verification.

The model config records task routes, required assignment fields, and verification. The transport config records
session and timeout behavior. `evidence_notes` may point to a companion explanation. Treat observations as revisable
working evidence, not inherent properties of a model. A changed model or transport requires a fresh review before
reuse. Do not copy machine names, endpoints, client data, or operational profile IDs into public guidance.

## Education metadata

The [model-family education catalog](../../../../../models/README.md)
is the canonical cross-model vocabulary. This directory owns route-specific strategy and evidence for the selected provider-model; canonical model education lives under the top-level `models/` registry and is consumed by reference. A catalog `role_fit`
or family-level strength can nominate a worker for a probe; before a handoff, check the route-specific scope
and evidence. A future shared schema should retain both family-level design intent and each observed result's
exact deployment, transport, and task scope.

A model strategy may point to a canonical `education_profile` under the top-level `models/` registry. Its reusable
[canonical schema](../../../../../models/schema/education-profile.schema.json) separates three kinds of information:

- `declared`: the upstream model maker's stated design or training orientation, with a direct source and a limit on what the claim proves;
- `observed`: a checked local result, its exact model/route/task scope, evidence paths, and an interpretation limit;
- `unknown_or_unverified`: concepts the coordinator should translate or probe before assuming competence.

`communication` turns those entries into a starting vocabulary, translation needs, and a verification rule. It is
handoff guidance, not an audit of hidden model knowledge or a runtime setting. [Qwen3-Coder-Next](../../../../../models/qwen3-coder-next/education-profile.yml)
is the first populated instance. The Hermes and proposal-only strategies for that provider model point to the same
file, but an observed Hermes result does not prove the proposal-only route behaves the same way. Always check each
observation's `scope` before applying it. Other models should receive a profile only when their declared sources and
local evidence have been checked; do not fill gaps by copying Qwen's claims.

The current launchers select and validate strategy files; they do not load, validate, or inject education metadata.
Until a coordinator explicitly reads it, the `education_profile` pointer is advisory. Match its
`applies_to.provider_model` to the selected delegate model and preserve the selected transport's rules.

Admin may choose a different strategy for a particular task when its scope or evidence warrants it. Record why in
the handoff. Strategy config cannot expand Coder's write scope, override workflow gates, or imply that an A2A message
supports persistent goals or session reuse unless the selected launcher has verified support.
