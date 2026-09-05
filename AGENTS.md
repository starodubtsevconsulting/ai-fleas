# AI Fleas Rules

This repository is the public rules and contracts layer for AI Fleas. Keep all content portable and safe to publish.

## Boundaries

- Reusable commands live in `ai-commands/`.
- Reusable workflow contracts, roles, and governance live in `ai-workflows/`.
- Profile structure, documentation, validation, and sanitized examples live in `ai-profile/`.
- Do not add launcher, UI, backend, real profile, credential, client, private-provider, absolute-path, or runtime-state data.
- AI Fleas Platform may consume this repository. This repository must never depend on AI Fleas Platform.

## Initialization and repository containment

- Treat the AI host's configured project root as the immutable repository identity for the task. A shell working-directory
  change, reachable sibling directory, remembered task, or similarly named folder does not re-scope the task.
- When the human asks to initialize from `ai-fleas`, load this repository's `AGENTS.md`, the explicitly selected profile,
  and the public commands and workflows selected by that profile. Do not discover or infer a launcher, platform, profile,
  or companion repository merely because it exists nearby.
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

## Changes

- Preserve command and workflow IDs and validate their focused tests.
- Treat paths and configuration as portable interfaces rather than machine-specific values.
- Reject duplicate command or workflow IDs rather than relying on directory precedence.
