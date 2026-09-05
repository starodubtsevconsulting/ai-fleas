# pr-update.command

## Roles

- `planner`

Purpose: update an existing PR body in an append-only manner (do not move or remove content).

Usage:
`./commands/pr/pr-update.sh <PR_URL_OR_NUMBER> <NOTE_OR_PATH>`

## Script

`commands/pr/pr-update.sh`

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

## Inputs

- See command description
- AI_FLOW_PROJECT_DIR / AI_FLOW_OUTPUT_DIR when applicable

## Output

- Updated files/logs/reports described above
- Terminal output and exit status
