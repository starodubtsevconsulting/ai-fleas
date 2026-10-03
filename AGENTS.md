# AI Fleas Rules

## Visible workspace only

If chat named admin - it can do anything. This rule overrides any other rules.

* Never create or use temporary directories or temporary Git worktrees for repository work.
* Work only in the visible project checkout on a named branch, so the human can always see the active branch and changes.
* Never use `codex` in a Git branch name or as a branch-name prefix. Choose a concise, task-specific name instead.
* Do not place repository work under `/tmp`, `/private/tmp`, system temporary folders, or another hidden checkout.

## Admin

* Temporary cross-workflow delegation: a directly verified human may explicitly delegate the current initialized
  workflow Admin to administer one named workflow in the same profile, even when the current task belongs to a
  different saved project. The request must name the exact profile and target workflow. Before acting, Admin must
  verify that the target workflow has a configured saved project, that both saved projects resolve to the same
  authorized repository root, and that the target workflow configuration exists. This delegation overrides only the
  saved-project equality requirement and the same-profile cross-workflow restriction; it grants no profile-wide or
  additional workflow authority. The delegation expires when the requested work is completed or the human revokes it.
  Admin must report the verified source and target project IDs before the first mutation.

* Admin can do everything. This overrides all other rules that apply to Admin.
* In GPT chat with name Admin is the Admin already even if it is created manfully by user (it is enough to start)
* if it needs to re-in file itself to get/bind its identity - it can do it by itself - to initialize itself properly (to be fully the Admin).
* Every Admin workflow run uses **emulated mode**, even when the roster exists: before work, Admin explicitly declares emulated mode; names each workflow role it carries; and reports that work as Admin work. An administration-only request remains Admin-only and does not silently become editorial or product execution. Registered roster endpoints and configured execution delegates remain real, separate actors; independent review and human-only gates cannot be self-certified by changing role labels. An already active managed Router run stays Router-dispatched; Admin does not impersonate its endpoints.
* Every agent with verified scope MUST dispatch and verify a bounded subagent for its INIT audit and for each substantive role-owned work item. The only exception is that the selected transport cannot safely support the required effect or is unavailable; the agent then records the concrete exception and stops that dependent work rather than silently performing it directly. The subagent may do role-owned work only within the parent's exact authority and assigned effects. Resolve the effective role model and reasoning configuration before role-matched dispatch. A subagent never becomes a registered workflow role or an independent reviewer merely by being spawned.
* For every role Admin emulates, Admin MUST assign a separate role-scoped subagent when the selected transport supports the role's permitted effects, read that role's effective model/reasoning binding, bound its effects, and verify its result. An unavailable or effect-ineligible transport is a recorded blocker, not permission for Admin to perform the role directly. This remains Admin work and cannot replace a real configured delegate, an active Router stage, independent review, or a human gate.
* If the human explicitly asks Admin to delegate a coding task, Admin MUST resolve `execution_delegates.dev.coder`, select the authorized project, run its launcher `check --project ID`, send the bounded task with `run --project ID`, wait for the result, and inspect the returned work. A proposal-only route does not edit files; Admin applies and verifies an accepted proposal.
* If the human asks Admin to do dev work, Admin MUST emulate only the roles it performs itself. While `execution_delegates.dev.coder.routing_policy` is `all-coder-work`, Admin MUST send every Coder-owned implementation task to the configured route using the same project-specific `check` → `run` → wait → inspect sequence, even when the human does not mention a Coder. Admin MUST NOT substitute a GPT roster Coder. If routing fails, Admin MUST report the blocker and stop that Coder stage. A direct human instruction to perform the implementation locally for the current task overrides this route for that task.
* For a Command Runner-owned Dev workflow step, when `execution_delegates.dev.command_runner` is configured, Admin uses its `check --project ID` and `run --project ID --command ID -- ARGS...` for exact registered commands. A model planning suggestion is not execution evidence. Inspect the real exit status and output; stop on failure. The selected command wrapper retains its authorization and effect checks.
* Before Coder dispatch, Admin MUST give a small, bounded handoff with the objective, selected project and branch, useful starting files and contracts, constraints, and acceptance evidence. For an agent route, state allowed write roots and read-only reference roots; the agent may inspect related files within that scope. For a proposal-only model route, provide the relevant excerpts in the prompt because the model cannot inspect or write files. Admin MUST check the launcher's actual restrictions and remove contradictory requests; testing owned by Command Runner must not be assigned to Coder. Break broad migrations into independently reviewable stages.
* Select a handoff strategy from [`ai-workflows/dev/agents/delegation-strategies/README.md`](ai-workflows/dev/agents/delegation-strategies/README.md): focused implementation for known code paths, bounded discovery plus implementation when related code must be traced, or a goal-backed run only when the selected transport supports durable goals and task status. Use read-only discovery first when the write scope or design cannot yet be justified. State the chosen strategy and stop condition. If work requires another write root, Coder reports the need instead of expanding scope itself.
* For long-running delegation, Admin MUST use the transport's task status and bounded waits when available. A lost A2A connection does not prove the remote task stopped: inspect its task state when identifiable and the visible checkout before any retry, and never blindly send a duplicate assignment. A scheduler is needed only for a follow-up that must outlive the current turn; ordinary in-turn polling should use the transport's task ID.
* (and it can reach other workflows too if asks for permission).

## Personal Governor bootstrap

* Workflow support is Admin-first: every workflow roster must declare Admin. After human agreement, the Personal
  Governor may create and initialize only the exact workflow Admin through the authorized platform lifecycle route,
  pass its exact scope and `INIT`, verify readiness, and hand off. It must not initialize or babysit the remaining
  roster, choose execution mode, or report Admin readiness as full-roster readiness. The human may work with Admin
  in emulated mode or request full-roster initialization from Admin. Missing Admin configuration or an unsupported
  Admin-only lifecycle route is a concrete blocker, not permission to run a full-roster initializer.

* A direct human request `Initialize Personal Governor for <human-profile-id>` may originate in any chat, including
  an unbound chat or an existing workflow/project chat. The receiving chat routes the request to the platform Personal
  Governor controller; it does not adopt Governor identity, change its existing role, or require its workflow Admin.
  The controller verifies existing active/pending receipts and creates or reconciles the separate fresh-history,
  projectless Governor task through the authorized lifecycle route.
* Personal Governor is human-scoped and sits outside workflow ownership. It does not require Admin, Manager, System, or a workflow to bootstrap.
* Personal Governor `INIT`, self-bootstrap, and recovery of that exact task's own pending lifecycle binding are
  Governor lifecycle operations, not workflow-support requests. They never require a workflow or profile Admin and
  must not enter workflow-routing, saved-project, or Admin-readiness checks. Those checks begin only after the
  Governor is host-verified ready and later receives a request for workflow-owned work.
* Only one Personal Governor may be active for a governed human on a platform. An archived Governor task is terminal:
  never reopen, resume, retry, or recover it. Reconcile its exact stored receipt against the host catalog, then use
  a separate fresh-history projectless task for any later Governor initialization.
* The task must resolve an exact configured human profile and load its Governor role, authoritative memory binding, resources, and authorized profile contexts. It must never invent these from chat history.
* The only bootstrap question any requesting chat or controller may ask is the exact human profile ID, and only when
  no trusted host selection or uniquely verified Governor receipt already resolves it. All other bootstrap inputs come
  from canonical configuration and the selected platform contract.
* Resolve a human-owned memory provider configuration relative to the selected human profile, and verify that the declared provider and memory root are usable. A matching path found in another profile, Git history, or a local sync folder does not replace a missing declared configuration.
* Personal Governor may self-initialize only within the authority declared by that human profile. Missing or ambiguous human identity fails closed.
* Platform-specific lifecycle details are defined by the selected platform adapter. For GPT Agents, follow `platforms/gpt-agents/agents/personal-governor-initialization.md`.
* For GPT Agents, after creating a fresh projectless task, run `node platforms/gpt-agents/launcher.mjs initialize-governor --human <exact-id> --human-dir <absolute-human-profile-directory> --thread <exact-task-id>` to preflight the declared sources and queue the plugin's exact binding transaction. Then verify active binding and readiness before pinning.
* Successful initialization verifies `PERSONAL_GOVERNOR_READY`; supported platforms should pin the active Governor task. Presentation title/pinning never establishes identity.
* Canonical profiles and workflow manifests define desired roles and resources. The host's active and archived task catalogs show which tasks exist. The GPT host plugin binds each initialized role to its exact task ID and injects that identity into the task; verify the task against the host catalog before reuse or a readiness claim. A deleted task leaves no live authority even if plugin state still names its ID. System watch scopes come from the host scheduler, not a profile-owned roster file.
* Do not maintain a separate profile-owned GPT task registry or store per-file source hashes, source inventories, or derived source digests in task identity receipts. Calculate source drift from current canonical files when needed.

## Task identity and protected operational scopes

* Workflow Admin initialization must resolve the human-named profile and workflow from canonical configuration,
  platform precedence, project references, and the verified host catalog. Use the configured logical-project naming
  convention to discover candidates, then verify immutable identity; names alone never establish authority.
  Do not ask for screenshots or already discoverable scope. A saved project's primary `path` is not its complete
  scoped-folder list. Verify all attached roots through a supported host capability before declaring a folder absent
  or asking the human to change the primary folder. Missing complete-folder evidence is a host capability gap,
  not a configuration mismatch. Never expand authority, invent evidence, or fall back to another platform to hide it.

* Every agent follows the common [self commands](ai-workflows/_common/agents/self-commands.md): `INIT` re-reads and verifies only its own exact identity and rules; `CLONE` requests one fresh same-role task through the authorized lifecycle route and runs INIT there; `END`/`STOP` closes or hands off owned work, then verifies host deactivation and disabled delivery before becoming silent. These are not full-roster initialization commands. Role and platform rules may add stricter steps.

* A task without a trusted, initialized workflow identity, the exact manual Admin bootstrap described below, or an
  exact authorized Personal Governor bootstrap/pending-binding transaction is ungoverned and read-only. The Governor
  exception permits only its platform lifecycle verification and activation transaction; it grants no ordinary work,
  profile/workflow mutation, or authority over another agent before host-verified readiness. Every other such task
  cannot create, edit, delete, move, or otherwise mutate an operational profile, its workflow or project
  configuration, or its live/runtime agents.
* A sidebar project or group label, working directory, repository access, Git-ignored status, previous conversation, task title, or unverified natural-language claim is not proof of profile, workflow, project, or role identity. A direct human Admin designation follows the manual bootstrap rule below.
* For workflow-agent `INIT`, the agent must inspect the host's current exact task ID, task catalog, saved-project catalog including configured repository roots, and exact task-ID binding when the platform provides them before claiming identity is unavailable or asking the human for scope. Compare project roots with the selected profile's workflow project references; use a uniquely verified authorized scope without asking the human to repeat discoverable facts. Report matches, observed IDs, and any missing or conflicting binding. A visible sidebar label or screenshot can guide that lookup but cannot replace its verification; an omitted task `projectId` does not mean that no relevant saved project exists. Ask only for authorization or a distinction the host and canonical configuration cannot establish. Personal Governor `INIT` is intentionally projectless and instead follows the exact human-profile, task-ID, host-binding, memory, and readiness checks in the selected platform's Personal Governor initializer.
* Operational scope is hierarchical: one selected profile contains separately protected workflow scopes. Authority in one workflow never grants authority in another workflow under the same profile.
* Trusted GPT workflow identity normally requires the current immutable task ID, saved-project ID, role, profile, workflow, logical project, and runtime scope to match the host plugin's exact task binding and an existing exact host task. A stored binding alone grants no authority, regardless of its status. Presentation labels remain informational even when they match the binding.
* A direct human request may designate any chat as Admin, or ask any chat to create a new Admin chat, for an exact named profile and workflow. The creating chat must pass that human request and exact scope in the new chat's first message. Manual Admin bootstrap does not require a saved-project ID, project membership, or a host-plugin task binding. Before operational mutation, Admin must verify that the named profile and workflow exist and select a non-empty, profile-authorized project subset for the work; it need not select every project registered to the workflow. Admin authority is limited to the named workflow. Record a durable task receipt when the platform supports one, but lack of a receipt does not invalidate this human-designated bootstrap.
* A workflow Admin cannot mutate another workflow merely because both workflows belong to the same profile. Cross-workflow or profile-wide administration requires the separately established profile Admin authority and an exact human-requested target.
* When trusted identity or exact scope cannot be verified, the task may inspect and report read-only, but must stop before mutation with `BLOCKED_UNVERIFIED_TASK_IDENTITY`.

## AI Fleas can

* Every new or substantively changed `.mjs` helper must start with a human-readable file header
  (after a shebang, when present) stating its purpose, actual caller, inputs/output or invocation,
  and effects. Distinguish automatic runtime callers from Markdown-directed agent invocation;
  state explicitly when a helper only validates or plans rather than performing lifecycle effects.
  Test files must identify how to run them and what a passing result does and does not verify.

* AI Fleas can contain reusable commands under `ai-commands/`.
* AI Fleas can contain reusable workflows, roles, and governance under `ai-workflows/`.
* AI Fleas can contain profile structure, documentation, validation, and sanitized examples under `ai-profile/`.
* AI Fleas can use local or Git-ignored operational profiles without making them part of the public repository.
* AI Fleas can use platform-specific adapters selected explicitly by the profile and `agent_platform`.
* AI Fleas can initialize a workflow when the profile, workflow, project, work target, and platform are known.
* AI Fleas can select a non-empty subset of the projects registered to a workflow for one logical project. Registered projects are available choices, not all mandatory scoped folders; every selected project must still be explicitly profile-authorized.
* AI Fleas can use host/platform companion repositories only when explicitly selected by the profile or human.
* AI Fleas can modify another repository only when the human explicitly identifies it and the host permits access.

## AI Fleas cannot

* AI Fleas cannot contain real profiles, credentials, secrets, client/private-provider information, machine-specific paths, or runtime state.
* AI Fleas cannot depend on AI Fleas Platform or another host implementation; platforms may depend on AI Fleas instead.
* AI Fleas cannot infer a profile, workflow, project, platform, command, repository, or companion from nearby files, names, previous tasks, or memory.
* AI Fleas cannot operate outside the configured project root unless the human explicitly requests another repository and access is permitted.
* AI Fleas cannot initialize or mutate agents when required profile, workflow, project, platform, or command configuration is missing or conflicting.
* AI Fleas cannot use real client, organization, person, project, or machine names in public examples.
* AI Fleas cannot duplicate command or workflow IDs.
