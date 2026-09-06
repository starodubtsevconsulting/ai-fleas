# install Spec

## Purpose

Define the operating rules for the `install` command.

## Command Files

- `install.command.md`

## Rules

- Keep command behavior aligned with the command markdown contract.
- Keep examples and implementation references current when behavior changes.
- Do not add unrelated behavior to this command; create or use a narrower command instead.
- Canonical commands inside the `install` group are `chatgpt` and `hermes`; `GPT`, `GPT App`, and `Hermes App` are human aliases only.
- Local installation supports only macOS Apple Silicon (`Darwin/arm64`) until this contract explicitly adds another host.
- `install` owns physical package lifecycle. Platform commands own agents, profiles, workflows, projects, tasks, bots,
  conversations, and presentation groups.
- `check-update` and `update` are read-only; `upgrade` and `uninstall` require explicit human authorization.
- The `codex` installation command means Codex CLI and must never silently stand in for `chatgpt`.
- An unsupported host operation returns an explicit unavailable result with zero mutation.
- Every application adapter has a deterministic focused test and a read-only smoke test. Install or upgrade is complete
  only after identity/version verification and its smoke test pass.
- Uninstall removes only verified adapter-owned application artifacts and preserves user data unless separately and
  explicitly authorized.

## UI Behavior

- When this command is selected in the Command panel, show this spec in the Spec panel.
- Clicking the Spec panel title opens this file in the central dialog.
