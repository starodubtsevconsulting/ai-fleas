# review Spec

## Purpose

Define the operating rules for independently assessing a proposed code or configuration change against repository,
workflow, role, correctness, security, documentation, testing, and Definition-of-Done requirements. The command reports
actionable findings and an acceptance disposition; it does not implement, test, deliver, deploy, or close the work.

## Command Files

- `review.command.md`

## Rules

- Keep command behavior aligned with the command markdown contract.
- Keep examples and implementation references current when behavior changes.
- Do not add unrelated behavior to this command; create or use a narrower command instead.

## UI Behavior

- When this command is selected in the Command panel, show this spec in the Spec panel.
- Clicking the Spec panel title opens this file in the central dialog.
