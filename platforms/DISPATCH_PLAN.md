# Lifecycle dispatch contract

`resolveDispatchPlan(profile, workflow, registry, request)` resolves profile default -> workflow override -> per-agent override. The canonical fields are `agent_platforms.default`, `agent_platforms.available`, workflow `agent_platform`, and workflow `agent_overrides[agentId].agent_platform`. It validates every declaration, including overridden values. Missing selections and legacy `platform` aliases fail closed. Harness does not select lifecycle.

Requests supply `declaredAgentIds` from the portable manifest and an explicit `operation`: `single-agent` with `requestedAgentId`, or `full-roster`. Results contain exactly the requested agents, their platform ID, adapter contract, and configuration source. `requireAdapter` checks the plan before lifecycle effects. A full roster with mixed effective platforms is rejected.

This API provides selection and adapter preflight only. It does not initialize agents. The Hermes full-roster resolver verifies its effective platform; GPT role selection can preflight only Admin or an independently supported role. Generic cross-platform lifecycle execution, mixed roster transport/identity boundaries, and automatic host dispatch remain unsupported. Calling a full-roster initializer is never an Admin-only implementation.
