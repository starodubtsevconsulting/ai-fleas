# pr-update.command

## Purpose

Use `pr-update` to update an existing pull request after validating its exact repository, branch, and requested changes.

## Inputs

| Input | Required | Source | Description |
|---|---|---|---|
| Active AI Profile and workflow | Yes | Host activation | Authorizes execution and resolves profile-owned configuration. |
| Detailed command inputs | As documented below | User, workflow, profile, or artifact | Command-specific values and preconditions. |

- See command description
- AI_FLOW_PROJECT_DIR / AI_FLOW_OUTPUT_DIR when applicable

## Outputs

| Output | Destination | Description |
|---|---|---|
| Detailed command outputs | Caller, configured artifact path, or authorized external system | Observable results, evidence, and effects documented below. |

- Updated files/logs/reports described above
- Terminal output and exit status

## Entry Point

| Entry point | Type | Profile-aware invocation |
|---|---|---|
| `pr/pr-update.sh` | Shell executable | Activate the selected profile and workflow, then invoke through the host's profile-aware command runner. |

Every invocation is profile-aware: the host must verify that the active workflow allows this command, resolve `AI_COMMANDS_ROOT`, and provide any profile-owned configuration before this entry point is used.

Committed configuration template: `pr/pr-update.command.example.config`. Copy it into the selected profile, set only supported command value overrides, reference the copied file through `commands[].config`, and let the host expose it as `AI_COMMAND_CONFIG_PATH`. The committed example is documentation and must never be used as operational configuration.

## Roles

- `planner`

Purpose: update an existing PR body in an append-only manner (do not move or remove content).

Usage:
`${AI_COMMANDS_ROOT}/pr/pr-update.sh <PR_URL_OR_NUMBER> <NOTE_OR_PATH>`

## Script

`ai-commands/pr/pr-update.sh`

## Steps

1. Resolve the initialized configuration binding's `commandsRoot`, then verify GitHub CLI auth via
`<commandsRoot>/gh-auth/gh-auth.command.sh --profile <workProfileId>` or `gh auth status -h github.com`.
2. Fetch the current body: `gh pr view <PR_URL_OR_NUMBER> --json body`.
3. Append the new note at the end (preserve all existing sections and formatting).
4. Update the PR: `gh pr edit <PR_URL_OR_NUMBER> --body "<updated body>"`.

## Notes

- Prefer adding a new section like `### **Testing Notes**` for test failures.
- Keep the change minimal; do not reformat or reorder prior sections.
- Requires network access to GHE.
