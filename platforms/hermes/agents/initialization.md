# Hermes agent initialization

This adapter runs only when the selected profile names `agent_platform: hermes` and the Hermes CLI is available.

Resolve the exact profile, workflow, complete logical project, provider target, and model before mutation. The workflow's
`local_ai.providers_config`, `local_ai.provider`, and `local_ai.model` references must resolve exactly once through the
profile-owned catalog. Never infer a nearby machine, endpoint, model, launcher, or companion repository.

One logical agent maps to one exact Hermes profile ID. Reconcile it through
`ai-commands/hermes/hermes.command.sh setup`; preserve conversations and memory by default. The generated profile must
reference the selected workflow contract, allowed commands, project workspace, and applicable repository instructions.
Verify provider, concrete model, endpoint reachability, context settings, and workspace after setup.

Provider endpoints, authentication references, concrete model IDs, and machine labels remain in the operational profile.
They are configuration of this adapter, not part of its public contract. Deletion requires the exact profile ID and the
public command's explicit confirmation flag; the default Hermes profile is never a deletion target.

Hermes does not currently declare portable peer-to-peer agent messaging. A workflow requiring that capability must fail
closed or select another registered agent platform.
