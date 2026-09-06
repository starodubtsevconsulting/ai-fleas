# GPT/Codex App agent initialization

This adapter runs only when the selected profile names `agent_platform: gpt-app` and the host exposes compatible Codex
project, task, messaging, and archival capabilities.

One logical agent maps to one user-visible Codex task. The configured Codex project ID is the runtime-project binding; the
app-returned task ID is the concrete agent-instance ID; a title is presentation only. Model and reasoning values come from
the selected GPT role overlay or explicit compatible defaults.

Before mutation, validate the exact profile, workflow, complete logical-project ID including any suffix, work target,
portable roster, communication topology, role contracts, and host capabilities. Resolve an existing Codex project whose
configured root matches the selected work target. Do not create, rename, or infer a project container.

Create every agent directly in that saved project's configured checkout by selecting the Codex `local` environment.
Never request a worktree, temporary checkout, detached checkout, clone, or projectless task for a managed agent. All
agents in one runtime scope share the saved project's main working tree; repository dirty-state and concurrent-write
rules remain governed by the repository and workflow contracts.

Run lifecycle initialization through the public `gpt-app` command. The calling Admin binds itself but does not directly
create governed workers. If Manager is absent, the command creates and canonically initializes exactly one Manager under
the Admin bootstrap exception, then delivers the complete transaction to that Manager. Manager creates and initializes
the remaining explicitly requested roster and returns exact receipts through Admin. Missing receipts, duplicate roles,
mismatched projects, unsupported capabilities, or incomplete bindings fail closed. A plain `init` may initialize the team
only when profile, workflow, logical project, and this adapter are already explicit; otherwise ask for the missing
selection and mutate nothing.

A creation request must use `target.type: project`, the exact resolved Codex project ID, and
`environment.type: local`. A provisional receipt produced by any other environment is invalid and must not be adopted as
the workflow instance. Reconcile or remove that failed candidate before retrying the exact role; never create a second
candidate while the first may still resolve.

Messaging targets exact task IDs. Remove and delete map to recoverable archival. Replacement verifies successors before
archiving predecessors. Never use titles, sidebar order, recency, or remembered conversation as lifecycle identity.
