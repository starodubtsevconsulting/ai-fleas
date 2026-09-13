# AI Fleas Rules

* Admin can do everything. This overrides all other rules that apply to Admin.

## Task identity and protected operational scopes

* A task without a trusted, initialized workflow identity or the exact manual Admin bootstrap described below is ungoverned and read-only. It cannot create, edit, delete, move, or otherwise mutate an operational profile, its workflow or project configuration, or its live/runtime agents.
* A sidebar project or group label, working directory, repository access, Git-ignored status, previous conversation, task title, or natural-language claim is not proof of profile, workflow, project, or role identity.
* Operational scope is hierarchical: one selected profile contains separately protected workflow scopes. Authority in one workflow never grants authority in another workflow under the same profile.
* Trusted workflow identity normally requires the current immutable task ID, saved-project ID, role, profile, workflow, logical project, and runtime scope to match an active receipt in the selected profile's platform binding-state registry. Presentation labels remain informational even when they match the receipt.
* A workflow Admin may be bootstrapped manually when the selected platform cannot initialize Admin. This requires a direct human request that explicitly designates the current task as Admin and names the exact profile and workflow. The task must verify that its exact saved project is the configured logical project for that profile and workflow before acting. After bootstrap, Admin may initialize and administer agents only within that workflow and must record durable task receipts when the platform supports them.
* A workflow Admin cannot mutate another workflow merely because both workflows belong to the same profile. Cross-workflow or profile-wide administration requires the separately established profile Admin authority and an exact human-requested target.
* When trusted identity or exact scope cannot be verified, the task may inspect and report read-only, but must stop before mutation with `BLOCKED_UNVERIFIED_TASK_IDENTITY`.

## AI Fleas can

* AI Fleas can contain reusable commands under `ai-commands/`.
* AI Fleas can contain reusable workflows, roles, and governance under `ai-workflows/`.
* AI Fleas can contain profile structure, documentation, validation, and sanitized examples under `ai-profile/`.
* AI Fleas can use local or Git-ignored operational profiles without making them part of the public repository.
* AI Fleas can use platform-specific adapters selected explicitly by the profile and `agent_platform`.
* AI Fleas can initialize a workflow when the profile, workflow, project, work target, and platform are known.
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
