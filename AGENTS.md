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

### First-use initialization request

```mermaid
flowchart LR
  Prompt["Human initialization prompt"] --> Profile["Exact AI Profile"]
  Profile --> Scope["Workflow + logical project + work target"]
  Profile --> Platform["agent_platform → platforms/registry.yml"]
  Platform --> Binding["Profile commands[] binding"]
  Binding --> Config["Profile-owned command config"]
  Config --> Decision{"registered lifecycle command"}
  Decision -->|gpt-app| GPT["gpt-app/gpt-app.command.md"]
  Decision -->|hermes-app| Hermes["hermes-app/hermes-app.command.sh"]
  GPT --> GPTResult["Initialize workflow role roster"]
  Hermes --> HermesResult["Initialize workflow-scoped bot"]
  Scope --> GPT
  Scope --> Hermes
```

Detailed lifecycle behavior is defined by the
[`gpt-app` command](ai-commands/gpt-app/gpt-app.command.md) and
[`hermes-app` command](ai-commands/hermes-app/hermes-app.command.md). The table below maps common human wording to those
routes.

| Human prompt | Required resolution and command routing | Expected result |
| --- | --- | --- |
| `Initialize profile <profile-id>, workflow <workflow-id>, and platform <platform-id> using the profile-configured work target.` | Load the exact profile → validate its workflow and work target → resolve `agent_platform` through `platforms/registry.yml` → find the profile `commands[]` binding for that platform's lifecycle command → load its `config` → verify `registered_command` and `command_path` → invoke `initialize` through the resolved entry point and adapter. | Initialize the adapter-declared agent realization and return exact instance receipts. |
| `Initialize <profile-id>-<workflow-id> for <platform>` | Parse the complete logical-project ID into an exact existing profile and authorized workflow, preserving any suffix; resolve the platform phrase to one registered ID, then follow the same profile-command route as the full prompt. | Perform the same initialization as the full prompt without inventing a command from the platform name. |
| `Initialize client-a-dev for GPT` | Select fictional profile `client-a`, workflow `dev`, platform `gpt-app`, and logical project `client-a-dev` → resolve profile command `gpt-app` → load its config and `gpt-app/gpt-app.command.md` → invoke `initialize` through `platforms/gpt-app`. | Initialize the complete GPT App workflow roster only when the saved project root exactly matches the profile work target. |
| `Initialize client-a-dev for Hermes` | Select fictional profile `client-a`, workflow `dev`, platform `hermes`, and logical project `client-a-dev` → resolve profile command `hermes-app` → load its config and `hermes-app/hermes-app.command.sh` → invoke `initialize` through `platforms/hermes`. | Initialize the one workflow-scoped Hermes bot currently declared by that adapter. |
| `Initialize agents` from an already bound logical project | Use the caller's verified profile, workflow, platform, complete logical-project ID, and work target; still resolve the command from the profile binding and never from task title or memory. | Initialize through the exact resolved command without asking the human to repeat known values. |
| `Initialize dev for GPT` from an unbound context | Workflow and platform are known, but profile, logical project, work target, and therefore the profile-owned command binding are unresolved. | Ask for the missing profile and perform zero mutation. |
| Any initialization prompt whose profile, workflow, platform, command binding, logical project, or work target conflicts | Stop command resolution; do not select a similarly named folder, substitute another command, infer a nearby platform, or partially initialize. | Return the exact conflict or missing value and perform zero mutation. |

Safe public profile examples include `org-a`, `client-a`, `client-b`, and `personal`. Public examples must never use a
real client, organization, person, project, or machine name. The selected platform adapter determines realization: it
may create a complete managed-agent roster, one workflow-scoped bot, or another platform-specific representation.

The routing identity is the profile's `commands[].id` plus its profile-owned `config`, not a command guessed from natural
language. `GPT` resolves to platform `gpt-app`, whose lifecycle command is `gpt-app`; `Hermes` resolves to platform
`hermes`, whose lifecycle command is `hermes-app`. Platform and command IDs may differ and must be joined through the
declared profile and platform registry.

## Changes

- Preserve command and workflow IDs and validate their focused tests.
- Treat paths and configuration as portable interfaces rather than machine-specific values.
- Reject duplicate command or workflow IDs rather than relying on directory precedence.
