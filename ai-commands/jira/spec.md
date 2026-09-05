# Jira Command Spec

## Purpose

Define the operating and reusable acceptance rules for the organization-neutral Jira command adapter.

## Command files

- `jira.command.md`
- `jira.command.sh`
- `jira.scenario.md`

## Rules

- Keep mechanics aligned with `jira.command.md` and organization-specific values in the active profile.
- Treat `tracker.execution.command_env_overrides` as overrides for environment placeholders declared by this command.
- Keep browser reads factual and fail closed when the configured source, ticket identity, or rendered fields cannot be verified.
- Run `jira.command.test.sh` before the live scenario.
- Use `jira.scenario.md` after changes to browser navigation, inventory, exact reads, profile overrides, or Manager routing.
- Never weaken mutation authorization to make an acceptance scenario pass.

## UI behavior

- When this command is selected in the Command panel, show this spec in the Spec panel.
- Clicking the Spec panel title opens this file in the central dialog.
