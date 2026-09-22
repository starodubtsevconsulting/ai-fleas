# GPT/Codex Agents agent initialization

This adapter runs only when the selected profile lists `gpt-agents` in `agent_platforms.available`, the invocation selects
it explicitly or through `agent_platforms.default`, and the host exposes compatible Codex project, task, messaging, and
archival capabilities.

Initialization has two scopes:

- workflow initialization creates or reconciles only the selected workflow logical project/group;
- system initialization creates or reconciles the one system-scoped System agent for this profile/platform binding.

Workflow initialization must never create, replace, archive, move, or otherwise modify System. System initialization must be explicitly requested. If one active recorded System task already exists, reuse it; if identity is ambiguous or more than one candidate exists, block instead of creating another. Reinitializing System requires an explicit System reinitialization request and follows continuity and knowledge-transfer rules.

Workflow initialization is independent of System availability. The requested saved Codex Project must already exist;
creating it in the GPT UI is a platform prerequisite, not an initializer responsibility. Never include System's task ID, routing address, or
runtime location in a workflow role endpoint's initialization message or roster. The host records exact workflow receipts in
trusted lifecycle state that System may resolve separately. This creates an asymmetric topology: System may initiate
authorized health, continuity, context-exhaustion, or lifecycle contact to exact workflow task IDs, while workflow agents
cannot directly address System. Secure System-identity disclosure is reserved for a future explicit registration contract.

System initialization must include the complete common System role, including its human-facing intent map and
out-of-domain guard. Manual lifecycle requests use the same receipt-backed operation as scheduled checks and execute
immediately; the scheduler is only an automatic trigger.

One logical workflow role endpoint maps to one user-visible Codex task. The configured Codex project ID is the runtime-project binding; the
app-returned task ID is the concrete endpoint-instance ID; a title is presentation only. Model and reasoning values come from
the selected GPT role overlay or explicit compatible defaults. System instead uses the profile's `system_agent.platform_bindings.gpt-agents` realization values and remains outside workflow sidebar groups. After readiness verification, pin its exact task in the global pinned section. Pinning changes presentation only and never makes System a workflow-group member.

Apply the System binding's exact presentation title when creating or reconciling its task. The standard GPT title is
`⚙️ System`; title remains presentation only and never serves as lifecycle identity.

If the profile enables System scheduling, include the portable schedule and initial watch scopes in System's initialization
message. Resolve the profile-owned command configuration's `binding_state.path` beneath the activated profile directory
and include its canonical absolute path and schema in the System message and concrete scheduler prompt. System reads that
exact registry and never searches for receipt-like filenames. System then requests this adapter to create or reconcile one concrete scheduler targeted at its exact task and
verifies the returned receipt before declaring readiness. Accept explicit initial logical-project watch scopes, including a pending exact scope whose group receipt does
not exist yet. Missing pending groups do not fail System initialization; report each missing exact scope to the user on
every scheduled run and check again at the configured interval without agent mutation. On each interval, inspect trusted task-list, lifecycle, availability, and explicit context-health metadata
for receipt-backed watched groups; do not read product conversation payloads merely to estimate exhaustion. The human may
explicitly watch or unwatch groups later without reinitializing System. System is not ready until its enabled scheduler is
verified.

Repeated watch-group inputs create one deduplicated watch-scope set on that scheduler. Each scheduled run iterates every
exact scope once and retains independent receipt cursors, task bindings, health evidence, and pending/active state per
group. A missing or failed group must not suppress safe checks or reports for other groups.

Before workflow mutation, validate the exact profile, workflow, complete logical-project ID including any suffix, non-empty
ordered selected project subset drawn only from registered workflow projects, and its first/primary work target,
portable role-endpoint roster, hidden Router runtime contract, role contracts, and host capabilities. Resolve the exact profile project record
and canonical primary target. Resolve the pre-existing saved Codex Project by exact logical-project name, verify its
immutable ID and complete ordered selected roots against the profile-authorized subset, and record it before creating tasks. Unselected
registered projects are not missing roots. If the saved project does not exist or its selected roots differ, stop with zero task mutation. Never infer a project from its label alone, a nearby folder, or repository
similarity, and never create or edit the saved Project, repository, clone, worktree, or replacement checkout.

Create every workflow agent directly in that one folder-backed saved project's configured primary checkout by selecting the Codex `local` environment.
Never request a worktree, temporary checkout, detached checkout, clone, or projectless task for a managed workflow agent. All
agents in one runtime scope share the saved project's main working tree; repository dirty-state and concurrent-write
rules remain governed by the repository and workflow contracts.

Run workflow lifecycle initialization through the public `gpt-agents` command. The invoking controller first registers
one hidden workflow Router runtime bound to the exact workflow source and saved-project scope. It then resolves the
complete independent role-endpoint roster, mechanically creates every missing task—including Admin—in one batch when
supported, and dispatches their canonical initialization messages concurrently. Each endpoint receives only its own
identity, scope, role/capability contract, readiness requirement, and Router return protocol; it receives no peer IDs,
workflow successor, or communication topology. Admin is a temporary compatibility role, not an initializer or
delegation hop. Manager owns governed lifecycle work only after startup completes. Missing receipts, duplicate roles,
mismatched projects, unsupported capabilities, or incomplete bindings fail closed. A plain `init` refers to workflow scope only; it never initializes System. A human may explicitly request both scopes in one invocation, which runs `initialize-system` and then workflow `initialize` as distinct transactions and receipts.

A creation request must use `target.type: project`, the exact resolved Codex project ID, and
`environment.type: local`. A provisional receipt produced by any other environment is invalid and must not be adopted as
the workflow instance. Reconcile or remove that failed candidate before retrying the exact role; never create a second
candidate while the first may still resolve.

The child task must retain the complete canonical initialization prompt as a real user-visible first message and a
non-empty preview, plus the configured presentation title. A prompt visible only in the controller's create-task tool call
or as a function-call output in the child is not sufficient: the task is absent from normal project catalog queries and is
therefore not an initialized user-visible agent. Reread the host catalog immediately after creation and require the exact
task ID under the exact saved-project ID before dispatching more lifecycle work or committing an active receipt. If the
host cannot persist or reconcile this metadata through a supported operation, return a capability mismatch instead of
declaring readiness or creating another candidate.

The adapter must also normalize the saved project's sidebar task order so the exact managed roster is a contiguous ordered
sequence. Remove stale or archived ordering entries from that sequence; they must not truncate, cap, or interrupt
enumeration of managed agents. Additional human-created tasks, including another Admin task, may coexist outside managed
lifecycle receipts and cannot satisfy a required role.

After normalization, inspect the rendered expanded project with the host's screenshot/computer-vision capability.
Automatically expand or scroll the project as needed and require visual evidence of every exact managed task title and
managed count. Record the capture timestamp, project ID, expected and observed managed titles and counts, any extras, and
the observation method in the binding receipt. An accessibility-tree or backend-catalog result alone is supporting
evidence, not rendered acceptance. Do not ask the human for visual confirmation when the host can capture its UI. A
managed task returned by the backend catalog but absent from the computer-vision-verified expanded saved-project sidebar
is still incomplete initialization. Clear stale same-named custom-section references through supported presentation
operations; the custom section cannot replace saved-project enumeration evidence.

Every canonical initialization message must also identify the selected operational profile by its canonical absolute
directory and include the exact resolved profile-owned binding-registry path and schema. This is required when the public
workflow repository and private operational profile are separate repositories. Never guess `ai-profile/<id>` relative to
the worktree and never substitute the committed example profile.

Messaging targets exact task IDs. Remove and delete map to recoverable archival. Replacement verifies successors before
archiving predecessors. Never use titles, sidebar order, recency, or remembered conversation as lifecycle identity.

Normal workflow delivery is Router-to-endpoint. An endpoint returns its declared result event in its own task turn; the
host Router observes that exact turn, validates run/stage/scope, and chooses the next stage from the workflow. Endpoints
never send task messages to one another. Admin inspection reads bounded Router state and delivery receipts without
becoming the runtime or entering the workflow roster.

A human request to delete a group routes to the `gpt-agents` command's `delete-workflow` lifecycle operation. The logical
project selects the recorded workflow agent-task bindings and complete scoped-folder receipt; it does not identify System or another saved
Codex project itself. The operation recoverably archives all exact bound workflow tasks, retires only the exact workflow
binding, retains a deletion receipt, and preserves System, the saved project, checkout, repository, and work target.
