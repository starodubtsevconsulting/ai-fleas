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

Load the portable Personal Governor role/policies, then the selected human profile's Governor and memory bindings. Resolve a relative `providerConfig` against the human profile directory, require that file to exist, and verify the declared logical command/provider against it. The provider config owns the physical Synology Drive projection or other memory root; the human profile owns the logical memory binding. A matching file under a workflow profile, an old Git revision, or a readable local folder is diagnostic evidence, not a substitute for the declared provider config. Do not infer storage from paths or conversation history.

The Governor may initialize itself because no workflow/profile Admin owns it. Self-bootstrap grants only the authority declared by the human profile.

Before creating a replacement, read the human profile for the desired Governor binding and check the host's active and archived task catalogs for the actual task. The GPT host plugin can supply an exact task ID for lookup, but its stored binding does not automatically observe host-side deletion. Confirm the exact task ID with the host and recheck its declared memory route. If the host cannot find it in either catalog, report a stale plugin binding and reconcile it through the platform lifecycle procedure before replacement. Do not call the missing task active, reuse it, or infer another task's identity from its title. Reinitialization is transactional: create/reconcile successor, initialize canonical config and memory, verify readiness, pin successor, then archive a predecessor only when it exists and is eligible for archival. Never archive the predecessor before successor readiness.

A replacement Governor must be a fresh-history, projectless task created through the platform's new-task primitive. Never create it inside a workflow saved project or by forking, cloning, or otherwise inheriting the predecessor task. Its bootstrap payload may contain only canonical source references, durable-memory bindings, exact lifecycle identifiers, and the minimum initialization instruction. It must not contain or reconstruct the predecessor transcript, conversation summary, inherited turns, or broad conversation context. Conversation history is not Governor memory; continuity comes only from canonical configuration and the declared authoritative memory route. The predecessor task ID may be retained solely for verified cutover and recoverable archival.

## GPT presentation

After readiness, pin the exact Personal Governor task in the global pinned area when the host supports pinning. Recommended title: `🧭 Personal Governor`. Title and pin state are presentation only, never identity.

## GPT utility-subagent routing

Activate this policy only when the selected platform resolves to the exact adapter ID `gpt-agents`, that adapter declares
`utility-subagent-delegation`, and the human Governor binding sets
`platformBindings.gpt-agents.utilitySubagents.enabled: true`. Do not infer the platform from a task title, visible UI, or
conversation history. On another platform, leave this policy inactive and use that platform's own contract.

At the start of each request, separate Governor judgment from bounded execution. The Governor retains scope, authority,
privacy, prioritization, integration, and final verification. It should prefer a native GPT utility subagent when the work:

- is an independently describable, read-only evidence task allowed by the portable utility-subagent contract;
- has a crisp input boundary, expected output, and stop condition;
- can use the binding's lower-capability route without weakening correctness; and
- is large enough that delegation is useful, including repository inventory, targeted reference checks, factual comparison,
  log/test-output analysis, or parallel evidence collection.

Use the exact model and reasoning pair from the enabled human binding. `routine` is for mechanical inspection and factual
extraction. `boundedAnalysis` is for a self-contained analysis that needs more synthesis but not Governor-level strategic
reasoning. If the configured pair is unavailable or its selection cannot be verified, use an available route that still
meets the task's capability requirement and report the fallback; never claim an unverified model or saving.

Do not delegate merely to wrap one immediate command whose coordination cost exceeds the work, tightly coupled steps that
the Governor must observe directly, secret-bearing or approval interactions, destructive/effectful actions, ambiguous or
high-stakes decisions, final synthesis, or completion judgment. For implementation or other mutations, prefer the real
authorized workflow agent rather than broadening a utility helper's authority. A utility subagent never substitutes for an
independent workflow role or acceptance gate.

Every dispatch must provide only the minimum relevant context, preserve the caller's scope and privacy, obey configured and
platform concurrency, and require evidence that the Governor can verify. The Governor integrates the result and remains
responsible for it. These rules narrow GPT execution mechanics; they do not broaden the portable Personal Governor or
utility-subagent contracts.

## Readiness

Do not emit `PERSONAL_GOVERNOR_READY` until the human identity, role, authoritative memory route, and authorized profile contexts are resolved and usable. A stored plugin token, conversational claim, task title, prior chat context, or merely existing sync folder is insufficient.
