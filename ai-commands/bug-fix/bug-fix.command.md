# bug-fix.command

## Purpose

Use `bug-fix` to diagnose a reported defect, implement the smallest safe correction, and produce verification evidence.

## Inputs

| Input | Required | Source | Description |
|---|---|---|---|
| Active AI Profile and workflow | Yes | Host activation | Authorizes the command and resolves profile-owned configuration. |
| Command-specific input | Yes | User, workflow, profile, or source artifact | Defect description, reproduction evidence, affected scope, and active project. |

## Outputs

| Output | Destination | Description |
|---|---|---|
| Command result | Caller, configured artifact path, or authorized external system | Verified bounded fix, tests, and change evidence. |

#command #ai-command #bug-fix #regression #testing

if user aks to fix something, it is a bug fix, so:

- if we are working in this `ai` tooling repo: treat it as a **local meta project** (dev tooling that runs on the
user's machine), so assume it is **not** a prod issue unless the user explicitly says it is prod
- otherwise, ask if it is prod bug; if it is we have to report to /docs/[app]/prod-issues about it,
  with 1. symptoms 2. cause 3. impact 4. proposal to fix 5. prevention plan
- if it is not prod bug (or not critical),
  ask if it is a regression,
- the `plan.md` has to link the prod issue report too.

when critical:

- we have first to reproduce it, unit tess, integration and e2e
- we are not trying to fix it IF we did not reproduce it first!
- as we did reproduce and fixed, we have to update docs/design etc to make sure we would not screw it again.

## Entry Point

| Entry point | Type | Profile-aware invocation |
|---|---|---|
| `bug-fix/bug-fix.sh` | Shell executable | Activate the selected profile and workflow, then invoke through the host's profile-aware command runner. |

Every invocation is profile-aware: the host must verify that the active workflow allows this command, resolve `AI_COMMANDS_ROOT`, and provide any profile-owned configuration before this entry point is used.

Committed configuration template: `bug-fix/bug-fix.command.example.config`. Copy it into the selected profile, set only supported command value overrides, reference the copied file through `commands[].config`, and let the host expose it as `AI_COMMAND_CONFIG_PATH`. The committed example is documentation and must never be used as operational configuration.

## Tags

#command #ai-command #bug-fix #debugging #testing #regression
