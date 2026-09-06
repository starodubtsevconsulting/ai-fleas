# datadog.command

## Purpose

Use `datadog` to inspect Datadog telemetry and return evidence about application health, behavior, or incidents.

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

Command kind: `provider-implementation`.

Implements: `logs` capability `datadog` for log search, live tail, and error filtering. Direct provider-specific requests
may select this command; provider-neutral log requests must enter through [`logs`](../logs/logs.command.md), which resolves
this implementation from the active workflow context.

## Entry Point

| Entry point | Type | Profile-aware invocation |
|---|---|---|
| `datadog/datadog.sh` | Shell executable | Activate the selected profile and workflow, then invoke through the host's profile-aware command runner. |

Every invocation is profile-aware: the host must verify that the active workflow allows this command, resolve `AI_COMMANDS_ROOT`, and provide any profile-owned configuration before this entry point is used.

Committed configuration template: `datadog/datadog.command.example.config`. Copy it into the selected profile, set only supported command value overrides, reference the copied file through `commands[].config`, and let the host expose it as `AI_COMMAND_CONFIG_PATH`. The committed example is documentation and must never be used as operational configuration.

## Roles

- `devops`

Use when you need Datadog troubleshooting links for a specific service/environment.

## Intent Mapping

- Requests about `Datadog`, `SLO`, `monitor`, `alert`, `metric`, `dashboard`, `error budget`, `burn rate`, `open the
Datadog page`, or `check monitors/SLOs after deploy` should map to this command family.
- Use `datadog.sh` for logs/livetail.
- Use `datadog-monitors.sh` for SLO/monitor verification pages and post-deploy checks.
- Use `monitoring.command.sh` for ECS/autoscaling/ALB runtime validation during deploys and load tests.

## Steps

1. Confirm service name and environment.
   - If `--env` is omitted, infer env from active AWS context (`AWS_PROFILE` / `AWS_DEFAULT_PROFILE`).
2. Run:
   `${AI_COMMANDS_ROOT}/datadog/datadog.sh --service <service> --env <env> [--range 15m|1h|1d|1w] [--mode logs|livetail] [--errors-only]`
3. For post-deploy monitor checks, run:
   `${AI_COMMANDS_ROOT}/datadog/datadog-monitors.sh --service <service> --env <env> [--queue <queue-name>] [--open] [--api-list]`
4. For runtime deploy/load validation, run:
   `${AI_COMMANDS_ROOT}/monitoring/monitoring.command.sh --service <service> [--project-dir <path>] [--env <env>] [--open]`
5. The command prints the URLs and opens them in the browser when possible.

## Notes

- Requires a local browser; if unavailable, the script prints the URL to open manually.
- Default is 15-minute livetail; use `--range 1h` for last hour, etc.
- Use `--errors-only` to exclude `warn` and `info` logs.
- Monitor checks should use `datadog-monitors.sh`, which prints a verification checklist and monitor URLs.
- Runtime AWS-side checks should use `monitoring.command.sh`, which prints current ECS state, scaling policies, alarm
states, recent scaling activities, and AWS/Datadog URLs together.
- Browser opens should go through `ai-commands/browser/browser.command.sh`, not raw `xdg-open`.
