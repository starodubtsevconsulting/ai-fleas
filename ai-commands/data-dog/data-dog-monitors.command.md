# data-dog-monitors.command

## Roles

- `devops`

Use when you need a repeatable monitor validation flow after deployment.

## Intent Mapping

- Requests about `SLO page`, `monitor page`, `Datadog monitors`, `Datadog SLOs`, `error budget`, `burn rate`,
`metric-based alert verification`, or `check if alerts/SLOs were created` should map here.
- Prefer this command over raw browser opens when the user is validating observability resources after deployment.

## Usage

- `./commands/data-dog/data-dog-monitors.sh --service <service> --env <env> [--queue <queue-name>] [--open] [--api-list]`
- `--queue` can be passed multiple times.
- `--api-list` uses Datadog API keys from env or `commands/data-dog/data-dog.command.conf`.

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

- This command is for monitor verification; `data-dog.sh` remains for log/livetail.
- If Datadog API network access is blocked, use the printed monitor URLs manually in browser.
- Browser opens should go through `commands/browser/browser.command.sh`.

## Inputs

- See command description
- AI_FLOW_PROJECT_DIR / AI_FLOW_OUTPUT_DIR when applicable

## Output

- Verification checklist
- Monitor management URLs
- Optional monitor list (Datadog API)
