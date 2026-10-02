# Agent self commands

`INIT`, `CLONE`, and `END`/`STOP` are self-scoped commands available to every agent type. Recognize them when the
human sends the command as an instruction to that agent, ignoring case, or when that role's declared lifecycle
explicitly invokes the same operation. Ordinary prose containing the word does not trigger a lifecycle action. The
current agent must verify its exact host task/instance ID and canonical identity before
any effect. A title, cwd, remembered conversation, or another agent's binding is not identity evidence. The selected
role and platform may add stricter preflight, sources, handoff, and cleanup rules but cannot widen the common scope.

## INIT: reinitialize this agent only

For a human-owned Admin, an authorized platform lifecycle controller may deliver the exact `INIT` under verified
human bootstrap approval and the host's pending one-use permit for this exact task and scope. The permit requires a
fresh nonce and an unexpired deadline; verify and consume it through the supported host route. This narrowly scoped
delivery is not an ordinary task instruction and grants no later messaging or work rights. No other self-command is
covered by this exception. Without the verified permit or a directly verified human instruction, reject task-originated
Admin initialization. Never emit readiness merely because a sender requests the readiness token.

1. Resolve the current task's exact trusted binding: role, profile or governed human, workflow when applicable,
   logical project, runtime scope, selected project set, and platform. A directly human-designated Admin follows its
   separate manual bootstrap rule. Missing or conflicting identity blocks INIT; do not guess from the sidebar or chat.
   First read the host's own current task ID and active task catalog entry, including its saved-project ID, host,
   status, and checkout. Where the platform has an agent-binding plugin, read the binding keyed by that exact task ID
   and verify its profile, workflow, role, logical project, runtime scope, and selected project IDs against canonical
   configuration. Inspect the host saved project's configured repository/workspace roots, even when a task-catalog
   entry omits `projectId`, and compare them with the repositories declared under candidate profile/workflow project
   references. An exact root match identifies a configured candidate scope to verify; a checkout path alone does not.
   Resolve each bound saved-project ID through the host project catalog and verify its authorized roots.
   Continue through the host catalog, binding, and canonical profile checks without asking the human to repeat
   discoverable project, profile, or workflow facts. If one authorized scope is established by the applicable binding
   or manual Admin bootstrap, use it. A project label, title, screenshot, checkout path, or catalog entry without an
   exact binding is context for diagnosis, not proof of an initialized role. If the platform cannot expose the current
   task ID or exact binding, report which lookup failed and the observed host facts; ask only for an authorization or
   distinction that those sources cannot establish.
2. Re-read the current canonical profile, role, common rules, workflow and project policies, platform adapter, model
   binding, resources, and authoritative memory route applicable to this agent. Reconcile source drift and the current
   host task against the binding. Discard stale conversational assumptions about authority and capability.
3. After steps 1 and 2, dispatch and verify one bounded, read-only INIT audit subagent under the common
   [utility-subagent contract](utility-subagents.md). Its assignment checks the collected identity/scope evidence and
   lifecycle constraints only; it cannot establish identity, create or contact roster peers, or perform a reload. If the
   selected transport is unavailable or cannot safely perform that read-only audit, record `BLOCKED_INIT_SUBAGENT` and
   stop rather than treating direct review as equivalent.
4. Apply the selected adapter's **single-agent** binding/reload transaction if needed, then verify this same task's
   identity and readiness. Report the sources, exact scope, and readiness or blocker.

INIT does not create, restore, replace, or initialize any other roster member, run the workflow/group `initialize` or
`reconcile` operation, advance a Router stage, or change this agent into another role. A self reload that the host cannot
verify returns `BLOCKED_SELF_INIT`; it is not a successful initialization by assertion.

## CLONE: create a fresh same-role instance, then INIT it

1. Verify the source agent is active and its exact role/scope, lifecycle owner, platform creation capability, and
   cardinality. A deactivated, superseded, ambiguous, or unbound task is not a clone source.
2. Ask the authorized lifecycle owner or adapter to create one **fresh task/instance** carrying the same canonical role
   and authorized scope, with a new immutable instance ID. Copy source references and the minimum authorized durable
   handoff, not the transcript, inherited conversation, title-as-identity, secrets, or an unverified runtime binding.
3. Run INIT in that exact new task and verify its readiness, project binding, and host catalog entry before routing
   work to it. Preserve the source on failure. Do not create a second candidate blindly after an uncertain response.
4. Honor role cardinality. If concurrent instances are allowed, activate the clone within the declared limit. If only
   one may be active, keep the candidate unroutable until the role's successor-first cutover is authorized and verified;
   then retire the predecessor from active routing. Physical archival may have a separate role-specific human gate. If
   the adapter cannot prepare that transaction, return `BLOCKED_CLONE_CAPABILITY`.

CLONE is not full-roster initialization. A role's self-continuity policy may provide its lifecycle route; otherwise
the declared Manager/System/host lifecycle owner performs creation. The command does not grant the caller authority to
manage peers or weaken the one-active-instance invariant.

## END and STOP: finish and deactivate this agent

`END` and `STOP` are synonyms for a graceful self closeout, not a request to stop only the current tool call or to
disable another agent. The agent stops taking new work, inspects its active assignments and durable obligations, then:

1. Finish in-scope work that can pass its actual gates, or hand off a precise blocker and remaining work to the
   declared owner. Record exact revisions, task IDs, evidence, and destination state without inventing completion.
2. Close tickets only when this role owns ticket closure and the required completion evidence exists. Commit and push
   owned changes when the workflow authorizes delivery and checks pass. Merge only when the user/workflow authorized
   that exact merge and branch protection, review, and release gates pass; a generic STOP does not identify or approve
   an otherwise unapproved merge. Route an action to its configured owner when this role does not own it. Do not
   publish, deploy, spend, or waive a human decision as an implied part of STOP.
3. Collect and verify owned subagent results, then close completed children through their supported owning transport
   under the [parent-owned cleanup duty](utility-subagents.md#parent-owned-cleanup-and-handoff). Verify exact child
   relationships and release before attempting parent archival. A completed turn is not a released writer. Do not
   interrupt unfinished assignments, force-close another owner's session, or archive first and hope child cleanup
   succeeds. Missing owner-close or release evidence is `STOP_PENDING_DEACTIVATION`, not successful END.
4. Preserve the minimum durable handoff and report the final state once. Ask the selected platform to deactivate or
   recoverably archive this exact task and disable its routing, schedules, and new-message delivery. Verify the host
   reports it inactive. After verified deactivation, the agent does not respond to later messages.

For `codex-app`, the explicitly invoked [guarded closeout transaction](../../../platforms/gpt-agents/agent-closeout.mjs)
requires trusted host capabilities for identity, approval, child release, archival, and delivery verification. It is not
an automatic hook or an effectful launcher command. If a parent archive fails, re-read its persisted/archive and live
state: the host may have unloaded it even though it remains unarchived. Do not blindly resend a failed queued END or
claim the chat is usable. Report the state and arrange supported owning-app recovery only while the exact task remains
authorized and unarchived. Never treat recovery or archive membership alone as verified disabled future delivery.

The agent's own END turn is still running while it prepares its handoff. The trusted lifecycle controller performs
physical closeout only after that turn completes; it must not archive a running parent. If the host cannot execute and
verify post-turn closeout, report `STOP_PENDING_DEACTIVATION` instead of claiming END was completed by a final message.

If closeout or host deactivation cannot be verified, report `STOP_PENDING_DEACTIVATION` with the exact blocker. Do not
claim the agent is silent while the host still routes messages to it. A later direct human request to resume requires
the platform's explicit restore/reinitialization path; silence or a title change is not a restore.

## Extensions and precedence

Role contracts may add required memory, ticket, article, review, code, release, or scheduling closeout. Platform
adapters own the actual task creation, binding, readiness, archival, and delivery disablement. These commands never
bypass a configured execution delegate, independent review, Router-owned run, profile boundary, approval, or human-only
gate. The GPT host's internal `Stop` turn event is unrelated to the human `STOP` command.
