# monitoring.command

## Roles

- `devops`

Use when you need a repeatable runtime validation flow that combines Datadog pages with AWS ECS/autoscaling/ALB state
for a service/environment.

## Intent Mapping

- Requests about `ECS autoscaling`, `load balancer`, `target group`, `AWS scaling activity`, `did it scale`, `open
runtime tabs`, `watch the load test`, `service auto scaling tab`, or `ALB request count` should map here.
- Prefer this helper when the user needs both browser links and the current AWS runtime state in one place.

## Usage

- `./commands/monitoring/monitoring.command.sh --service <service> [--project-dir <path>] [--env <env>] [--open]`
- `--project-dir` defaults to `AI_FLOW_PROJECT_DIR` when available.
- `--env` defaults from active active AWS context when omitted.

## Steps

1. Resolve project metadata from `commands/projects/projects-registry.yml`.
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
5. If `--open` is provided, open the collected URLs through `commands/browser/browser.command.sh`.

## Notes

- Requires `aws`, `jq`, and `python3`.
- Browser opens must go through `commands/browser/browser.command.sh`.
- This helper is read-only; it does not mutate ECS or autoscaling state.

## Inputs

- See command description
- AI_FLOW_PROJECT_DIR / AI_FLOW_OUTPUT_DIR when applicable

## Output

- Current runtime summary
- Recent scaling activities
- Alarm states
- Datadog and AWS console URLs
