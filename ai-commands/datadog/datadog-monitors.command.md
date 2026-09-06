# datadog-monitors.command

## Purpose

Use `datadog-monitors` to inspect or manage explicitly authorized Datadog monitor configuration and evidence.

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

- Verification checklist
- Monitor management URLs
- Optional monitor list (Datadog API)

## Entry Point

| Entry point | Type | Profile-aware invocation |
|---|---|---|
| `datadog/datadog-monitors.sh` | Shell executable | Activate the selected profile and workflow, then invoke through the host's profile-aware command runner. |

Every invocation is profile-aware: the host must verify that the active workflow allows this command, resolve `AI_COMMANDS_ROOT`, and provide any profile-owned configuration before this entry point is used.

Committed configuration template: `datadog/datadog-monitors.command.example.config`. Copy it into the selected profile, set only supported command value overrides, reference the copied file through `commands[].config`, and let the host expose it as `AI_COMMAND_CONFIG_PATH`. The committed example is documentation and must never be used as operational configuration.

## Roles

- `devops`

Use when you need a repeatable monitor validation flow after deployment.

## Intent Mapping

- Requests about `SLO page`, `monitor page`, `Datadog monitors`, `Datadog SLOs`, `error budget`, `burn rate`,
`metric-based alert verification`, or `check if alerts/SLOs were created` should map here.
- Prefer this command over raw browser opens when the user is validating observability resources after deployment.

## Usage

- `${AI_COMMANDS_ROOT}/datadog/datadog-monitors.sh --service <service> --env <env> [--queue <queue-name>] [--open] [--api-list]`
- `--queue` can be passed multiple times.
- `--api-list` uses Datadog API keys from the environment or profile-owned configuration passed as `AI_COMMAND_CONFIG_PATH`.

## Steps

1. Run command with target service and environment.
   - If `--env` is omitted, infer env from active AWS context (`AWS_PROFILE` / `AWS_DEFAULT_PROFILE`).
2. Open/inspect Datadog monitor pages from printed URLs.
   - Includes SLO page (`slo/manage`) and monitor page (`monitors/manage`).
3. Validate expected categories:
   - SLOs
   - ECS/Fargate
   - Netty
   - DynamoDB
   - SQS (if queue provided)
4. If `--api-list` is enabled, confirm monitor names/status from Datadog API output.

## Notes

- This command is for monitor verification; `datadog.sh` remains for log/livetail.
- If Datadog API network access is blocked, use the printed monitor URLs manually in browser.
- Browser opens should go through `ai-commands/browser/browser.command.sh`.
