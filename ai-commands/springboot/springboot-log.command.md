# springboot-log.command

## Purpose

Use `springboot-log` to retrieve and inspect logs from the selected Spring Boot application instance.

## Inputs

| Input | Required | Source | Description |
|---|---|---|---|
| Active AI Profile and workflow | Yes | Host activation | Authorizes execution and resolves profile-owned configuration. |
| Detailed command inputs | As documented below | User, workflow, profile, or artifact | Command-specific values and preconditions. |

- See command description
- AI_FLOW_PROJECT_DIR / AI_FLOW_OUTPUT_DIR when applicable

## Outputs

| Output | Destination | Description |
|---|---|---|
| Detailed command outputs | Caller, configured artifact path, or authorized external system | Observable results, evidence, and effects documented below. |

- Updated files/logs/reports described above
- Terminal output and exit status

## Entry Point

| Entry point | Type | Profile-aware invocation |
|---|---|---|
| `springboot/springboot-log.command.sh` | Shell executable | Activate the selected profile and workflow, then invoke through the host's profile-aware command runner. |

Every invocation is profile-aware: the host must verify that the active workflow allows this command, resolve `AI_COMMANDS_ROOT`, and provide any profile-owned configuration before this entry point is used.

Committed configuration template: `springboot/springboot-log.command.example.config`. Copy it into the selected profile, set only supported command value overrides, reference the copied file through `commands[].config`, and let the host expose it as `AI_COMMAND_CONFIG_PATH`. The committed example is documentation and must never be used as operational configuration.

## Roles

- `devops`

Check the latest Spring Boot log and report whether the app looks started successfully.

## Usage

- `${AI_COMMANDS_ROOT}/springboot/springboot-log.command.sh [--project-dir <path>] [--output-dir <path>] [--log <path>] [--tail
<lines>] [--watch] [--interval <seconds>]`

## Defaults

- Uses the newest `*.log` under `${AI_FLOW_OUTPUT_DIR}/springboot/`.
- Falls back to `<repo>/.ai/springboot/` when `AI_FLOW_OUTPUT_DIR` is unset.
- `--interval` defaults to 30 seconds when `--watch` is used.

## Behavior

- Status is `SUCCESS` if a `Started` line is present and no error is found.
- Status is `FAILURE` if an `Exception`, `ERROR`, or `Caused by:` line is found.
- Status is `STARTING` if the PID is still running and neither condition above is met.
- With `--watch`, the command rechecks every 30 seconds until `SUCCESS` or `FAILURE`.

## Example

- `${AI_COMMANDS_ROOT}/springboot/springboot-log.command.sh --watch`
