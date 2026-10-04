# GPT Personal Governor initialization

The Personal Governor is a persistent human-scoped agent. It is not owned by a workflow profile and does not require
a workflow Admin, profile Admin, Manager, or System to initialize it. `INIT`, self-bootstrap, and recovery of this
exact task's own pending lifecycle binding remain on this Governor lifecycle route; they do not enter workflow Admin
initialization or readiness checks.

## Manual bootstrap

A human may explicitly request `Personal Governor INIT`, `Initialize Personal Governor`, or `Initialize Personal
Governor for <human-profile-id>` from any GPT task/chat, including an unbound chat or an existing workflow/project
chat. The receiving chat routes that request to the existing Personal Governor plugin/controller; it does not become
the Governor, abandon or broaden its current identity, or require a workflow/profile Admin. The controller checks the
host's exact active and pending Governor receipts, then creates a fresh-history projectless Governor task or reconciles
the exact existing projectless target as the verified lifecycle state requires. It never creates the Governor inside
the requesting chat's saved project.

That direct request is sufficient to select the Personal Governor bootstrap route, but not sufficient to invent
identity or resources. When the request originates in any chat and exactly one verified Governor receipt resolves the
human, use that receipt's exact human profile and canonical human-profile source; do not ask the human to repeat the
profile ID or reopen the predecessor. Otherwise resolve the exact human profile through the GPT adapter's local
profile store. For an exact new ID, first run `launcher.mjs prepare-human-profile --human <exact-id>`; this may create only
a minimal private profile with local Markdown memory and empty access lists, never copy fictional example authority
or overwrite existing files. Then verify:

- `type: human`;
- exact human profile ID;
- Personal Governor role and lifecycle binding;
- readiness token `PERSONAL_GOVERNOR_READY`;
- authoritative permanent-memory binding;
- authorized workflow-profile contexts and capabilities.

### Bootstrap question policy

From the requesting chat through target-task INIT, ask the human **only** for the exact human profile ID. The
human-initiated GPT launcher asks on each launch, prefilled with a unique recorded ID when available so another
human can be selected through the GUI. Noninteractive callers may use a uniquely verified Governor receipt or
trusted host profile selection without asking. Do not ask for a role,
workflow, project, platform, memory provider, memory path, title, pinning preference, prior-chat disposition, or other
setup detail: resolve those from the selected human profile and platform contract. If any declared source is absent,
ambiguous, unusable, or conflicts with the binding, report the concrete blocker rather than turning configuration
discovery into a questionnaire.

If an exact active Governor already exists for that human and the human requests a replacement from any chat, the
initializer creates a **pending successor** rather than reopening or adopting either the old chat or the requesting
chat. The predecessor remains active while the fresh projectless successor verifies its sources and returns
`PERSONAL_GOVERNOR_READY`. Only the host's successful activation of that exact successor may atomically supersede the
verified predecessor. Only after that exact readiness verification, pin the successor and set its presentation title
to `🧭 Personal Governor`; retain the
predecessor until the human chooses archival that preserves its history. An archived predecessor is terminal for Governor
runtime identity. A title or pin never establishes identity.

If this exact task already has a trusted pending Governor binding, resume only its host-authorized initialization
transaction through the platform lifecycle controller. Do not create a duplicate, seek Admin approval, or treat a
different task's receipt as authority. A pending receipt is not active identity: the task remains limited to bootstrap
verification until a matching initialization turn verifies the canonical human profile, authoritative memory route,
and authorized contexts, returns the exact readiness token, and the host activates that exact binding. If the pending
task is archived, record that exact archived state through the lifecycle controller and initialize a separate
fresh-history projectless task. Never reopen, retry, recover, or reactivate an archived Governor. If an unarchived
binding is stale or conflicting, report the blocker and use only the lifecycle controller's supported reconciliation
path; do not self-certify activation or invent a repair.

If an existing profile is incomplete, ambiguous, or conflicting, stop before task creation. A genuinely missing
exact human ID may be scaffolded in the GPT adapter's home-folder store or an explicit location override.

## Initialization

The common [self commands](../../../ai-workflows/_common/agents/self-commands.md) apply to the Governor. `INIT`
revalidates only this exact GPT task and its human/memory binding; it does not call workflow roster initialization.
`CLONE` requests a fresh-history projectless successor with a new task ID and runs INIT there. The current Governor
initializer rejects a second active or pending binding for the same human, so CLONE must use an adapter-supported
transactional successor route; if unavailable, return `BLOCKED_CLONE_CAPABILITY` rather than creating an unbound task
or archiving the predecessor first. `END`/`STOP` preserves memory, then requires host-verified archival/routing disablement
before claiming future silence.

Load the portable Personal Governor role/policies, then the selected human profile's Governor and memory bindings. Require the Governor binding and memory manifest to name the same authoritative provider. For `git-profile-memory` or `local-profile-memory`, resolve the manifest's `path` against the human profile directory, require a readable and writable Markdown file inside that profile's `memory/` directory, and verify that the Governor cutover chain resolves to that exact file. Verify that the current task environment can open that authoritative file for writing before claiming full readiness. This declared file is the only authoritative writable Governor memory; the local variant does not require Git. A Synology backup target is not a second authority and is not a destination for Governor memory writes. For a legacy `permanent-memory-synology` binding, resolve its declared `providerConfig` against the human profile directory and check that provider's read/write status. A matching file in another profile, an old Git revision, or a readable local folder cannot replace a missing declared source. Do not infer storage from paths or conversation history. Report a missing or conflicting declared binding as a binding error. Report a file-write or network permission denial as a restriction of the current task environment; it does not revoke Governor memory authority or establish that GitHub is unavailable machine-wide.

For each entry in the human profile's `authorizedProfiles`, resolve the work profile at
`<profile-catalog-root>/<authorized-profile-id>/<authorized-profile-id>-work-profile.yml`.
The catalog root is two directories above the selected human's `profile.yml` (the parent of `humans/`),
not the AI Fleas repository root. Do **not** assume `profile.yml` exists under an authorized work-profile
directory. Read that work profile's own `ai_workflows_root` and `workflows` entries; do not invent their
paths from profile names. For each `authorizedWorkflows` entry, match its declared `path` to the selected
work profile's workflow entry, then resolve the workflow definition at
`<ai_workflows_root>/<workflow-id>/<declared-path>`, with `ai_workflows_root` relative to that work
profile's directory. A root-relative lookup without the workflow-ID directory is not the canonical layout
and must not be reported as a missing workflow. Check the exact resolved file and project references;
never substitute a same-named workflow from another profile.

The Governor may initialize itself because no workflow or profile Admin owns it. Self-bootstrap grants only the
authority declared by the human profile. Bootstrap and pending-binding recovery end at host-verified Governor
readiness; they do not run the portable role's request-to-function mapping or its workflow-routing/Admin-readiness
steps. Those steps apply only to a later ordinary request that actually requires workflow-owned work.

Before creating a replacement, read the human profile for the desired Governor binding and check the host's active and archived task catalogs for the actual task. The GPT host plugin can supply an exact task ID for lookup, but its stored binding does not automatically observe host-side deletion. Confirm the exact task ID with the host and recheck its declared memory route. If the host cannot find it in either catalog, report a stale plugin binding and reconcile it through the platform lifecycle procedure before replacement. Do not call the missing task active, reuse it, or infer another task's identity from its title. Reinitialization is transactional: create/reconcile successor, initialize canonical config and memory, verify readiness, pin successor, then archive a predecessor only when it exists and is eligible for archival. Never archive the predecessor before successor readiness.

A replacement Governor must be a fresh-history, projectless task created through the platform's new-task primitive. Never create it inside a workflow saved project or by forking, cloning, or otherwise inheriting the predecessor task. Its bootstrap payload may contain only canonical source references, durable-memory bindings, exact lifecycle identifiers, and the minimum initialization instruction. It must not contain or reconstruct the predecessor transcript, conversation summary, inherited turns, or broad conversation context. Conversation history is not Governor memory; continuity comes only from canonical configuration and the declared authoritative memory route. The predecessor task ID may be retained solely for verified cutover and history-preserving archival.

After one new-task request returns an exact task ID, the launcher verifies that response and reads the same task's metadata, confirming projectless, non-ephemeral, non-forked identity, empty history, and the exact workspace. It enumerates both complete stored host catalogs. A new blank task may have no stored log until its first turn: in that case the exact ID must occur once in `thread/loaded/list`, and a fresh `thread/read` on the creation connection must corroborate the same blank identity. Reads use `includeTurns: false` before INIT because fetching stored turn items from a blank rollout can fail. The fresh-history `thread/start` response supplies the history evidence. This produces a one-use in-memory permit bound to the original client, exact task ID, and human directory. A missing or ambiguous loaded ID, conflicting identity, archived entry, or unverified catalog blocks with exact task evidence. Partial metadata has a bounded 20-second read budget at one-second intervals. The controller never creates another task in this transaction.

The start response may omit summary fields such as `cwd`, `projectId`, and `turns`; exact ID and absence of explicit conflicts suffice for that fresh allocation witness. The subsequent read must still supply the exact cwd, `projectId: null`, and `ephemeral: false`; omitted fields there do not establish identity.

The launcher invokes the initializer in process and keeps the original app-server connection open through the exact INIT queue and readiness wait. For a new unbound blank task only, the initializer consumes the permit, rechecks the stored catalogs and loaded/read identity, then registers and queues one INIT. The permit is consumed before queue effects, including a queue failure or uncertain acceptance; it cannot authorize replay, another task, another client, or an existing receipt. The queue helper retains its own binding transaction and rollback rules. No permit is persisted in a receipt. The standalone initializer, pending retry/reconciliation, active reuse, and post-INIT readiness still require authoritative stored catalog evidence. Standalone new-task verification allows three complete catalog enumerations at 500 ms intervals; exhaustion retains `GOVERNOR_PROJECTLESS_HOST_TASK_UNVERIFIED`. Title/pin and readiness remain separate from blank-task acceptance.

## Post-activation INIT scheduler discovery

For a later INIT or the launcher's separate welcome turn on `codex-app`, discover the host's native automation
capabilities before reporting scheduler access as unavailable. Search available tool names and descriptions for
`automation`, `heartbeat`, and `scheduler`; a search for `schedule` alone is insufficient. Native automation
inspection does not require controlling the Codex desktop UI through computer use.

When the host provides `automation_update`, follow its discovery contract: inspect the configured Codex home
`automations/*/automation.toml` definitions read-only, identify Governor-owned entries from their exact task/human
binding and purpose, then use `mode: view` with each discovered automation ID for host readback. Do not treat an
absent or empty local directory as proof that no cloud, remote-host, or other-platform schedules exist. Report the
scope actually inspected and any missing inventory capability. A local definition alone does not prove that a
callback is active or will run.

Compare verified host state with explicitly authorized profile follow-ups. A method cadence, preferred calendar
window, or ordinary calendar event does not supply an exact callback schedule. Create or reconcile only entries
whose timing, purpose, ownership, and supported adapter route are established; otherwise report the missing
configuration without inventing times. Prefer native thread heartbeat automation for current-thread follow-ups
when its tool contract selects that route. Never substitute standalone cron jobs for thread callbacks without
explicit human authorization. Preserve stable logical identities, verify writes through host readback, and
ensure successor/END handling cannot leave callbacks targeting a superseded or terminal Governor task.

The welcome report distinguishes configured cadence, discovered definitions, host-verified active callbacks,
changes made, and concrete limitations. If only discovery succeeded, say so rather than claiming reconciliation
or activation. This procedure is post-activation; it does not expand the one-time readiness-token transaction.

If the separate welcome turn cannot start because `thread/resume` reports an active foreign session writer, leave
the exact active Governor and its welcome receipt unchanged. Report activation readiness and welcome status
separately. Do **not** tell the human to close the Governor chat or tab: in the desktop app that action can
archive the exact task, and an archived Governor is terminal. Do not unarchive, resume, retry, or recover an
archived Governor. For an active task, identify the writer owner through supported host evidence and arrange a
supported release; an app/service restart requires separate authorization and a check that no turn is running.
Do not repeatedly relaunch while the foreign writer remains or send another welcome/activation INIT.

## GPT presentation

After readiness, pin the exact Personal Governor task in the global pinned area when the host supports pinning and
apply the recommended title: `🧭 Personal Governor`. Do not name a new Governor before its activation transaction:
blank host sessions can defer presentation metadata. Title and pin state are presentation only, never identity; their
write and verification must not create another task or resend the activation INIT.

## Governor-owned workflow Admin initialization

Archived agents are terminal, not lifecycle candidates. For Admin or roster
initialization, discover only live unarchived tasks; never search old chats for
restoration, offer restoration, ask whether to restore, or perform unarchive,
resume, retry, rebind, or reuse of an archived agent. A minimal exact-ID status
check may reject stale receipt authority without reading archived history.
Verified archived versions do not block a fresh approved initialization or count
against live cardinality. Never use archive/unarchive as a temporary handoff.
This applies to every agent, not only Governor. See the
[common lifecycle](../../../ai-workflows/_common/agents/lifecycle.md).

After activation, a direct human request to initialize an Admin for an authorized existing workflow is a
Governor workflow-routing/readiness operation. Follow the portable Governor's
[approved Admin initialization procedure](../../../ai-workflows/_common/roles/personal-governor.md#carry-an-approved-admin-initialization-to-completion).
The request supplies the human authorization for this bounded transaction; do not ask for it again.

For a workflow whose effective configured platform is `codex-app`, read the
[GPT plugin bootstrap procedure](../plugins/ai-fleas-gpt/modules/agent-bootstrap/README.md) and
[Admin-only initialization contract](admin-only-initialization.md). Use the checked-in
`platforms/gpt-agents/initialize-admin-command.mjs --request REQUEST.json` (or `--request -` for stdin),
which discovers native scope and trusted plugin support and performs the supported transaction.
`launcher.mjs preflight-admin` is read-only; completing it is not completion of the human's request.
There is no effectful `launcher.mjs initialize-admin` command. Do not substitute ad-hoc task creation,
ordinary cross-task messaging, full-roster initialization, or a different platform.

The standalone Admin command currently lacks an owning-app project bridge and
fails before lifecycle effects. Do not bypass that gate by calling its lower-level
native initializer directly. A trusted integration must resolve the intended
immutable app project ID before allocation/INIT and verify the same ID after
readiness; native saved-project IDs and shared filesystem roots cannot substitute
for that association. A request for `example-writing` must not initialize or attach to
`example-dev`, even when both projects use the same directory. General support testing
does not authorize live initialization in another scope. Without a supported
exact-target bridge, report the concrete capability gap and retain any existing
candidate for same-task attachment repair without re-INIT.

A subsequent explicit human authorization to replace the unusable live Admin may
use the Admin controller's exact-predecessor successor-first transaction. Supply
matching `replaceTaskId` and `replaceGeneration` in request and approval, and the
next generation. Verify the old live scoped identity and stopped audited readiness;
create only one new Admin with canonical sources and the approved project subset.
Do not retire the old host chat until the successor's readiness, nonarchiving
release and exact owning-app project are verified. This is not automatic repair
or permission to reuse an archived task or initialize another workflow.

Resolve the exact authorized profile/workflow, selected project roots, logical scope, and existing saved
project through canonical configuration and fresh complete host catalogs. Use a uniquely verified configured
scope without asking for already discoverable values. Human authorization must be checked by the controller;
a generated `humanApproved` field alone is not independent evidence. Check the Admin-only prerequisites:
unrelated full-roster prose does not override a valid single-Admin preflight.

Continue through the controller's readiness and release checks. When native initialization returns an exact
initialized task with `ADMIN_APP_PROJECT_ATTACHMENT_UNVERIFIED`, retain that task, open it with
`navigate_to_codex_page`, and verify its immutable app project association through fresh app catalogs as the
Admin-only contract directs. Opening alone does not prove attachment. Do not repeat INIT or create another
Admin to repair presentation. Report success only after the required identity, audited readiness, release,
and app attachment evidence passes; provide the human direct access and send no later operational instruction.

A concrete controller rejection remains a blocker. Inspect the producing check and report its exact evidence
and remaining owner/action. Do not infer that plugin support is absent from an unrelated documentation mismatch,
weaken validation, or patch lifecycle implementation code under Governor rule-maintenance authority.

## GPT utility-subagent routing

The common utility-subagent obligation applies to every Governor `INIT` audit and substantive work item. This section
selects GPT execution mechanics only when the selected platform resolves to the exact platform ID `codex-app`, that
adapter declares `utility-subagent-delegation`, and the human Governor binding sets
`platformBindings.codex-app.utilitySubagents.enabled: true`. Do not infer the platform from a task title, visible UI,
or conversation history. On another platform, use that platform's safe helper transport; if none is available or it
cannot safely perform the bounded supporting effect, record the concrete blocker rather than treating this obligation
as inactive.

At the start of each request, separate Governor judgment from bounded execution. The Governor retains scope, authority,
privacy, prioritization, integration, and final verification. It MUST dispatch a native GPT utility subagent for the
required audit or a safe bounded supporting task. The dispatch must:

- be an independently describable, read-only evidence task allowed by the portable utility-subagent contract;
- have a crisp input boundary, expected output, and stop condition;
- use the binding's lower-capability route without weakening correctness; and
- support the parent decision without taking its final judgment, for example repository inventory, targeted reference
  checks, factual comparison, log/test-output analysis, or parallel evidence collection.

Use the exact model and reasoning pair from the enabled human binding. `routine` is for mechanical inspection and factual
extraction. `boundedAnalysis` is for a self-contained analysis that needs more synthesis but not Governor-level strategic
reasoning. If the configured pair is unavailable or its selection cannot be verified, use an available route that still
meets the task's capability requirement and report the fallback; never claim an unverified model or saving.

The helper must not receive secret-bearing or approval interactions, destructive/effectful actions, ambiguous or
high-stakes decisions, final synthesis, or completion judgment. Those limits do not waive the required dispatch: select
a safe read-only supporting task such as evidence extraction or contract checking. If no safe bounded supporting task is
available, record the transport/effect blocker and stop dependent work. For implementation or other mutations, prefer
the real authorized workflow agent rather than broadening a utility helper's authority. A utility subagent never
substitutes for an independent workflow role or acceptance gate.

Every dispatch must provide only the minimum relevant context, preserve the caller's scope and privacy, obey configured and
platform concurrency, and require evidence that the Governor can verify. The Governor integrates the result and remains
responsible for it. These rules narrow GPT execution mechanics; they do not broaden the portable Personal Governor or
utility-subagent contracts.

## Readiness

Do not emit `PERSONAL_GOVERNOR_READY` until the human identity, role, authoritative memory route, and authorized profile contexts are resolved and usable. A stored plugin token, conversational claim, task title, prior chat context, or merely existing sync folder is insufficient.
