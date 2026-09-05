# GPT/Codex App agent initialization

This adapter runs only when the selected profile names `agent_platform: gpt-app` and the host exposes compatible Codex
project, task, messaging, and archival capabilities.

One logical agent maps to one user-visible Codex task. The configured Codex project ID is the runtime-project binding; the
app-returned task ID is the concrete agent-instance ID; a title is presentation only. Model and reasoning values come from
the selected GPT role overlay or explicit compatible defaults.

Before mutation, validate the exact profile, workflow, complete logical-project ID including any suffix, work target,
portable roster, communication topology, role contracts, and host capabilities. Resolve an existing Codex project whose
configured root matches the selected work target. Do not create, rename, or infer a project container.

Create only the explicitly requested complete roster. Record every returned task or pending client ID and bind each
resolved task ID before dispatch. Missing receipts, duplicate roles, mismatched projects, unsupported capabilities, or
incomplete bindings fail closed. A plain `init` may initialize the team only when profile, workflow, logical project, and
this adapter are already explicit; otherwise ask for the missing selection and mutate nothing.

Messaging targets exact task IDs. Remove and delete map to recoverable archival. Replacement verifies successors before
archiving predecessors. Never use titles, sidebar order, recency, or remembered conversation as lifecycle identity.
