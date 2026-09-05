## Tags

#command #ai-command #commit #git

- configure defaults in `commands/commit/commit.command.conf` (see example template)
- see the active session plan at `<session-root>/<work-profile>/<session-id>/session-plan.md` for the current context
- use the active session plan at `<session-root>/<work-profile>/<session-id>/session-plan.md` to create the commit
comment, always link the `/documentation/*.md` file that is related to the feature we work on
- commit message must be related to:
  - the repository where commit is created
  - the active task for that repository
- commit subject format must be exactly:
  - `[ticket-number] : "title of the task"`
- commit body is required on the next line and must describe details of the commit
- follow the canonical workflow-role branch rule in [`git.command.md`](../git/git.command.md). Agent-role body metadata,
  provider accounts, and production receipts are required only when the active profile has `agent_identities.enabled: true`;
  while false, their absence must not block a commit
- an existing legacy branch is the sole mismatch exception and requires exact authorization for this commit plus
  `Legacy-Branch-Provenance: <branch>` in the body; it never authorizes creating another legacy branch
- derive `ticket-number` and task title from the active task context for the current repository
- if ticket or task title is unclear, ask user and do not commit
- forbidden style examples:
  - `test: add Java Maven JUnit fallback runner`
  - `[ticket-number]:title-without-body`
- valid example:
  - subject: `[CORESVCS-7834] : "Prefix LMS S3 object keys with lms"`
  - body: `Add tests covering lms-prefixed dictionary event path generation.\n\nInitiated-By-Role: coder\nExecuted-By-Role: command-runner`
- before commit make sure documentation is picked and in sync (based on git stats)
  see: [doc.command.md](../doc/doc.command.md)
- before committing any file covered by a `public-mirror` entry in the root
  `ai-publication.yml` registry, review the complete mapped diff against
  [`PUBLISHING.md`](../PUBLISHING.md) and record exactly one publication result:
  `PUBLIC_SYNC_UPDATED`, `PUBLIC_SYNC_NOT_APPLICABLE`, or
  `PUBLIC_SYNC_DEFERRED: <reason>`
- never treat an omitted public-sync result as `not applicable`
- run `../push/push.command.sh --check --profile <profile-id> --workflow <workflow-id>` before staging or committing;
it binds the repository path, exact Git identity,
  allowed origin URL, and host-scoped credentials to the active work profile
- never switch global Git identity as part of commit; a mismatch is blocking until repository-local identity is corrected
- SDD gate is mandatory before commit:
  - run `commands/sdd/sdd.command-resync.sh` when context may be stale (new commits, long pause, session refresh)
  - `commit.command.sh` runs `commands/sdd/sdd.command-guard.sh --staged-only` and blocks commit flow on drift/spec failures
- after commit, archive the active session plan:
  call the backend archive flow so `<session-root>/.current-session-path` is cleared; the timestamped session directory remains as history

## Roles selection

- dev

## Input

- branch
- `<session-root>/<work-profile>/<session-id>/session-plan.md`

## Output

- remote source control
