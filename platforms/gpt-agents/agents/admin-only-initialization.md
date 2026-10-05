# Admin-only initialization on codex-app

## Reusable entry point for authorized agents

### Object-oriented implementation

The initialization machinery is composed from responsibility-specific objects:

- `AdminInitializationBuilder` owns canonical file/registry dependencies and builds validated payloads.
- `NativeAdminPreparation` composes the builder with `GptNativeCatalog` for fresh authorized scope discovery.
- `NativeAdminHost` owns the native connection, injected lifecycle ports, and instance-local transient creation evidence.
- `WorkflowAdminInitializer` owns the six-port host and executes the fail-closed creation/reuse transaction.
- `NativeAdminLifecycle` coordinates native initialization, explicit retry, submission, and controller release.
- `AppAdminLifecycle` coordinates explicitly selected owning-app submission and retry.
- `NativeInitAuditController` authenticates the one-use dynamic audit call and records its exited-worker evidence.
- `EphemeralInitAudit` owns the isolated one-shot inference process and effect limits.
- `AdminControllerCommand` discovers trusted native runtime paths and invokes the supported Admin-only transaction.

Constructors do not perform host or filesystem IO. Call the object's operation
explicitly to perform its documented effects. Existing named function exports are
compatibility wrappers around these objects, so current launcher and controller
callers retain their argument shapes. Pure prompt, path, scope, and evidence helpers
remain functions; they do not own lifecycle state. Classes do not add authority,
caching, readiness shortcuts, or automatic lifecycle delivery.

This is a workflow-generic mechanism, not a Financial Insights command. A Personal
Governor or another authorized lifecycle controller starts here after the human
approves the exact workflow Admin. Being a higher-level agent alone grants no
bootstrap authority: verify the caller's declared capabilities and human request.
See the [bootstrap infrastructure overview](../plugins/ai-fleas-gpt/modules/agent-bootstrap/README.md)
for the plugin, hooks, receipt storage, and automatic versus agent-directed steps.

For any workflow, require one portable Admin declaration using the common Admin
contract and `ADMIN_READY`, the selected platform's Admin realization, canonical
profile/workflow/project references, and a usable saved project with the complete
authorized attached roots. The profile selects the platform; this mechanism does
not add a platform selection to the portable roster. Financial Insights is the
tested example, not evidence that every existing roster already meets these
prerequisites or that other platform adapters implement this transaction.

The Admin may use the common role directly or a workflow-specific Admin contract.
For a specialization, its portable initializer must explicitly declare
`commonRoleDefinition` resolving to the canonical common Admin contract, and the
portable `roleDefinition` and adapter `role_contracts.admin` must resolve to the
same specialization. The builder includes both contracts in the canonical INIT
sources; the serialized-plan controller verifies these declarations and sources
again before effects. A Markdown link or an Admin title alone does not declare
this composition.

The reusable effectful command is
`node platforms/gpt-agents/initialize-admin-command.mjs --request REQUEST.json`
(use `--request -` to read JSON from stdin without a request file). Governor may
invoke it only after the exact direct human agreement described above. It discovers
the installed executable, native control socket, complete saved-project scope, and
trusted hook location; it never installs plugins or restarts the app. Its JSON
`authorization` is the caller's attestation of the human request, not cryptographic
proof. Checking that the human actually agreed remains the Governor/controller's
responsibility. Native readiness and controller release do not prove that the app
placed the chat in its sidebar project. Complete success also requires
`appProjectAttached: true` from the trusted owning-app verifier.

`AdminControllerCommand` requires trusted `resolveAppProject({scope})` and
`verifyAppProject({taskId, scope})` adapters. The resolver reads fresh complete app
catalogs before lifecycle effects and returns
`{nativeProjectId, logicalProjectId, appProjectId}` for the exact selected scope.
The command retains that immutable app ID and requires exactly the same ID after
readiness; a different nonempty project ID is a failed handoff, even with the same
working directory. Missing adapters block before connection or lifecycle effects;
an invalid mapping blocks before allocation or INIT.
It must freshly verify the exact task's app project association and the mapping
between the expected native saved project and immutable app project ID. Return
`{taskId, attached: true, nativeProjectId, logicalProjectId, appProjectId}` only
after checking the owning-app catalogs. App and native project IDs are distinct;
matching titles or working directories are not mapping evidence. Request JSON
cannot supply this verifier or attest that attachment occurred.

For an app-tool controller such as Governor, a trusted bridge supplying both
callbacks is required; the standalone CLI is not an effectful substitute. For
an existing task created before this preflight gate, inspect the handoff using
supported app tools:

1. Retain the command's exact `taskId`; do not create another Admin or resend INIT.
2. Open that existing chat with `navigate_to_codex_page({threadId: taskId})`.
   In the tested host, opening reconciled a native-created task's app project
   association. Opening alone is not evidence that reconciliation succeeded.
3. Read fresh `list_projects` and `list_threads` catalogs. Verify that the exact
   chat is associated with the expected immutable app project ID for the selected
   logical project. Stop if that mapping is absent or ambiguous. Use an adequate
   catalog limit or a supported exact-ID lookup; a missing recent-list entry does
   not prove the task is absent and never authorizes duplicate creation.
   Keep this presentation check separate from the native scope
   and binding checks; a label alone never establishes Admin authority.
4. Only after both native readiness/release and app attachment pass may Governor
   report complete success and link the existing Admin. Otherwise report the
   attachment blocker with the existing task ID, without retrying initialization.

Task naming is presentation metadata, not task identity, delivery, or readiness
evidence. After native `turn/start` acceptance, the controller keeps the exact
audit handler registered through readiness verification and native handoff. It
attempts the configured title only after fresh durable task and binding metadata
are available, with a small bounded retry. A title result is reported separately
as `titleStatus` (`applied`, `deferred`, or `failed`); it never causes another
task, binding registration, or INIT submission. Native readiness, controller
release, and owning-app attachment remain separate results (`readinessStatus`,
`controllerReleaseStatus`/`controllerReleased`, and `appProjectAttached`).

This is controller-followed orchestration: the CLI cannot call the desktop tool
on its own, and native writer release does not verify app catalog placement.

The standalone CLI currently has no supported owning-app catalog bridge. It
therefore reports `ADMIN_APP_PROJECT_BRIDGE_UNAVAILABLE` before connection,
task allocation, retry, or INIT, with `lifecycleStarted: false`. An integration
must provide a trusted owning-app verifier before using this command. If that
verifier fails after native readiness and release, the controller instead reports
`ADMIN_APP_PROJECT_ATTACHMENT_UNVERIFIED`, retaining the exact `taskId` and
`adminInitialized: true`, without an overall success token.
The controller must inspect that exact chat in the app catalog;
never report a complete handoff from the native result alone. If it is projectless,
repair that existing chat through a supported app operation, not by creating a
duplicate. If opening does not reconcile it and no supported attachment operation exists, report that concrete
capability gap. Do not edit host databases, retry INIT, or silently change scope.

A separately human-authorized replacement uses `replaceTaskId` and
`replaceGeneration` in both request and authorization, and sets successor
`generation` to predecessor generation plus one. The builder emits the exact
`replaces` successor-first receipt. The controller verifies the sole live ready
predecessor, its full original authorized scope and saved project, then allocates
one fresh successor with the newly approved canonical subset. Only that exact
predecessor may be excluded from duplicate checks. Stop activation supersedes it
only after successor readiness; an unrelated, changed, missing, archived or
ambiguous predecessor blocks. Retire the old host chat only after verified
successor readiness, controller release and exact owning-app attachment. This
is not automatic presentation repair, restoration, or permission to send an
operational message to either Admin.

The injectable controller API remains `initializeNativeAdmin(request, options)`
in `initialize-native-admin.mjs`. For a
fictional `example` profile and `sample-workflow`, the request shape is:

```js
const request = {
  profilePath: canonicalProfilePath,
  profileId: 'example',
  workflowId: 'sample-workflow',
  projectIds: ['sample-project'],
  authorization: {
    humanApproved: true,
    profileId: 'example',
    workflowId: 'sample-workflow',
    projectIds: ['sample-project'],
    logicalProjectId: 'example-sample-workflow',
  },
};
```

Supply a connected native `client`, trusted `pluginData` and `installedScripts`
locations, and actual `verifyApproval` and `verifyPluginActive` callbacks in
`options`. The native route defaults to `auditTransport: 'ephemeral-process'` and
also requires `options.auditExecutable`, the verified absolute installed Codex
executable. These are host-provided capabilities, not guessed paths or functions
that simply return true. `prepareNativeAdmin` discovers the saved project from
canonical project roots and the logical name; when more than one canonical project
is available, supply the human-authorized non-empty subset. Optional
`logicalProjectId` and `runtimeScope` must follow the configured scope convention.
Inspect `status`, exact identity, readiness evidence, and release result before
handing off. A blocked result is not partial success.

The default native INIT provides exactly one `ai_fleas_init_audit` dynamic tool to
the new Admin. After reading every canonical source and completing its own preflight, Admin supplies a bounded
`preflightSummary` plus `preflight` containing `completed: true`, the exact complete `sourceRefs`,
and the resolved `effectiveModel` and `reasoning`. This is a completed-read attestation, not proof
of cognition or host-observed reads. Incomplete, future-tense, wrong-source or wrong-model attestations
are rejected before inference. The controller supplies its own canonical source snapshots and digests,
observed task model/effort, endpoint precedence and fixed ephemeral process arguments to the auditor.
The owning controller authenticates the actual task, INIT turn,
generation, nonce, source references and authorized scope, then runs a process-owned
`codex exec --ephemeral` utility with the configured Admin model and reasoning.
Inherited configuration, connectors, execution tools and nested agents are disabled;
the utility audits supplied evidence without reading financial records. It is not
a registered workflow role or independent reviewer. Admin remains `codex-app`;
this explicit utility transport does not change the operational platform.

Only actual process exit with a completed structured result produces an audit
receipt. The Stop hook requires a passed receipt before activation; the controller
also compares it with the exact completed native dynamic-tool call and rejects
any persistent descendant. A worker failure or blocked verdict cannot become
`ADMIN_READY`. The older explicitly selected `native-child` route still requires
an owning child-close operation and verified release; neither route falls back.
An explicitly authorized same-task retry may renew a stopped pending INIT whose
single ephemeral audit tool call failed and whose final response is
`BLOCKED_INIT_SUBAGENT`, provided no audit receipt or readiness exists. The
controller verifies the exact completed attempt and complete catalogs, installs
a fresh audit handler, and increments the generation before one new INIT. It
never retries a running, uncertain, successful, or audit-blocked attempt.

Newly created native Admin handoff verifies a stopped, completed exact INIT and
uses only a supported non-archiving writer-release route. Archive/unarchive cycles
are prohibited: archival is terminal, including during initialization handoff.
The native controller verifies the stopped INIT and calls `thread/unsubscribe`;
it never uses archival as writer release. The host may retain an unsubscribed
thread for its inactivity grace period; unsubscribe alone is not verified unload.
Verified `notLoaded` state and complete loaded-catalog exclusion are required
after release. Failure preserves the unarchived exact task and reports the actual
missing release capability; it never authorizes restoration or another INIT.

This removes the INIT audit's persistent child/writer dependency. It does **not**
implement automatic END, guarantee UI archival, or repair a shared-daemon writer
held by another chat. Report controller-release and archive evidence separately.

There is no effectful `launcher.mjs initialize-admin` command; use the separate
`initialize-admin-command.mjs` above. The launcher offers
only `preflight-admin`, which validates/builds a plan without creating or messaging
a task. Do not substitute a full-roster launcher or compose an ad-hoc task creation
and readiness claim. A controller without the required host ports must report the
missing capability. An owning-app integration must explicitly provide its trusted
send and live-thread ports for the app adapter described below; it cannot substitute
native persisted turn status for the owning app's current execution state.

This controller-followed route initializes exactly one declared workflow Admin, not
the roster. The portable Admin contract remains authoritative. Do not initialize
Financial Analyst, Records / Bookkeeping, Financial Reviewer, Router, or System.

After direct human agreement, resolve the exact authorized profile, workflow,
non-empty project subset, logical project and saved project. Run the read-only
`launcher.mjs preflight-admin --request REQUEST.json` builder. The JSON request contains
`profilePath`, `profileId`, `workflowId`, `projectIds`, `logicalProjectId`,
`savedProjectId` (the first project's saved host ID), `runtimeScope`, `savedProjects`
(one `{projectId, savedProjectId}` per selected project), positive `generation`, and `authorization` containing
`humanApproved: true` and matching profile/workflow/project/logical scope. Approval
must come from the human; a JSON flag is not independent evidence of agreement.
The prepared authorization is explicitly unverified: the controller's trusted
`verifyApproval` host port must validate actual direct-human approval before effects.

For a manual Admin bootstrap where the human names the exact profile/workflow logical
project but not individual project IDs, first call
`node platforms/gpt-agents/launcher.mjs discover-admin-scope --request REQUEST.json`.
The command calls `discoverManualAdminBootstrapScope` from `prepare-native-admin.mjs`
and returns `projectSelection: attached-authorized-intersection` plus its saved-project
evidence. Supply the
configured operational profile path explicitly. The resolver selects the unique
native saved project by the exact logical-project name, reads its complete roots via
`project/read`, and returns only the intersection with that profile/workflow's
canonical project declarations. Use that non-empty result as the exact project
subset for preflight. When the discovery request includes the controller's direct-human
authorization evidence for the exact profile, workflow, and logical project, the
command returns a complete `preflightRequest`. Its authorization records
`projectSelection: attached-authorized-intersection` and the immutable saved-project
discovery evidence; pass that request unchanged to `preflight-admin`. The later
initializer still performs fresh complete-root discovery before effects. Do not infer profile precedence from the current directory,
Git tracked/ignored state, a nearby same-ID profile, a screenshot, or the primary
path returned by an app project listing. Missing configured profile selection,
ambiguous saved-project names, incomplete native roots, and an empty intersection
remain blockers before lifecycle effects.

The supported controller transaction in `initialize-workflow-admin.mjs` uses fresh
host ports to inspect the task catalog, saved-project catalog, exact bindings and
platform prerequisites. Reuse only an exact active Admin with matching identity,
scope and verified `ADMIN_READY`. Conflicting or ambiguous identity blocks rather
than creating another Admin. When absent, create one task with the canonical source
references, exact scope, human bootstrap authorization and `INIT` prompt returned
by the builder. Register the exact binding through the existing generic plugin
registration API, then submit the prompt once. The native route uses `turn/start`;
the queue CLI is a separate transport, not an additional delivery step. Verify the
actual task, binding and readiness. Submission or a pending binding is not readiness.

An archived Admin is permanently retired, even when its retained receipt says
active or pending. Select only live, unarchived candidates. Do not search archived
chats, read their transcripts, offer restoration, or treat archived versions as
duplicates or blockers. A minimal exact-ID status check may exclude a stale
receipt; then continue the approved fresh initialization without asking about the
retired chat. Never restore, unarchive, resume, retry, rebind, or message it.
A missing or ambiguous host task is not verified archived status.

Controller integration imports `initializeWorkflowAdmin(preparedPlan, host)`;
the prepared plan may be JSON-serialized. The host must implement all six ports:

- `verifyApproval` attests actual human approval; `prerequisites` verifies usable canonical sources and the selected platform.
- `catalog` returns fresh, complete `tasks`, `projects`, and generic `bindings`; binding entries expose the existing registry key as `taskId`. Each saved project carries `rootsComplete: true` and `roots`, its complete verified canonical absolute attached-folder list. A primary `path` or `root` alone does not establish that list.
- `create` returns `{taskId, status: 'created'}` for one new Admin task; it must not create a roster.
- `initialize` queues the supplied exact binding and prompt and returns `{taskId, status: 'submitted'}`.
- `wait` returns `{taskId, status: 'complete', turnId, token: 'ADMIN_READY'}`; the fresh active binding must independently carry matching `completedTurnId` and `completedAt` evidence.

`native-app-server.mjs` connects to the existing native app-server control socket,
without starting another daemon. `native-project-catalog.mjs` uses native
`project/list` and `project/read` to discover immutable project IDs and complete
attached roots. Do not mix these IDs with presentation/wrapper IDs returned by a
different API. `prepare-native-admin.mjs` resolves a unique canonical project
automatically and discovers its native ID. `initialize-native-admin.mjs` connects
the plan to `native-admin-host.mjs`: complete active/archived catalogs, one narrow
read-only Admin creation, generic binding registration, exact native INIT delivery,
and matching completed-turn proof for creation and reuse. The caller must still
attest actual human approval and verify the bootstrap plugin is active/trusted;
an untrusted JSON flag cannot replace those attestations. Human-only follow-up and actual reading of sources remain controller/role
instructions, not a message firewall or source-reading attestation. Older active
receipts without completion evidence cannot be silently reused or duplicated.

For CLI recovery, include the exact `retryTaskId` in both the request and its
human-authorized `authorization`; the controller invokes the same-task retry API
rather than creating another Admin. This is an explicit recovery action after a
verified failure, not an automatic resend on timeout.

`retryNativeAdminInitialization` is an explicit, human-authorized recovery route,
not an automatic resend. It verifies the same pending Admin, scope, catalog and
terminated INIT before renewing the permit and resuming that exact task. A completed
attempt qualifies with an expired permit and an explicit
`BLOCKED_INIT_PERMIT_EXPIRED` final response, or the exact failed ephemeral-audit
case described above. An uncertain or still-running attempt
must be inspected, not duplicated. Native permission requests require a trusted
controller handler and actual human approval; the transport never approves them.
After verified readiness, unsubscribe the controller and verify that the exact task
is unloaded and absent from the complete loaded catalog. `controllerReleased`
proves lease release, not that the human has opened or typed into the UI.
A chat still locked to another client is not a completed controller handoff.

For a failed newly-created INIT, the native initializer attempts to release only
its own lease after fresh exact stopped-task evidence. It never interrupts or
resends a running attempt. Inspect `controllerReleased` and `releaseBlocker` on
blocked results; no cleanup success is implied. Recoverable archive is a separate
human-authorized action. Use the owning daemon's native `thread/archive` route
when a separate archive client conflicts with its writer; first verify the exact
task, stopped turn and released descendants, then verify archived membership.

The app's `send_message_to_thread` tool supplies inter-task steering, not the native
user-prompt lifecycle event. It cannot activate INIT through the native prompt
route. The explicitly selected `app-admin-initialization.mjs` adapter instead uses
an INIT-only nonce handshake: the trusted controller registers an exact pending
permit, sends once, and correlates the actual Admin's exact nonce acknowledgement
to one new host turn. It then binds only that pending turn; the standard Stop hook
and completed-turn checks remain responsible for activation. The actor must verify
its own immutable turn matches the acknowledged receipt before readiness. An ACK
is delivery evidence, not Admin readiness, human approval, or proof of source reads.
Timeout, changed/expired receipt, wrong nonce, prior active turn, or ambiguous
acknowledgement stops without automatic resend or replacement creation.
This is the authorized controller-INIT exception in the common Admin contract;
all other task instructions remain rejected. An existing app writer can prevent
native resume; select the supported app adapter explicitly rather than competing
with the writer or silently falling back to it.

`retryAppAdminInitialization` performs the app-owned same-task recovery preflight,
including actual human approval, installed/trusted hooks, complete native scope,
unique pending Admin identity, and owning-app idle status. Its trusted callbacks
send the single INIT and read the owning app's actual live turn. Native persisted
turn status alone is insufficient for app-owned execution. After delivery, verify
the matching completed turn, active receipt, and owning-app idle state; do not send
another message to the initialized Admin as part of that verification.

The generic registry uses atomic file replacement, not cross-process
compare-and-swap. Controllers must serialize lifecycle registry mutations;
concurrent lifecycle writers are unsupported. Source reading, actual human
approval, and rejection of ordinary task instructions remain controller/role
obligations rather than a host message firewall. Tests and live readiness evidence
must not be described as proving those stronger capabilities.

Resolve the human-named profile/workflow and platform from canonical configuration;
use its naming convention to locate the saved-project candidate, then verify its
immutable ID and complete attached roots. Do not request screenshots or repeat
discoverable questions. Match selected authorized data roots against any attached
root, not just the primary checkout; extra host folders do not grant workflow
authority. If folder enumeration is unavailable, report
`SAVED_PROJECT_ROOTS_UNVERIFIED`, not `SAVED_PROJECT_MISMATCH`, and do not tell the
human to replace an otherwise valid primary folder. The current `list_projects`
tool exposes a primary path but not complete attached folders; use native
`project/list` and `project/read` instead. A screenshot is a discovery hint, not
host verification.

The launcher preflight itself performs no task creation, registration or delivery.
The existing queue helper registers a pending exact binding and queues one prompt;
it does not read fresh task catalogs or prove human authorization. Only call it
after controller verification. Never use a supplied catalog snapshot as fresh host
proof. If the host cannot expose or perform a required operation, report its
concrete unsupported capability and stop without an Admin readiness claim.

Governor's authorization ends after the one-time verified bootstrap and handoff.
Do not send a follow-up to Admin, choose its execution mode, initialize the remaining
roster, or silently switch platform. The human owns subsequent Admin direction.
Admin retains its common scoped capabilities, including human-directed emulated
work and explicitly requested full-roster initialization with normal gates.

## Cleanup and failed archival

The Admin owns its bounded INIT audit child's cleanup after verifying its evidence;
follow the common [parent-owned cleanup duty](../../../ai-workflows/_common/agents/utility-subagents.md#parent-owned-cleanup-and-handoff).
The bootstrap controller's release of its own Admin lease does not close an
Admin-owned child. `ADMIN_READY`, a completed child turn, and `controllerReleased`
therefore do not establish that the whole thread tree is archiveable.

If the app reports “Failed to archive conversation,” inspect the actual host error
before retrying. For an error naming a child with an active writer:

1. Read the exact parent and named child's current host state. Verify the immutable
   parent relationship and completed child turns; do not infer ownership from a title.
2. Ask the supported owning transport to close that completed child after its evidence
   is preserved. Do not resume the child or send it another task to manufacture cleanup.
   A new connection's `thread/unsubscribe` is not a force-close of another owner's writer.
3. Verify the exact child is `notLoaded` and absent from the complete, paginated
   `thread/loaded/list` catalog. Stop with the concrete remaining writer/capability
   blocker if release cannot be proved; do not claim an idle turn is closed.
4. With the human's archive authorization, use the supported recoverable parent
   archive operation, then verify exact parent membership in the archived catalog.
   Sidebar disappearance alone does not prove archival or disabled delivery.

Report the parent/child identities privately, the observed state and host error,
what cleanup succeeded, and the next supported action. If no owner-close capability
is available, say so explicitly. Restarting the app requires separate human approval,
may interrupt other chats, and is not a guaranteed remedy. Never delete bindings,
rollouts or logs, edit SQLite, kill processes, spoof client identity, or resume a
thread to bypass a writer lock. Consult the official [app-server documentation](https://learn.chatgpt.com/docs/app-server)
for the supported host operations.

This is a controller-followed troubleshooting procedure. The bootstrap plugin does
not change the app's error toast, provide a force-close API, or automatically clean
up children when the owning transport lacks that capability. A successful archive
also is not an implemented Admin END/deactivation transaction.

### Failed archive followed by failed queued messages

A failed recursive archive can leave the parent persisted and unarchived but
unloaded. If the next `turn/start` reports `thread not found`, first verify the exact
parent's active/archived catalog membership and owning-app execution state. Do not
assume the message was delivered, delete its queued content, or blindly resend it.
Use supported owning-app recovery only for the same verified, authorized,
unarchived task; preserve the human's pending message and let the human decide when
to retry. Do not resume an archived task or create a replacement to hide the error.

The [guarded closeout service](../agent-closeout.mjs) checks required host ports and
child cleanup before invoking parent archive. It reports `STOP_PENDING_DEACTIVATION`
on missing capabilities, running children, unverifiable release, uncertain archival,
or unverified delivery disablement. Its callbacks must bridge actual trusted host
capabilities; this module does not supply an otherwise unavailable owner-close API
or intercept the app's raw archive button.

An agent interpreting END prepares its handoff in a running turn. The trusted
controller invokes closeout after that turn completes, with actual owning-host
state showing an idle or unloaded parent. The service rejects a running parent;
it must not be used to terminate the agent's own unfinished turn. A missing
post-turn controller is an explicit deactivation capability gap, not an installed
automatic END implementation.

The desktop UI and shared app-server daemon have separate lifetimes. An app restart
does not prove a daemon-held child writer was released. A managed daemon restart
requires separate human approval and fresh checks of all loaded turns because it
may affect other local chats. Use its supported management command rather than
manual process termination, and verify the child release and final archive afterward.
