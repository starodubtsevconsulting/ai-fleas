## Tags

#command #ai-command #backlog #work-session #plan

Manage shared backlog files stored under `session-root/<work-profile>/backlog/`, copy a selected backlog into the
active session when it is picked, sync a backlog story to a GitHub issue when requested, and compile the selected
backlog into the active session plan file:
`session-root/<work-profile>/<session-id>/plan.md`.

## Behavior

- `list`: list backlog markdown files for the current work profile and mark `ACTIVE`
- `pick --backlog <name-or-path>`: copy a backlog file from `session-root/<work-profile>/backlog/` into the active
session, mark it active, and compile it into `session-root/<work-profile>/<session-id>/plan.md`
- `get --backlog <name-or-path>`: alias for `pick`
- `open --backlog <name-or-path>`: alias for `pick`
- `show [--backlog <name-or-path>]`: print the selected backlog (or active backlog) to stdout
- `delete [--backlog <name-or-path>]`: delete the selected backlog file, or delete the active backlog when no argument is provided
- `sync [--backlog <name-or-path>] [--repo <owner/name>] [--dry-run]`: create a GitHub issue for the selected backlog
story in the target project repo, then write the issue metadata back into the backlog story
- Backlog stories live under `session-root/<work-profile>/backlog/` and are intended to be tracked in git
- Picking a backlog requires an active session plan in `session-root/.current-plan-path`
- Picked backlog files are copied from `session-root/<work-profile>/backlog/` into the active session directory so the
shared backlog remains available across machines
- GitHub sync resolves the target repo from the story's `Project:` field through the committed project registry, unless
`--repo` overrides it
- Successful GitHub sync writes `GitHub Repo`, `GitHub Issue`, `GitHub Issue URL`, and `GitHub Synced At` back into the backlog story
- Successful GitHub sync also opens the created issue in the local browser via the `browser` command so the user can see it immediately
- GitHub sync requires a valid `gh` login; if authentication is missing or invalid, the command stops and preserves the
backlog story unchanged
- Picking a backlog rewrites the active session `plan.md` so session progress is driven by the chosen backlog scope

## Usage

```bash
./rules/commands/backlog/backlog.command.sh list
./rules/commands/backlog/backlog.command.sh pick --backlog add-backlog-dropdown-in-session-flow-story.md
./rules/commands/backlog/backlog.command.sh get --backlog add-backlog-dropdown-in-session-flow-story.md
./rules/commands/backlog/backlog.command.sh open --backlog add-backlog-dropdown-in-session-flow-story.md
./rules/commands/backlog/backlog.command.sh show
./rules/commands/backlog/backlog.command.sh delete
./rules/commands/backlog/backlog.command.sh sync --backlog rename-cottageinsights-repo-local-tmp-storage-to-data-firebase-story.md
```
