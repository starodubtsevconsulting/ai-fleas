# design.command

## Purpose

Use `design` to turn requirements into an implementation-ready technical design with boundaries, decisions, and acceptance criteria.

## Inputs

| Input | Required | Source | Description |
|---|---|---|---|
| Active AI Profile and workflow | Yes | Host activation | Authorizes execution and resolves profile-owned configuration. |
| Detailed command inputs | As documented below | User, workflow, profile, or artifact | Command-specific values and preconditions. |

- `<session-root>/<work-profile>/<session-id>/session-plan.md`

## Outputs

| Output | Destination | Description |
|---|---|---|
| Detailed command outputs | Caller, configured artifact path, or authorized external system | Observable results, evidence, and effects documented below. |

- `{project_location}/.plan/architect/work-spec.md`

## Entry Point

| Entry point | Type | Profile-aware invocation |
|---|---|---|
| `design/design.command.md` | AI-readable contract | The initialized workflow role loads this contract after the host activates the selected profile and workflow. |

Every invocation is profile-aware: the host must verify that the active workflow allows this command, resolve `AI_COMMANDS_ROOT`, and provide any profile-owned configuration before this entry point is used.

Committed configuration template: `design/design.command.example.config`. Copy it into the selected profile, set only supported command value overrides, reference the copied file through `commands[].config`, and let the host expose it as `AI_COMMAND_CONFIG_PATH`. The committed example is documentation and must never be used as operational configuration.

## Design command



## Tags

#command #ai-command #design #ddd

Create a solution approach before coding.

Before design work, read and follow:

- `../../../../docs/ddd-style.md`

- capture constraints, assumptions, and non-goals
- propose the high-level plan and key decisions
- identify dependencies and risks
- keep it short, actionable, and aligned with the domain
- model design around domain boundaries, commands, queries, and explicit views

## Roles selection

- architect
