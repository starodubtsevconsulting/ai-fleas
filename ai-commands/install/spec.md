# install Spec

## Purpose

Define the operating rules for the `install` command.

## Command Files

- `install.command.md`

## Rules

- Keep command behavior aligned with the command markdown contract.
- Keep examples and implementation references current when behavior changes.
- Do not add unrelated behavior to this command; create or use a narrower command instead.
- Canonical application targets are `gpt-app` and `hermes-app`; `GPT` and `Hermes` are human aliases only.
- `install` owns physical package lifecycle. Platform commands own agents, profiles, workflows, projects, tasks, bots,
  conversations, and presentation groups.
- `check-update` and `update` are read-only; `upgrade` and `uninstall` require explicit human authorization.
- The `codex` installation target means Codex CLI and must never silently stand in for `gpt-app`.
- An unsupported host operation returns an explicit unavailable result with zero mutation.
- Uninstall removes only verified adapter-owned application artifacts and preserves user data unless separately and
  explicitly authorized.

## UI Behavior

- When this command is selected in the Command panel, show this spec in the Spec panel.
- Clicking the Spec panel title opens this file in the central dialog.
