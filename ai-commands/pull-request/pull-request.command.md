## Tags

#command #ai-command #pull-request #pr

- use the current active session plan at `<session-root>/<work-profile>/<session-id>/session-plan.md` to summarize what was done
- include completed checklist items from `## Progress` in the PR description
- if there are open checklist items, call them out under a `Remaining` section
- keep the summary concise and actionable (what changed, tests run)
- include test commands and outcomes when available

## Roles selection

- dev

## Input

- branch
- project registry entry from `rules/commands/projects/registry/<project-id>/project.yml`
- `<session-root>/<work-profile>/<session-id>/session-plan.md`

## Output

- PR description content

## Git Usage

- default: create PR via GitHub CLI (`gh pr create`) when available
- after a PR is created successfully, always open the PR URL in the local browser via the `browser` command unless the
user explicitly asked not to open it
- if the active project registry entry defines `default_pr_reviewers`, request that reviewer list on PR create or
existing-PR update unless the user explicitly overrides it
- if a PR already exists for the branch, resolve its URL, request any missing default reviewers, and open that URL in
the browser instead of making the user do it manually
- if `gh` is not available or access is blocked, provide the exact PR URL and still open it in the browser when possible
- before attempting PR creation, verify remote access (e.g., `git remote -v`) and authentication
- if a push/PR action requires escalation or user approval, request it before proceeding

## Existing PR Updates

- if a PR already exists for the branch, update it instead of creating a new one
- before any existing-PR update, verify that at least one write path is actually usable:
  - `gh auth status -h github.com` must be valid for CLI-based `gh pr edit`
  - or the GitHub app/connector used in the session must have access to the target repository
- if neither write path is available, stop pretending the PR can be edited directly:
  - tell the user which path is blocked (`gh` auth, GitHub app repo access, or both)
  - provide the exact replacement PR body/comment text
  - provide the PR URL for manual edit
- prefer `gh pr edit` to update title/body
- use `gh pr edit --add-reviewer ...` or an equivalent review-request action to apply project defaults when they are missing
- if `gh` is unavailable, provide steps to edit via the PR URL

## Authentication

- check user's `creds.json` for a profile-scoped `gihubToken` under the active work profile before calling GitHub API
- example `creds.json` path is user-specific; if missing, ask the user to provide it
- for GitHub CLI flows, resolve the initialized configuration binding's `commandsRoot`, then explicitly run
`<commandsRoot>/gh-auth/gh-auth.command.sh --profile <workProfileId>` or `gh auth status -h github.com` before PR
create/edit/update work
- if the repository was renamed or moved, verify the current remote/repository slug before reporting PR access status
