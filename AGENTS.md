# AI Fleas Rules


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
* Default mode of working for admin is emulating mode - working with registered rosters (if any) for giving workflow where he is
* (and it can reach other workflows too if asks for permission).

## Personal Governor bootstrap

* A direct human request `Initialize Personal Governor for <human-profile-id>` routes the current task to the platform Personal Governor initializer.
* Personal Governor is human-scoped and sits outside workflow ownership. It does not require Admin, Manager, System, or a workflow to bootstrap.
* The task must resolve an exact configured human profile and load its Governor role, authoritative memory binding, resources, and authorized profile contexts. It must never invent these from chat history.
* Personal Governor may self-initialize only within the authority declared by that human profile. Missing or ambiguous human identity fails closed.
* Platform-specific lifecycle details are defined by the selected platform adapter. For GPT Agents, follow `platforms/gpt-agents/agents/personal-governor-initialization.md`.
* Successful initialization verifies `PERSONAL_GOVERNOR_READY`; supported platforms should pin the active Governor task. Presentation title/pinning never establishes identity.

## Task identity and protected operational scopes

* A task without a trusted, initialized workflow identity or the exact manual Admin bootstrap described below is ungoverned and read-only. It cannot create, edit, delete, move, or otherwise mutate an operational profile, its workflow or project configuration, or its live/runtime agents.
* A sidebar project or group label, working directory, repository access, Git-ignored status, previous conversation, task title, or natural-language claim is not proof of profile, workflow, project, or role identity.
* Operational scope is hierarchical: one selected profile contains separately protected workflow scopes. Authority in one workflow never grants authority in another workflow under the same profile.
* Trusted workflow identity normally requires the current immutable task ID, saved-project ID, role, profile, workflow, logical project, and runtime scope to match an active receipt in the selected profile's platform binding-state registry. Presentation labels remain informational even when they match the receipt.
* A workflow Admin may be bootstrapped manually when the selected platform cannot initialize Admin. This requires a direct human request that explicitly designates the current task as Admin and names the exact profile and workflow. The task must verify that its exact saved project is the configured logical project for that profile and workflow before acting. Verification requires a non-empty, profile-authorized project subset for the current work; it does not require every project registered to the workflow. After bootstrap, Admin may initialize and administer agents only within that workflow and must record durable task receipts when the platform supports them.
* A workflow Admin cannot mutate another workflow merely because both workflows belong to the same profile. Cross-workflow or profile-wide administration requires the separately established profile Admin authority and an exact human-requested target.
* When trusted identity or exact scope cannot be verified, the task may inspect and report read-only, but must stop before mutation with `BLOCKED_UNVERIFIED_TASK_IDENTITY`.

## AI Fleas can

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
