# gh-auth.command

## Purpose

- authenticate GitHub CLI from `<ai-profile-root>/<profile-id>/.creds/creds.json` for the active work profile
- keep PR and GitHub command flows from failing on stale `gh` keyring state

## Inputs

| Input | Required | Source | Description |
|---|---|---|---|
| Active AI Profile and workflow | Yes | Host activation | Authorizes the command and resolves profile-owned configuration. |
| Command-specific input | Yes | User, workflow, profile, or source artifact | Active profile, GitHub host, and requested authentication operation. |

## Outputs

| Output | Destination | Description |
|---|---|---|
| Command result | Caller, configured artifact path, or authorized external system | Verified authentication state or an explicit blocked/failure result. |

#command #ai-command #gh-auth #github

## Entry Point

| Entry point | Type | Profile-aware invocation |
|---|---|---|
| `gh-auth/gh-auth.command.sh` | Shell executable | Activate the selected profile and workflow, then invoke through the host's profile-aware command runner. |

Every invocation is profile-aware: the host must verify that the active workflow allows this command, resolve `AI_COMMANDS_ROOT`, and provide any profile-owned configuration before this entry point is used.

Committed configuration template: `gh-auth/gh-auth.command.example.config`. Copy it into the selected profile, set only supported command value overrides, reference the copied file through `commands[].config`, and let the host expose it as `AI_COMMAND_CONFIG_PATH`. The committed example is documentation and must never be used as operational configuration.

## Tags



## Creds Lookup

- primary: `profiles.<workProfileId>.gihubToken`
- backward-compatible fallback: `profiles.<workProfileId>.codex.gihubToken`

## Behavior

- resolve the active work profile from `WORK_PROFILE_ID`, `AI_FLOW_PROFILE`, or `--profile`
- if a token is found, run `gh auth login -h github.com --with-token` and then `gh auth status -h github.com`
- if no token is found, fail with an explicit message telling the user which profile is missing `gihubToken`
