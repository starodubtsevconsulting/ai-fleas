# springboot-stop.command

## Purpose

Use `springboot-stop` to stop the exact selected Spring Boot process and verify that it terminated.

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
| `springboot/springboot-stop.command.sh` | Shell executable | Activate the selected profile and workflow, then invoke through the host's profile-aware command runner. |

Every invocation is profile-aware: the host must verify that the active workflow allows this command, resolve `AI_COMMANDS_ROOT`, and provide any profile-owned configuration before this entry point is used.

Committed configuration template: `springboot/springboot-stop.command.example.config`. Copy it into the selected profile, set only supported command value overrides, reference the copied file through `commands[].config`, and let the host expose it as `AI_COMMAND_CONFIG_PATH`. The committed example is documentation and must never be used as operational configuration.

## Roles

- `devops`

Stop a running Spring Boot app started by `springboot-run.command.sh`.

## Usage

- `${AI_COMMANDS_ROOT}/springboot/springboot-stop.command.sh [--project-dir <path>] [--output-dir <path>] [--log <path>] [--pid
<pid>] [--wait <seconds>]`

## Defaults

- If neither `--log` nor `--pid` is provided, uses the newest `*.log` under `${AI_FLOW_OUTPUT_DIR}/springboot/`.
- Falls back to `<repo>/.ai/springboot/` when `AI_FLOW_OUTPUT_DIR` is unset.
- Waits up to 10 seconds before sending SIGKILL.

## Example

- `${AI_COMMANDS_ROOT}/springboot/springboot-stop.command.sh`
