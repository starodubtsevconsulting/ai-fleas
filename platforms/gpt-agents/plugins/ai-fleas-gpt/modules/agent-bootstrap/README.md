# AI Fleas Agent Bootstrap

This GPT/Codex plugin restores trusted AI Fleas agent identity at session start and gates first-time initialization by an exact task-ID receipt.

It is the platform bootstrap layer, not an agent and not a workflow Router. Codex loads the plugin; the plugin reads a host-owned registry; only the lifecycle controller writes bindings.

## Security model

- A title, prompt, previous conversation, working directory, or nearby file never grants identity.
- An unbound task receives no injected agent context.
- A pending binding belongs to one exact task/session ID.
- First-time activation requires the exact host-registered initialization prompt and the configured readiness token in the same turn.
- `SessionStart` restores active identity after startup, resume, clear, or compaction.
- Missing or unverifiable declared sources keep the task read-only.

## Infrastructure map

The portable roster declares the role and common rules. Profile/workflow/per-agent
configuration selects the platform; the platform realization supplies its endpoint.
The lifecycle controller resolves those sources and verifies actual human approval,
host identity, project folders, plugin trust, and readiness. The plugin does not
discover a profile or create an Admin merely because its hooks are installed.

- `SessionStart`: automatically injects the exact active task's identity and source references.
- `UserPromptSubmit`: automatically checks the pending permit's exact prompt, nonce,
  expiry, task and turn for native user-prompt delivery.
- `Stop`: automatically activates only the matching initialized turn with the exact
  configured readiness token; it does not certify that a model actually read sources.
- `register-agent-initialization.mjs`: explicitly called by the lifecycle controller
  to register a pending binding; registration alone is not initialization.
- Native controller utilities: explicitly imported by a trusted host integration;
  discover complete catalogs, create or reuse one exact Admin, deliver INIT once,
  and verify completed-turn readiness and controller release.
- Owning-app adapter: explicitly supplied trusted send/live-thread ports correlate
  one exact INIT nonce acknowledgement to the actual live turn. The normal Stop hook
  still performs activation; an acknowledgement is not readiness.

For an agent's operational procedure, use
[Admin-only initialization](../../../../agents/admin-only-initialization.md).
It applies to any authorized workflow with the required Admin declaration and
platform realization, not just the workflow used for the live experiment. Other
platforms need their own supported lifecycle route; there is no automatic fallback.

## Native Admin controller transaction

Use exported `initializeNativeAdmin(request, options)` from
`platforms/gpt-agents/initialize-native-admin.mjs`, or the six-port
`initializeWorkflowAdmin(preparedPlan, host)` contract documented in the procedure.
For human-approved agent use, the reusable CLI is
`node platforms/gpt-agents/initialize-admin-command.mjs --request REQUEST.json`
or `--request -` for stdin. It discovers trusted native runtime/hook paths and
supplies the exact-scope approval verifier; checking the caller's human approval
attestation remains a controller-followed rule, not an automated human-proof check.
There is no effectful `launcher.mjs initialize-admin` CLI. Its `preflight-admin`
command only builds and validates a plan. Hook installation does not automatically
run either controller API.

The default native Admin route installs the exact INIT-only `ai_fleas_init_audit`
dynamic tool. `NativeInitAuditController` authenticates its task/turn/generation
against the existing binding; `EphemeralInitAudit` owns a tool-disabled ephemeral
inference process using the configured role model/reasoning. Results return only
after process exit. The existing binding stores one correlated audit receipt, not
a second role registry or a source digest inventory. Stop activation additionally
requires that passed receipt, and the controller cross-checks the actual structured
tool call. Missing executable/tool capability blocks without spawning another role
or switching platforms. Installed readiness code must match the reviewed source;
changing source alone does not deploy the plugin.

The Admin chat title is presentation metadata. A native controller sets it only
after accepted INIT has reached verified readiness and a fresh task/binding catalog
is durable enough to address the exact task. A bounded title retry is classified
separately in `titleStatus`; failure does not unregister the INIT audit handler,
cancel readiness monitoring, retry delivery, create a replacement task, or weaken
the exact readiness correlation. Callers report title, readiness, controller
release, and owning-app attachment independently.

For a newly created verified Admin only, the native handoff archives/unarchives
the stopped exact INIT chat, preserving identity/history and closing its native
writer before human ownership. Reuse does not run this cycle; no resume or later
message is sent. This is a supported lifecycle effect, not a daemon restart.
No automatic END/archive integration is added by this audit transport. Successful
worker exit, parent controller release, and human UI archival are separate checks.

Sidebar placement is another separate check: the native saved-project ID is not
the desktop app's project ID. `AdminControllerCommand` requires a trusted
`verifyAppProject` adapter before overall success. Without it, the CLI retains the
initialized exact task and returns `ADMIN_APP_PROJECT_ATTACHMENT_UNVERIFIED`, not
a complete handoff. An app-tool controller opens that existing task through
`navigate_to_codex_page`, then verifies its expected project association in fresh
app catalogs, following the [Admin-only procedure](../../../../agents/admin-only-initialization.md).
Opening reconciled the association in the live regression, but is not itself
proof of attachment. Do not create a replacement or resend INIT for this failure.

The transaction verifies fresh complete saved-project roots and active/archived
task catalogs. It reuses only an exact active ready Admin, otherwise creates only
one Admin with canonical references and the approved project subset. It registers
the exact permit, submits INIT once, and requires both the active receipt and the
actual completed host turn to prove `ADMIN_READY`. Missing configuration, ambiguous
identity, unsupported host evidence, platform mismatch, or failed readiness stops
without full-roster initialization or a partial readiness claim.

Native submission and app steering are different transports. Native `turn/start`
uses the user-prompt hook path. App steering uses the explicit nonce handshake
adapter; plain cross-task messages do not count as native UserPromptSubmit events.
Select the integration explicitly; do not send both routes or retry uncertain
delivery blindly. Same-task recovery must recheck identity, scope, prior attempt,
human approval, and plugin trust before renewing an expired permit.

## Queue-based host transaction

1. Resolve the intended agent, exact scope, canonical sources, memory route, and next generation outside the new task.
2. Create a fresh task without copied conversation history.
3. Register the pending binding and deliver the exact prompt through the desktop task owner's queue:

   ```sh
   PLUGIN_DATA=/trusted/plugin/data node scripts/queue-agent-initialization.mjs \
     <exact-session-id> binding.json initialization-prompt.txt
   ```

4. The helper uses `codex queue`, which causes `UserPromptSubmit` to run in the exact existing task. Cross-task tool
   messages represented as function-call output are not valid lifecycle delivery and must not be substituted. If queue
   delivery fails, the helper transactionally restores the registry state from before registration so an undelivered
   initialization cannot appear pending.
5. The hook requires the configured readiness token and atomically promotes the binding to `active`. A blocking report,
   missing token, wrong token, or token from another turn leaves the receipt pending without forcing the agent into a
   retry loop. The lifecycle controller must resolve the reported condition and re-dispatch initialization.
6. The lifecycle controller may then pin the successor when authorized and supported.
   Archiving a predecessor is a separate authorized lifecycle operation, not an
   automatic consequence of registration or readiness.

The plugin deliberately does not create tasks, select a human profile, or grant lifecycle authority. Those remain GPT Agents adapter responsibilities.

## Authority, storage, and limitations

Human approval permits one exact Admin bootstrap. An authorized controller may send
the exact INIT through the one-use scoped permit: INIT is the narrow exception to
the Admin's human-only direction rule. It does not authorize ordinary follow-ups,
execution-mode selection, CLONE/END/STOP, worker creation, or full-roster babysitting.
After verified handoff, the human directs Admin. Admin readiness is never full-roster
readiness. These role-followed instructions are not an app-level message firewall.

The generic `agent-bindings.json` lives in the host's plugin data directory, not in
the portable workflow or a second Admin registry. Keep real profiles, runtime
receipts, task IDs, local machine paths, prompts and logs outside public commits;
use fictional configuration examples. Source drift is evaluated against canonical
files, not a committed source-hash inventory. Atomic file replacement is not
cross-process compare-and-swap: controllers must serialize registry mutations.

Controller lease release/unloading does not prove the human can type in the UI.
Likewise, a binding does not prove the task remains present or archiveable: reread
the host catalog. These Admin initialization helpers do not implement an archive
or END transaction and do not guarantee native/app archival eligibility. On an
archive failure, inspect the exact task's live state and host error; do not treat a
sidebar disappearance, readiness token, or receipt deletion as verified archival
and disabled future delivery. Do not delete bindings to bypass a host error.

### Why a ready Admin may fail to archive

Archival can include child sessions. A completed INIT audit child may still retain
an active writer, causing the parent archive request to fail even though Admin is
ready and its controller has released its own lease. Completed work is not a
closed session, and unsubscribing a new/current controller connection is not a
force-release of another owner's writer.

The parent must collect the child's evidence, close it through its supported owning
transport, and verify the exact child is unloaded and absent from the complete loaded
catalog. Only then attempt the separately authorized, recoverable parent archive and
verify the archived catalog. If ownership, release or a required capability cannot be
verified, report the exact blocker and next action rather than repeatedly retrying or
leaving the human with an unexplained toast. See the operational
[cleanup and archival checklist](../../../../agents/admin-only-initialization.md#cleanup-and-failed-archival)
and the official [app-server documentation](https://learn.chatgpt.com/docs/app-server).

These are parent/controller obligations, not an automatic plugin cleanup hook or an
app UI fix. No supported owner-close API means a concrete cleanup limitation. An app
restart needs separate approval, may interrupt other chats, and may not resolve the
lock. Never delete receipts/history/logs, edit SQLite, kill processes, spoof a client,
or resume a session to bypass this error. Archival is not proof of a separate END
transaction or disabled future delivery.

Failed recursive archive can also unload a still-unarchived parent, causing its
next queued message to fail with `thread not found`. Preserve that message; check
exact host state before supported owning-app recovery or a human-directed retry.
The [guarded closeout service](../../../../agent-closeout.mjs) validates trusted
cleanup/archive/delivery capabilities before effects and reports unfinished
deactivation explicitly. It is an imported controller service, not a plugin hook,
standalone CLI, or fix to the desktop's raw archive UI.

An app restart and a shared-daemon restart are different operations. A daemon-held
writer may survive the former. Restarting the shared daemon requires separate
approval, no-running-turn checks, and post-restart verification; never infer that
disconnecting the UI released all descendant sessions.

## Test

The readable hook tests live in the private `ai-fleas-platform/gpt-plugin/src/`
checkout. Run them there before rebuilding this generated public package.
