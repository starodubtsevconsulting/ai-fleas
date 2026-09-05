# sdd Spec

## Purpose

Define the operating rules for the `sdd` command.

## Command Files

- `sdd.command.md`

## Rules

- Keep command behavior aligned with the command markdown contract.
- Keep examples and implementation references current when behavior changes.
- Do not add unrelated behavior to this command; create or use a narrower command instead.
- The staged-scope guard allows repository-root Markdown documentation, including governance instructions and idea notes,
  while continuing to reject unrelated root scripts and source files.
- The guard allows launcher-owned scripts under `ai-launcher/scripts/**`; these are part of the configured launcher
  runtime surface. This does not authorize arbitrary root or project scripts.

## UI Behavior

- When this command is selected in the Command panel, show this spec in the Spec panel.
- Clicking the Spec panel title opens this file in the central dialog.
