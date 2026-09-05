# slack.command

## Roles

- `devops`

Use when you need to open a project's Slack support channel, alerts Slack channel, Opsgenie service, or both from the project registry.

## Intent Mapping

- Requests about `open project slack`, `open service slack`, `open opsgenie`, `open alert channel`, `open alerts
slack`, `open alert support links`, or `open slack for <project>` should map here.
- Requests like `prod support`, `test support`, `dev support`, `support channel`, `where is the support channel`, or
`open support for <project>` should first resolve the project via `projects`, then map here.
- Requests like `alerts channel`, `alerts slack`, `where do alerts go`, or `open alerts for <project>` should first
resolve the project via `projects`, then map here with the alerts target.
- This command reads project-specific links from `commands/projects/projects-registry.yml`.

## Usage

- `./commands/slack/slack.command.sh --project <label> [--target slack|alerts|opsgenie|both]`

## Steps

1. Resolve the project entry from `commands/projects/projects-registry.yml`.
2. Read `slack_url`, `alerts_slack_url`, and/or `opsgenie_url` from that entry.
3. Open the requested link(s) with `commands/browser/browser.command.sh`.
4. Print the resolved URLs so the user can reuse them manually if needed.

## Notes

- Keep project support links in `commands/projects/projects-registry.yml`; this command is only the opener.
- Use `--target both` to open the general Slack channel and Opsgenie together.
- Use `--target alerts` to open the dedicated alert channel.
- If a project lacks one of the links, the command should fail clearly instead of silently guessing.

## Inputs

- See command description
- AI_FLOW_PROJECT_DIR / AI_FLOW_OUTPUT_DIR when applicable

## Output

- Resolved Slack/Opsgenie URLs
- Browser opens via the browser command
