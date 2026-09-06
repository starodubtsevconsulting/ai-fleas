# monitoring.command

## Purpose

Use `monitoring` to inspect configured system or application signals and report actionable health evidence.

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

- Current runtime summary
- Recent scaling activities
- Alarm states
- Datadog and AWS console URLs

## Entry Point

| Entry point | Type | Profile-aware invocation |
|---|---|---|
| `monitoring/monitoring.command.sh` | Shell executable | Activate the selected profile and workflow, then invoke through the host's profile-aware command runner. |

Every invocation is profile-aware: the host must verify that the active workflow allows this command, resolve `AI_COMMANDS_ROOT`, and provide any profile-owned configuration before this entry point is used.

Committed configuration template: `monitoring/monitoring.command.example.config`. Copy it into the selected profile, set only supported command value overrides, reference the copied file through `commands[].config`, and let the host expose it as `AI_COMMAND_CONFIG_PATH`. The committed example is documentation and must never be used as operational configuration.

## Roles

- `devops`

Use when you need a repeatable runtime validation flow that combines Datadog pages with AWS ECS/autoscaling/ALB state
for a service/environment.

## Intent Mapping

- Requests about `ECS autoscaling`, `load balancer`, `target group`, `AWS scaling activity`, `did it scale`, `open
runtime tabs`, `watch the load test`, `service auto scaling tab`, or `ALB request count` should map here.
- Prefer this helper when the user needs both browser links and the current AWS runtime state in one place.

## Usage

- `${AI_COMMANDS_ROOT}/monitoring/monitoring.command.sh --service <service> [--project-dir <path>] [--env <env>] [--open]`
- `--project-dir` defaults to `AI_FLOW_PROJECT_DIR` when available.
- `--env` defaults from active active AWS context when omitted.

## Steps

1. Resolve project metadata from the selected profile project definition (`AI_PROFILE_PROJECT_FILE`).
   - Uses service label / app name / repo path to find region and ECS cluster.
2. Query AWS for:
   - ECS desired/running/pending counts
   - task definition
   - scalable target min/max
   - scaling policies
   - recent scaling activities
   - alarm states
   - target group and load balancer details
3. Print Datadog URLs for:
   - APM service entity view
   - APM traces
   - logs
   - livetail
   - monitors
   - SLOs
   - configured dashboard link when present
4. Print AWS console URLs for:
   - ECS health
   - ECS service auto scaling
   - target groups
   - load balancers
5. If `--open` is provided, open the collected URLs through `ai-commands/browser/browser.command.sh`.

## Notes

- Requires `aws`, `jq`, and `python3`.
- Browser opens must go through `ai-commands/browser/browser.command.sh`.
- This helper is read-only; it does not mutate ECS or autoscaling state.
