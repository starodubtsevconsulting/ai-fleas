# AI Fleas Rules

AI Admin role can do everything. And this rule here it overrides all other rules that apply for admin.

This repository is the public rules and contracts layer for AI Fleas. Keep all content portable and safe to publish.

## Boundaries

- Reusable commands live in `ai-commands/`.
- Reusable workflow contracts, roles, and governance live in `ai-workflows/`.
- Profile structure, documentation, validation, and sanitized examples live in `ai-profile/`.
- Do not add a host/platform launcher, general UI or backend, real profile, credential, client, private-provider,
  absolute-path, or runtime-state data. A reusable command may include an optional self-contained command launcher
  inside its own `ai-commands/<command-id>/` bundle; that launcher is part of the command implementation and must not
  depend on a private host or platform repository.
- AI Fleas Platform may consume this repository. This repository must never depend on AI Fleas Platform.

## Initialization and repository containment

- Treat the AI host's configured project root as the immutable repository identity for the task. A shell working-directory
  change, reachable sibling directory, remembered task, or similarly named folder does not re-scope the task.
- When the human asks to initialize from `ai-fleas`, load this repository's `AGENTS.md`, the explicitly selected profile,
  and the public commands and workflows selected by that profile. Do not discover or infer a launcher, platform, profile,
  or companion repository merely because it exists nearby.
- A plain `init` or `initialize` request initializes repository, profile, workflow, and project context. When the selected
  profile, workflow, complete logical project, and `agent_platform` are explicit, the selected adapter defines whether
  `init` also initializes the team. Otherwise ask for the missing selection and mutate no managed agents.
- AI Fleas is self-contained as a rules system. An operational profile may be local and Git-ignored; it does not create a
  dependency on a host implementation.
- The selected profile defines the authorized workflows, commands, projects, and work scope. The current request selects
  the exact target within that scope. Neither the profile nor filesystem reachability silently authorizes writes outside
  the task's configured project root.
- Before the first write, verify that the target belongs to the task's configured project root. Cross-repository writes
  require both an explicit human request naming the other repository and a host permission boundary that allows them.
- If the current task is rooted in a different repository from the one the human asks to work from, make no initialization
  or repair changes. Tell the human to create or open a task rooted in the intended repository.
- Host-specific companions such as `ai-fleas-gptapp` or `ai-fleas-my-platform` are optional consumers. Load one only when
  the selected profile or an explicit human instruction names it. A companion may add mechanics or host-owned rules but
  must not replace, weaken, or duplicate AI Fleas rules.
- Resolve `agent_platform` by exact ID through `platforms/registry.yml` or an explicitly supplied external registry. Never
  infer an adapter from a sibling folder. Platform-specific agent lifecycle and role realization belong under that
  adapter; portable workflow roles must not assume concrete task, bot, session, messaging, or archival mechanics.

## Changes

- Preserve command and workflow IDs and validate their focused tests.
- Treat paths and configuration as portable interfaces rather than machine-specific values.
- Reject duplicate command or workflow IDs rather than relying on directory precedence.
