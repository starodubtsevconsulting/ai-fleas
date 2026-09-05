# data-dog.command

## Roles

- `devops`

Use when you need Datadog troubleshooting links for a specific service/environment.

## Intent Mapping

- Requests about `Datadog`, `SLO`, `monitor`, `alert`, `metric`, `dashboard`, `error budget`, `burn rate`, `open the
Datadog page`, or `check monitors/SLOs after deploy` should map to this command family.
- Use `data-dog.sh` for logs/livetail.
- Use `data-dog-monitors.sh` for SLO/monitor verification pages and post-deploy checks.
- Use `monitoring.command.sh` for ECS/autoscaling/ALB runtime validation during deploys and load tests.

## Steps

1. Confirm service name and environment.
   - If `--env` is omitted, infer env from active AWS context (`AWS_PROFILE` / `AWS_DEFAULT_PROFILE`).
2. Run:
   `./commands/data-dog/data-dog.sh --service <service> --env <env> [--range 15m|1h|1d|1w] [--mode logs|livetail] [--errors-only]`
3. For post-deploy monitor checks, run:
   `./commands/data-dog/data-dog-monitors.sh --service <service> --env <env> [--queue <queue-name>] [--open] [--api-list]`
4. For runtime deploy/load validation, run:
   `./commands/monitoring/monitoring.command.sh --service <service> [--project-dir <path>] [--env <env>] [--open]`
5. The command prints the URLs and opens them in the browser when possible.

## Notes

- Requires a local browser; if unavailable, the script prints the URL to open manually.
- Default is 15-minute livetail; use `--range 1h` for last hour, etc.
- Use `--errors-only` to exclude `warn` and `info` logs.
- Monitor checks should use `data-dog-monitors.sh`, which prints a verification checklist and monitor URLs.
- Runtime AWS-side checks should use `monitoring.command.sh`, which prints current ECS state, scaling policies, alarm
states, recent scaling activities, and AWS/Datadog URLs together.
- Browser opens should go through `commands/browser/browser.command.sh`, not raw `xdg-open`.

## Inputs

- See command description
- AI_FLOW_PROJECT_DIR / AI_FLOW_OUTPUT_DIR when applicable

## Output

- Updated files/logs/reports described above
- Terminal output and exit status
