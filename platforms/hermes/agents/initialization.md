# Hermes agent initialization

This adapter runs only when the selected profile names `agent_platform: hermes` and the Hermes CLI is available.

Initialization has two scopes:

- workflow initialization creates or reconciles only the selected workflow group and its workflow-scoped role profiles;
- system initialization creates or reconciles the one system-scoped System profile for this profile/platform binding.

Workflow initialization must never create, replace, delete, or add System to a Hermes group. System initialization must be explicitly requested. If one active recorded System profile already exists, reuse it; if identity is ambiguous or more than one candidate exists, block instead of creating another. Reinitializing System requires an explicit System reinitialization request and follows continuity and knowledge-transfer rules.

For workflow initialization, resolve the exact profile, workflow, complete logical project, provider target, and model before mutation. The workflow's
`local_ai.providers_config`, `local_ai.provider`, and `local_ai.model` references must resolve exactly once through the
profile-owned catalog. Never infer a nearby machine, endpoint, model, launcher, or companion repository.

One logical workflow agent maps to one exact Hermes profile ID. Reconcile it through
`ai-commands/hermes-agents/hermes-agents.command.sh initialize`; preserve conversations and memory by default. The generated profile must
reference the selected workflow contract, allowed commands, project workspace, and applicable repository instructions.
Verify provider, concrete model, endpoint reachability, context settings, and workspace after setup. A plain `initialize` is workflow-scoped and never initializes System.

System uses the profile's `system_agent.platform_bindings.hermes` provider/model realization and remains outside Hermes workflow groups. Its lifecycle is separate from workflow-group initialize, reconcile, reinitialize, and delete operations. When Hermes exposes profile pinning, pin System in its global navigation without adding it to any workflow group; otherwise report pinning as unsupported.

When System scheduling is enabled, supply the portable schedule and initial watch scopes in the System profile's
initialization message. System owns scheduler bootstrap: it requests Hermes's scheduling adapter to create or reconcile
the concrete timer and verifies that receipt before declaring readiness. The public lifecycle contract must not encode
Hermes timer storage or trigger mechanics.

The concrete realization is one profile-scoped cron job plus that profile's user-level gateway service. Verify the
gateway ticker before returning `SYSTEM_READY`. Deliver scheduled output into System's own Bot Chat, never a workflow group.

Provider endpoints, authentication references, concrete model IDs, and machine labels remain in the operational profile.
They are configuration of this adapter, not part of its public contract. Workflow deletion requires exact workflow identities and must leave System unchanged.

Hermes does not currently declare portable peer-to-peer agent messaging. A workflow requiring that capability must fail
closed or select another registered agent platform.
