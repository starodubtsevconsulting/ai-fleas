## Tags

#command #ai-command #gh-auth #github

## Purpose

- authenticate GitHub CLI from `<ai-profile-root>/<profile-id>/.creds/creds.json` for the active work profile
- keep PR and GitHub command flows from failing on stale `gh` keyring state

## Creds Lookup

- primary: `profiles.<workProfileId>.gihubToken`
- backward-compatible fallback: `profiles.<workProfileId>.codex.gihubToken`

## Behavior

- resolve the active work profile from `WORK_PROFILE_ID`, `AI_FLOW_PROFILE`, or `--profile`
- if a token is found, run `gh auth login -h github.com --with-token` and then `gh auth status -h github.com`
- if no token is found, fail with an explicit message telling the user which profile is missing `gihubToken`
