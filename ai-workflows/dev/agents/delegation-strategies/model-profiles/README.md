# Local Coder model profiles

The selected workflow's `local_ai.provider` and `local_ai.model` resolve an exact entry in its declared
`providers_config`. A model entry may declare `delegation.strategy_profile`, a path relative to `ai_workflows_root`.
Admin reads that profile before assigning work to a local Coder. The execution delegate binding still selects the
actual Coder, route, project, transport, and tools; a model profile only guides the handoff and verification.

Each profile records the exact provider model it applies to, observed behavior with evidence, a default handoff
strategy, task sizing, transport limits, verification points, and conditions for choosing another strategy. Treat
observations as revisable working evidence, not inherent properties of a model. A changed provider model or transport
requires a fresh review of the profile before reuse. Do not copy machine names, endpoints, client data, or operational
profile IDs into public guidance.

Admin may choose a different strategy for a particular task when its scope or evidence warrants it. Record why in
the handoff. Model guidance cannot expand Coder's write scope, override workflow gates, or imply that an A2A message
supports persistent goals or session reuse unless the selected launcher has verified support.
