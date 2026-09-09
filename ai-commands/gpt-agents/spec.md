# GPT Agents command — Specification

**Status: ACTIVE**

## Input

An explicit lifecycle intent plus an activated profile, workflow, complete logical project, complete registered project
set, exact primary project, and any
existing instance receipts required by the operation.

## Output

Verified exact task receipts or a precise no-mutation failure.

## Invariants

- The selected profile lists `gpt-agents` in `agent_platforms.available`; explicit invocation selection takes precedence
  over `agent_platforms.default`, and an unavailable selection fails closed.
- `initialize-system` is an explicit lifecycle transaction for exactly one System task per profile/platform binding.
- System is never placed in or lifecycle-bound to a workflow logical project or sidebar section.
- System is pinned in global task navigation when the host supports task pinning; lack of pinning support is reported and
  does not permit putting System into a workflow section.
- A request for both scopes runs explicit System initialization and workflow initialization as two ordered transactions;
  ordinary `initialize` alone never creates, replaces, archives, or moves System.
- Workflow initialization succeeds independently of System state and never distributes System's task ID, routing address,
  or runtime location to workflow agents.
- System-to-workflow topology is asymmetric: System resolves exact group/task targets from trusted host lifecycle receipts
  and may initiate authorized lifecycle contact; workflow agents have no direct System route.
- When enabled, System initialization uses a two-phase handshake: the initializer supplies portable scheduling intent,
  System creates or reconciles its concrete timer through the selected platform adapter, and `SYSTEM_READY` requires the
  verified scheduler receipt with its ID, interval, and exact active or pending logical-project watch scopes.
- Watch scope is user-facing and changes only through explicit watch/unwatch operations. Scheduled checks use trusted
  agent-list and lifecycle/context-health metadata, not product conversation payloads used as an exhaustion heuristic.
- A requested group without a lifecycle receipt remains a valid pending watch scope. Each scheduled run reports its
  missing state to the user and retries at the configured interval without mutating or inferring agents.
- Repeated `--watch-group` inputs form one deduplicated exact watch-scope set on one System scheduler. Every run checks each
  group once and isolates its receipt cursor, lifecycle bindings, context-health evidence, and result from other groups.
- `check-update` is read-only, uses only the host application's trusted stable update channel, and returns an explicit
  unavailable result rather than treating missing version evidence as current.
- An available update produces a recommendation only; installation requires a separate explicit human decision.
- Logical roles come from the portable workflow roster; GPT-specific realization comes from the registered adapter.
- `initialize` realizes the complete GPT-specific workflow roster; it does not inherit Hermes App's profile/group
  realization or impose its own task count on other platform adapters.
- One logical agent maps to one exact app-returned task ID and launches in the logical group's primary saved Codex project.
- One logical project may cover multiple profile-registered folders or repositories. The first workflow project is the
  primary project: it hosts rules, commands, workflow definitions, and the Codex agents. Later entries are associated
  work projects, and the primary binding never narrows the complete registered project set.
- Logical project and group are synonyms. On GPT they map to one exact folder-backed saved project. A profile project is
  one scoped folder inside it; the first folder is primary and later folders extend its scope.
- Workflow initialization requires, resolves, and verifies one pre-existing logical saved-project ID plus its complete
  ordered scoped-folder binding set from exact profile project records before creating tasks. Saved-project creation and
  editing are outside the command. It never infers from labels or nearby folders.
- Human-facing `group`, `workflow group`, and `logical project` may select the same lifecycle scope, but the command must
  not conflate that scope with a custom sidebar section or with one individual scoped folder.
- The caller is a mechanical initialization controller, not an implicit roster member. It resolves the complete effective
  roster and directly creates every missing role, including Admin and Manager.
- Admin is a temporary compatibility role and never bootstraps, delegates, or serializes roster initialization.
- The host batches task creation, resolves provisional receipts together, and dispatches canonical initialization messages
  concurrently when supported. Manager-owned governed lifecycle begins only after startup completes.
- Portable agent IDs and GPT role bindings form an exact one-to-one set before any task creation.
- Titles are presentation only; model, reasoning, readiness token, lifecycle, and role contract resolve from the GPT and
  portable manifests.
- Profile-owned command configuration may override only declared GPT realization fields. It cannot add/remove required
  roles or change authority, lifecycle, readiness, dependencies, communication topology, or workflow pool bounds.
- Initialization never relies on title, sidebar position, recency, or filesystem sibling discovery.
- Provisional task creation is awaited and verified before initialization messages are sent.
- Replacement verifies the successor before recoverably archiving the predecessor.
- `delete-workflow` requires the complete recorded logical saved-project, scoped-folder, and task bindings; it
  recoverably archives the exact bound tasks and preserves the saved project and every scoped folder.
- A successful workflow deletion retains a tombstone receipt; a missing or conflicting binding fails before mutation.
- Partial rosters, duplicates, missing receipts, and capability mismatches fail closed.
- A missing, ambiguous, or conflicting saved Project stops before agent mutation.
- The profile-owned `gpt-agents-binding-state.v1` registry is the durable identity authority for project, task,
  System scheduler/watch, readiness/generation, and tombstone receipts; titles and transient caller memory are not.
- System initialization and its scheduler receive the profile-resolved canonical absolute binding-registry path and schema;
  receipt discovery by generic filename or directory search is prohibited.
- Exact peer bindings are distributed only to roles authorized for peer routing; direct-human-only governance roles do
  not receive or acknowledge participant-routing rosters.

## Completion criteria

The requested workflow lifecycle operation returns exact project, logical-agent, role, task, and host bindings, with all affected
instances verified in their requested state. A `check-update` operation instead returns installed/latest stable version
evidence and a recommendation, or an explicit no-mutation unavailable result. A `delete-workflow` operation instead
returns the logical saved-project ID, ordered scoped-folder bindings, exact recoverably archived task IDs, and verified
outcomes while confirming that the saved Codex project and folders were preserved. A System lifecycle operation returns
its exact profile/platform, task, and host binding, its pinning outcome, and confirmation that it is outside every workflow section.
