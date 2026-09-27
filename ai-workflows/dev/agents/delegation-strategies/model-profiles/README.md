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

Admin may choose a different strategy for a particular task when its scope or evidence warrants it. Record why in
the handoff. Strategy config cannot expand Coder's write scope, override workflow gates, or imply that an A2A message
supports persistent goals or session reuse unless the selected launcher has verified support.
