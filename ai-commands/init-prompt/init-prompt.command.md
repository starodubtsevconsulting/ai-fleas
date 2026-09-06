# init-prompt.command

## Purpose

Use `init-prompt` to generate the portable initialization prompt for a selected profile, workflow, project, and platform context.

## Inputs

| Input | Required | Source | Description |
|---|---|---|---|
| Active AI Profile and workflow | Yes | Host activation | Authorizes execution and resolves profile-owned configuration. |
| Detailed command inputs | As documented below | User, workflow, profile, or artifact | Command-specific values and preconditions. |

- TBD

## Outputs

| Output | Destination | Description |
|---|---|---|
| Detailed command outputs | Caller, configured artifact path, or authorized external system | Observable results, evidence, and effects documented below. |

- TBD

## Entry Point

| Entry point | Type | Profile-aware invocation |
|---|---|---|
| `init-prompt/init-prompt.sh` | Shell executable | Activate the selected profile and workflow, then invoke through the host's profile-aware command runner. |

Every invocation is profile-aware: the host must verify that the active workflow allows this command, resolve `AI_COMMANDS_ROOT`, and provide any profile-owned configuration before this entry point is used.

Committed configuration template: `init-prompt/init-prompt.command.example.config`. Copy it into the selected profile, set only supported command value overrides, reference the copied file through `commands[].config`, and let the host expose it as `AI_COMMAND_CONFIG_PATH`. The committed example is documentation and must never be used as operational configuration.

## Tags

#command #ai-command #init-prompt

Generate a startup prompt string once the target project is known (project
context + initial instructions). The command writes the prompt to stdout so an
authorized host or a command-owned launcher can consume it without coupling
this public command to a particular platform launcher.

Usage:

- `INIT_PROJECT_INSTRUCTION="$(${AI_COMMANDS_ROOT}/init-prompt/init-prompt.sh --project-dir <path> --project-label <label>)"`
- `INIT_PROJECT_INSTRUCTION="$(${AI_COMMANDS_ROOT}/init-prompt/init-prompt.sh --project-dir <path> --extra "Use short answers."
--quote "Quote: Stay hungry.")"`
- If `--project-dir` is omitted, uses `AI_FLOW_PROJECT_DIR` when set.
- If `--project-label` is omitted, resolves from the selected profile project definition (`AI_PROFILE_PROJECT_FILE`) (fallback to project dir basename).
- `--extra` accepts free-text instructions appended to the prompt.
- `--quote` overrides the default Star Wars quote with custom text.

Notes:

- This command prints the prompt to stdout (no side effects).
- Intended for `INIT_PROJECT_INSTRUCTION` or `--startup-prompt`.
- The prompt can come from the project entry point (`./ai`) or be generated after project selection in the `ai` flow; see `workflow.md`.
- The default startup prompt includes explicit `MUST` instructions for:
  - workflow-first execution,
  - command matching from `ai-commands/*`,
  - updating `<session-root>/<work-profile>/<session-id>/session-plan.md` first for every request,
  - checklist-only progress under `## Progress` with role tags.

- The default prompt includes a Star Wars quote.

## Roles selection

- dev
