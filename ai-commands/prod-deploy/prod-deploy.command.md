# prod-deploy.command

## Roles

- `devops`

Use for production deployment preparation under the prod-support workflow.

This command owns the pre-deploy flow when the user says things like:

- `deploy new version to prod`
- `prepare prod release`
- `generate prod release message`
- `make the Slack message for prod deploy`

## Intent Mapping

- Resolve or confirm the actual current prod version first. If the project has a canary dashboard, check it before
using git tags and read the live prod `deployedVersion` / `canaryVersion` values.
- Ask for the target candidate version when it was not provided explicitly.
- Generate the `Deploy Risk Report` before continuing with deployment execution.
- Generate the Slack release message draft for the release channel.
- Open or provide the key rollout links:
  - rollback workflow
  - canary dashboard
  - service dashboard
  - current-version logs
  - candidate-version logs
- This is the command that turns the report into the actual deployment post shape the team uses in Slack.

## Usage

```bash
./commands/prod-deploy/prod-deploy.command.sh \
  --project config-service \
  --current-version v0.0.90 \
  --candidate-version v0.0.91 \
  --report-file /path/to/prod.md \
  --output-file /path/to/prod-slack.txt
```

## Output

- Slack-ready release message text
- Optional output file with the generated message
- Links needed during rollout
- Release-alerts channel link when configured for the project

## Notes

- This command is part of prod support, not generic dev workflow.
- Prefer the canary dashboard as the quick truth source for real prod `deployedVersion` / `canaryVersion`; do not treat
a newer stable git tag as deployed until a runtime/deploy source confirms it.
- Use `support` first to open the full workspace tabs and generate the `Deploy Risk Report`.
- Then use `prod-deploy` to generate the Slack release message draft in the format used for the release alerts channel.
