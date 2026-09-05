## Tags

#command #ai-command #push #git

- `push` means **commit + push**, not only `git push`
- run `commands/push/push.command.sh --check --profile <profile-id> --workflow <workflow-id>` to validate Git
  work-profile selection without pushing
- `commands/push/push.command.test.sh` verifies macOS Bash syntax and exercises
  profile resolution through the non-pushing preflight
- before pushing, run the code style command for the project (see `commands/code-style/code-style.command.md`)
- if there are uncommitted changes:
  1. stage relevant files
  2. create commit message related to the current repository and its active task
  3. craft a concise subject that summarizes the work for the current task (include a ticket identifier only when one exists)
  4. add commit details on the next line in the commit body
  5. if the task or goal is unclear, ask the user before committing
  6. create commit
  7. push to remote branch
- if there are no local changes, run push only
- never include unrelated files unless user asked to include everything
- before pushing changes covered by a `public-mirror` entry in the root `ai-publication.yml` registry,
  verify the commit records `PUBLIC_SYNC_UPDATED`,
  `PUBLIC_SYNC_NOT_APPLICABLE`, or `PUBLIC_SYNC_DEFERRED: <reason>`; block when
  the publication impact was not considered
- `PUBLIC_SYNC_UPDATED` requires evidence that the public branch or pull request
  contains the sanitized corresponding change and passed its public validation
- push execution fallback:
  - run `git push` first
  - if push fails due to sandbox/network restrictions, immediately retry push with elevation approval flow
  - do not stop after the first failed attempt when retry can resolve it
  - keep user chatter minimal; report final push result after retry
- first push safety:
  - branch provenance uses the verified caller role, never Command Runner's executor identity or a model name
  - resolve the current branch directly from `HEAD`; detached HEAD and unsafe names fail closed
  - require a newly created branch to follow `<initiating-role>/<short-kebab-description>`; compare commit role metadata
    and switch provider credentials only when `agent_identities.enabled: true`
  - reject generic technology prefixes such as `codex/`, `pi/`, `hermes/`, or `ai/` for newly created branches
  - an existing legacy branch may be pushed only under exact authorization naming that branch and this push, with
    `Legacy-Branch-Provenance` recorded; the exception is single-effect and does not validate the prefix
  - an existing upstream uses ordinary `git push`
  - a branch without an upstream requires an exact `origin` remote and uses
    `git push --set-upstream origin <current-branch>`
  - never force-push, infer a different branch, or rewrite history
- always report:
  - commit sha (if created)
  - branch
  - push result
- every invocation requires the initialized `profileId` and `workflowId` coordinates; path matching verifies project
  ownership but never selects a profile
- verify exact identity, origin policy, and repository ownership against that bound profile (see `commands/git/git.command.md`)
- SDD gate is mandatory before push:
  - if context may be stale (session refresh/new commits/long pause), run `commands/sdd/sdd.command-resync.sh`
  - `push.command.sh` runs `commands/sdd/sdd.command-guard.sh --staged-only` and blocks push on spec/drift/resync-state
failures for publish-targeted changes
- if a push requires elevation, ask the user for approval and proceed immediately after approval.

## Profile Confirmation

- `commands/push/push.command.sh` enforces profile/workflow coordinates and profile checks before `git push`
- Config precedence:
  1. `commands/git/git.command.config` (local override, gitignored)
  2. `commands/git/git.command-default.config` (tracked defaults)
  3. `commands/git/git.command.example.config` (template; used to create user config when no defaults exist)
- Setting:
  - `PUSH_PROFILE_CONFIRM=on|off`
  - `on` prompts to switch profiles when the current email domain does not match the project work profile.

## Documentation

This command is self-documented. Use this file as the canonical reference.

## Roles selection

- dev

## Input

- branch
- current task context

## Output

- remote source control
