# GPT Personal Governor initialization

The Personal Governor is a persistent human-scoped agent. It is not owned by a workflow profile and does not require Admin, Manager, or System to initialize it.

## Manual bootstrap

A human may create a fresh GPT task/chat and explicitly request: `Initialize Personal Governor for <human-profile-id>`.

That direct request is sufficient to select the Personal Governor bootstrap route, but not sufficient to invent identity or resources. Resolve the exact human profile under the activated private profile catalog and verify:

- `type: human`;
- exact human profile ID;
- Personal Governor role and lifecycle binding;
- readiness token `PERSONAL_GOVERNOR_READY`;
- authoritative permanent-memory binding;
- authorized workflow-profile contexts and capabilities.

If the human profile is absent, ambiguous, or conflicting, stop read-only.

## Initialization

Load the portable Personal Governor role/policies, then the selected human profile's Governor and memory bindings. Resolve permanent memory through the declared logical command/provider; do not infer storage from paths or conversation history.

The Governor may initialize itself because no workflow/profile Admin owns it. Self-bootstrap grants only the authority declared by the human profile.

Before creating a replacement, discover trusted lifecycle state for an existing active Governor for the same human/platform. Reuse it when appropriate. Reinitialization is transactional: create/reconcile successor, initialize canonical config and memory, verify readiness, pin successor, then archive predecessor. Never archive the predecessor before successor readiness.

## GPT presentation

After readiness, pin the exact Personal Governor task in the global pinned area when the host supports pinning. Recommended title: `🧭 Personal Governor`. Title and pin state are presentation only, never identity.

## Readiness

Do not emit `PERSONAL_GOVERNOR_READY` until the human identity, role, authoritative memory route, and authorized profile contexts are resolved and usable. A conversational claim, task title, or prior chat context is insufficient.
