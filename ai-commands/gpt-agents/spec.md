# GPT Agents command — Specification

**Status: ACTIVE**

## Input

An explicit lifecycle intent plus an activated profile, workflow, complete logical project, exact work target, and any
existing instance receipts required by the operation.

## Output

Verified exact task receipts or a precise no-mutation failure.

## Invariants

- The selected profile resolves `agent_platform: gpt-agents` exactly once.
- `check-update` is read-only, uses only the host application's trusted stable update channel, and returns an explicit
  unavailable result rather than treating missing version evidence as current.
- An available update produces a recommendation only; installation requires a separate explicit human decision.
- Logical roles come from the portable workflow roster; GPT-specific realization comes from the registered adapter.
- `initialize` realizes the complete GPT-specific workflow roster; it does not inherit Hermes App's profile/group
  realization or impose its own task count on other platform adapters.
- One logical agent maps to one exact app-returned task ID in one exact saved Codex project.
- One logical project maps to one exact app-returned sidebar section ID. Names are presentation; unrelated collisions use
  a deterministic numeric suffix and never cause roster merging.
- Human-facing `group`, `workflow group`, and `logical project` may select the same lifecycle scope, but the command must
  not conflate that scope with either its custom sidebar section ID or its saved Codex project ID.
- The authorized calling Admin task realizes `initializer.agentId`; initialization does not create a duplicate Admin.
- The command enforces Manager-owned governed-roster lifecycle: Admin may bootstrap one missing Manager, then Manager
  creates or reconciles every remaining governed role.
- Portable agent IDs and GPT role bindings form an exact one-to-one set before any task creation.
- Titles are presentation only; model, reasoning, readiness token, lifecycle, and role contract resolve from the GPT and
  portable manifests.
- Profile-owned command configuration may override only declared GPT realization fields. It cannot add/remove required
  roles or change authority, lifecycle, readiness, dependencies, communication topology, or workflow pool bounds.
- Initialization never relies on title, sidebar position, recency, or filesystem sibling discovery.
- Provisional task creation is awaited and verified before initialization messages are sent.
- Replacement verifies the successor before recoverably archiving the predecessor.
- `delete-workflow` requires the complete recorded logical-project, saved-project, section, and task bindings; it
  recoverably archives the exact bound tasks, deletes only the exact custom sidebar section, and preserves the saved
  Codex project, checkout, repository, and work target.
- A successful workflow deletion retains a tombstone receipt; a missing or conflicting binding fails before mutation.
- Partial rosters, duplicates, missing receipts, and capability mismatches fail closed.
- Exact peer bindings are distributed only to roles authorized for peer routing; direct-human-only governance roles do
  not receive or acknowledge participant-routing rosters.

## Completion criteria

The requested lifecycle operation returns exact project, logical-agent, role, task, and host bindings, with all affected
instances verified in their requested state. A `check-update` operation instead returns installed/latest stable version
evidence and a recommendation, or an explicit no-mutation unavailable result. A `delete-workflow` operation instead
returns the logical-project and saved-project IDs, deleted section ID, exact recoverably archived task IDs, and verified
outcomes while confirming that the saved Codex project and repository were preserved.
