# GPT App command — Specification

**Status: ACTIVE**

## Input

An explicit lifecycle intent plus an activated profile, workflow, complete logical project, exact work target, and any
existing instance receipts required by the operation.

## Output

Verified exact task receipts or a precise no-mutation failure.

## Invariants

- The selected profile resolves `agent_platform: gpt-app` exactly once.
- Logical roles come from the portable workflow roster; GPT-specific realization comes from the registered adapter.
- One logical agent maps to one exact app-returned task ID in one exact saved Codex project.
- One logical project maps to one exact app-returned sidebar section ID. Names are presentation; unrelated collisions use
  a deterministic numeric suffix and never cause roster merging.
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
- Partial rosters, duplicates, missing receipts, and capability mismatches fail closed.
- Exact peer bindings are distributed only to roles authorized for peer routing; direct-human-only governance roles do
  not receive or acknowledge participant-routing rosters.

## Completion criteria

The requested lifecycle operation returns exact project, logical-agent, role, task, and host bindings, with all affected
instances verified in their requested state.
