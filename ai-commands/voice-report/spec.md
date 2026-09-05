# voice-report Spec

## Purpose

Define the operating rules for the `voice-report` command.

## Command Files

- `voice-report.command.md`
- `app.sh`
- `launcher/electron/main.cjs`
- `launcher/renderer/index.html`

## Rules

- Keep command behavior aligned with the command markdown contract.
- Keep examples and implementation references current when behavior changes.
- Do not add unrelated behavior to this command; create or use a narrower command instead.

## UI Behavior

- When this command is selected in the Command panel, show this spec in the Spec panel.
- Clicking the Spec panel title opens this file in the central dialog.
