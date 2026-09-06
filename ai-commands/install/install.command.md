# install.command

## Purpose

Use `install` to perform a documented, explicitly authorized software installation and verify the installed result.

## Inputs

| Input | Required | Source | Description |
|---|---|---|---|
| Active AI Profile and workflow | Yes | Host activation | Authorizes execution and resolves profile-owned configuration. |
| Detailed command inputs | As documented below | User, workflow, profile, or artifact | Command-specific values and preconditions. |

- `ai-commands/install/*`

## Outputs

| Output | Destination | Description |
|---|---|---|
| Detailed command outputs | Caller, configured artifact path, or authorized external system | Observable results, evidence, and effects documented below. |

- Local machine tooling configured by the selected `install.sh` (some tools install under the home directory, others system-wide).

## Entry Point

| Entry point | Type | Profile-aware invocation |
|---|---|---|
| `install/install.sh` | Shell executable | Activate the selected profile and workflow, then invoke through the host's profile-aware command runner. |

Every invocation is profile-aware: the host must verify that the active workflow allows this command, resolve `AI_COMMANDS_ROOT`, and provide any profile-owned configuration before this entry point is used.

Committed configuration template: `install/install.command.example.config`. Copy it into the selected profile, set only supported command value overrides, reference the copied file through `commands[].config`, and let the host expose it as `AI_COMMAND_CONFIG_PATH`. The committed example is documentation and must never be used as operational configuration.

## Tags

#command #ai-command #install

Install and configure dev tooling using the local `ai-commands/install/` tree.

## Usage

- `${AI_COMMANDS_ROOT}/install/install.sh` (run all installs)
- `${AI_COMMANDS_ROOT}/install/<tool>/install.sh` (run a single tool)
- `${AI_COMMANDS_ROOT}/install/check.sh` (optional, if present)

## Rules

- Prefer running `${AI_COMMANDS_ROOT}/install/check.sh` first to see what is already installed.
- Each folder owns its own `install.sh` and README.
- If a tool supports update checks, add a `check-update.sh` and have `install.sh` call it to decide whether to prompt
for updates or reinstall.
- For language runtimes, use `v_matrix.json` to pick recommended versions.
- All install scripts must initialize logging via `report_log_init`; logs go to `ai-commands/install/logs/install.log`.
- Install logs are local artifacts and must not be committed.
- Reinstalling is OK; scripts should be idempotent where possible.
- After running installs, open a new shell (or run `exec zsh`) to activate changes.

## Roles selection

- dev
