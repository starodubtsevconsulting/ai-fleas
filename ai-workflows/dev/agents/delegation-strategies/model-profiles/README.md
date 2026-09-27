# Local Coder strategy configs

The selected workflow's `local_ai.provider` and `local_ai.model` resolve an exact entry in its declared
`providers_config`. A model entry may declare `delegation.strategy_config`, a YAML path relative to
`ai_workflows_root`. Admin loads that config before assigning work to a local Coder and verifies its `applies_to`
values. The execution delegate binding still selects the actual Coder, route, project, transport, and tools; strategy
config only guides the handoff and verification.

Each config records the exact model and transport, task routes, required assignment fields, timeout handling, and
verification. `evidence_notes` may point to a companion explanation. Treat observations as revisable working evidence,
not inherent properties of a model. A changed provider model or transport requires a fresh review before reuse. Do
not copy machine names, endpoints, client data, or operational profile IDs into public guidance.

Admin may choose a different strategy for a particular task when its scope or evidence warrants it. Record why in
the handoff. Strategy config cannot expand Coder's write scope, override workflow gates, or imply that an A2A message
supports persistent goals or session reuse unless the selected launcher has verified support.
