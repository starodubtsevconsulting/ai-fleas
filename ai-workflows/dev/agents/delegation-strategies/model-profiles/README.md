# Local Coder strategy configs

The selected workflow's `local_ai.provider` and `local_ai.model` resolve the caller's model. When an execution
delegate selects a different target, resolve its configured provider and model ID in the declared `providers_config`
instead. That target model entry must declare `delegation.strategy_config`, a YAML path relative to
`ai_workflows_root`. Admin loads that config before assigning work to a local Coder and verifies its
`applies_to.provider_model` against the selected target. The bounded-model launcher validates the target strategy
path under the workflow catalog, checks the declared input/output limits against the live route binding, and reports
the strategy and expertise paths on `check`; actual runs prepend the verified expertise communication contract. The
execution delegate may separately declare `strategy_transport_config` for session, timeout, and status rules tied to
its platform and transport. The delegate binding still selects the actual Coder, route, project, and tools; these
configs only guide the handoff and verification.

The model config records task routes, required assignment fields, and verification. The transport config records
session and timeout behavior. `evidence_notes` may point to a companion explanation. Treat observations as revisable
working evidence, not inherent properties of a model. A changed model or transport requires a fresh review before
reuse. Do not copy machine names, endpoints, client data, or operational profile IDs into public guidance.

## Target-model expertise

The [model expertise catalog](../../../../../models/README.md) is the canonical source for extracted target-model
communication knowledge. This directory owns route-specific strategy and evidence for the selected provider-model;
canonical expertise lives under the top-level `models/` registry and is consumed by reference. A catalog `role_fit`
can nominate a worker for a probe; before a handoff, check the route-specific scope and evidence.

A model strategy used for model-to-model delegation must point to a canonical `expertise_profile` under the top-level
`models/` registry. The profile separates three kinds of information:

- `observed`: a checked local result, its exact model/route/task scope, evidence paths, and an interpretation limit;
- `inferred_but_unverified`: useful hypotheses that must not be promoted to facts;
- `unknown`: concepts the coordinator must translate or probe before assuming competence.

`communication` turns those entries into direct vocabulary, translation needs, a handoff rule, and a verification
rule. It is handoff guidance, not an audit of hidden model knowledge or a runtime setting.
[Qwen3-Coder-Next](../../../../../models/qwen3-coder-next/expertise-profile.yml) is the first populated instance. The
Hermes and proposal-only strategies for that provider model point to the same file, but an observed Hermes result does
not prove the proposal-only route behaves the same way. Always preserve the profile's scope and limits. Other models
must receive their own evidence-backed profile; do not fill gaps by copying Qwen's findings.

The launchers validate the strategy and expertise paths, require an exact `applies_to.provider_models` match plus the expertise schema and communication fields, and
prepend the extracted communication contract to actual handoffs. A missing, unsafe, or invalid expertise binding
blocks the route. Admin also reads and applies the profile when constructing the concrete assignment; automatic
injection is the enforcement backstop, not a substitute for translating the task well. Preserve the selected
transport's separate rules.

Admin may choose a different strategy for a particular task when its scope or evidence warrants it. Record why in
the handoff. Strategy config cannot expand Coder's write scope, override workflow gates, or imply that an A2A message
supports persistent goals or session reuse unless the selected launcher has verified support.
