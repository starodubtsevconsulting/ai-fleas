# GPT Agents command — Specification

**Status: ACTIVE**

## Input

An explicit lifecycle intent plus an activated profile, workflow, complete logical project, non-empty selected project
subset drawn from the registered workflow projects, exact primary project, and any
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
- One logical project may cover one or more profile-registered folders or repositories. The first selected project is the
  primary project: it hosts rules, commands, workflow definitions, and the Codex agents. Later selected entries are
  associated work projects. Workflow registration makes a project available; it does not require that project in every
  logical project's saved-project scope.
- Logical project and group are synonyms. On GPT they map to one exact folder-backed saved project. A profile project is
  one scoped folder inside it; the first folder is primary and later folders extend its scope.
- Workflow initialization requires, resolves, and verifies one pre-existing logical saved-project ID plus its complete
  ordered selected scoped-folder binding set from exact profile-authorized project records before creating tasks. Saved-project creation and
  editing are outside the command. It never infers from labels or nearby folders.
- Human-facing `group`, `workflow group`, and `logical project` may select the same lifecycle scope, but the command must
  not conflate that scope with a custom sidebar section or with one individual scoped folder.
- The caller is a mechanical initialization controller, not an implicit roster member. It resolves the complete effective
  roster and directly creates every missing role, including Admin and Manager.
- `initialize` is idempotent recovery. It enumerates active and archived catalogs to exhaustion, reactivates exact
  receipt-backed archived roster members in the requested workflow scope, and creates a task only when no valid active or
  archived receipt exists. A completely archived roster is one batch restoration case, not an empty or ambiguous roster.
- The exact profile, workflow, and logical-project initialization request authorizes restoration of its receipt-backed
  archived members without requiring the human to enumerate task IDs. It does not authorize unrecorded, superseded,
  foreign-scope, or title-matched archived tasks.
- An explicit human roster contraction supplies the removed role's complete durable task-receipt history to mechanical
  reconciliation. Every exact active retired receipt is recoverably archived; already archived generations remain
  archived. Titles never establish retired-role identity.
- Admin is a temporary compatibility role and never bootstraps, delegates, or serializes roster initialization.
- The host batches task creation, resolves provisional receipts together, and dispatches canonical initialization messages
  concurrently when supported. Manager-owned governed lifecycle begins only after startup completes.
- Portable agent IDs and GPT role bindings form an exact one-to-one set before any task creation.
- Titles are presentation only; model, reasoning, readiness token, lifecycle, and role contract resolve from the GPT and
  portable manifests.
- Every creation request carries the complete canonical initialization prompt as a non-empty first user message and an
  effective non-empty presentation title. These fields make the task catalogable; neither becomes lifecycle identity.
- The child task must persist that prompt as user-visible first-message and preview metadata. A controller-side tool-call
  input or function-call output alone is an invalid creation receipt.
- Initialization commits no active task receipt until a fresh host task-catalog read returns every exact task ID beneath
  the exact logical saved-project ID. Direct task access, readiness output, local persistence, or a requested creation
  target is insufficient evidence of project membership.
- A task omitted from the saved project's catalog is an invalid provisional creation. It is reconciled by exact candidate
  ID before another task is created, and readiness from that hidden candidate never makes the roster complete.
- The saved-project sidebar order contains the exact managed roster as a contiguous ordered sequence without stale or
  archived task IDs between managed agents. Additional human-created tasks, including another Admin task, are allowed
  outside lifecycle receipts; they cannot satisfy or replace a required roster member.
- Completion requires a screenshot/computer-vision inspection of the rendered expanded project. The adapter automatically
  expands or scrolls the project as needed, verifies every exact managed title and count, and records the capture time,
  project, expected and observed managed titles and counts, extras, and observation method. Backend catalog or
  accessibility-tree data alone is insufficient. Human visual confirmation is not a normal acceptance dependency when
  the host can capture its UI.
- A stale custom section with the logical-project name is cleared through supported presentation operations. It never
  substitutes for the exact saved-project roster or counts as initialization evidence.
- Every initialization message carries the canonical absolute selected-profile directory and the host plugin's exact
  task-binding source. Private operational profiles are never replaced with public examples or repository-relative guesses.
- Profile-owned command configuration may override only declared GPT realization fields. It cannot add/remove required
  roles or change authority, lifecycle, readiness, dependencies, communication topology, or workflow pool bounds.
- Initialization never relies on title, sidebar position, recency, or filesystem sibling discovery.
- Provisional task creation is awaited and verified before initialization messages are sent.
- Lifecycle prompts sent to already Router-bound endpoints require a short-lived host permit bound to the exact task ID,
  prompt digest, action, and readiness token. The Router consumes the permit once and skips workflow-result enforcement
  only for that turn; prompt text alone cannot request a bypass. The controller atomically registers the permit and uses
  daemon-backed `codex queue`, because cross-task tool messages represented as function-call output do not run the
  endpoint's `UserPromptSubmit` hook.
- Replacement verifies the successor before recoverably archiving the predecessor.
- A Personal Governor successor is always a projectless, fresh-history task created with the platform's new-task primitive, never a workflow-project task, fork, or history-bearing clone. Its bootstrap carries canonical references and durable-memory bindings, not predecessor transcripts, summaries, turns, or reconstructed conversation context.
- `delete-workflow` requires the complete recorded logical saved-project, scoped-folder, and task bindings; it
  recoverably archives the exact bound tasks and preserves the saved project and every scoped folder.
- A successful workflow deletion retains a tombstone receipt; a missing or conflicting binding fails before mutation.
- Partial or non-visible rosters, duplicates, missing receipts, and capability mismatches fail closed.
- A missing, ambiguous, or conflicting saved Project stops before agent mutation.
- Canonical profile and workflow manifests are the desired roster; the host's active and archived catalogs are the
  actual task inventory. The GPT host plugin supplies exact role-to-task/project bindings. Confirm each bound task ID
  with the host before claiming it is live or reusing it; a stale plugin status, title, or transient caller memory is
  not identity evidence. The host scheduler receipt owns System watch scopes.
- No profile-owned GPT task registry or per-file source fingerprint map is maintained. Current drift checks read
  canonical source files when needed.
- System initialization and its scheduler receive exact host plugin task bindings for authorized groups and verify
  them against the host catalogs; filename discovery of an old profile registry is prohibited.
- Exact peer bindings are distributed only to roles authorized for peer routing; direct-human-only governance roles do
  not receive or acknowledge participant-routing rosters.

## Completion criteria

The requested workflow lifecycle operation returns exact project, logical-agent, role, task, and host bindings, with all affected
instances returned by a fresh host task-catalog read and verified by a recorded screenshot/computer-vision inspection of
the rendered expanded-project sidebar beneath the exact saved project. Additional human-created tasks may coexist but
never count toward the managed roster.
A `check-update` operation instead returns installed/latest stable version
evidence and a recommendation, or an explicit no-mutation unavailable result. A `delete-workflow` operation instead
returns the logical saved-project ID, ordered scoped-folder bindings, exact recoverably archived task IDs, and verified
outcomes while confirming that the saved Codex project and folders were preserved. A System lifecycle operation returns
its exact profile/platform, task, and host binding, its pinning outcome, and confirmation that it is outside every workflow section.
