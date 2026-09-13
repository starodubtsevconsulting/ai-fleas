# pr.command

## Purpose

Use `pr` to create an authorized pull request from validated branch state with traceable title, body, and source evidence.

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
| `pr/pr.command.md` | AI-readable contract | The initialized workflow role loads this contract after the host activates the selected profile and workflow. |

Every invocation is profile-aware: the host must verify that the active workflow allows this command, resolve `AI_COMMANDS_ROOT`, and provide any profile-owned configuration before this entry point is used.

Committed configuration template: `pr/pr.command.example.config`. Copy it into the selected profile, set only supported command value overrides, reference the copied file through `commands[].config`, and let the host expose it as `AI_COMMAND_CONFIG_PATH`. The committed example is documentation and must never be used as operational configuration.

## Roles

- `planner`

Use when opening a pull request.

## Config

- profile-owned overrides resolved through `AI_COMMAND_CONFIG_PATH`
  - `REVIEWERS`: comma-separated reviewer usernames
  - `BASE_BRANCH`: default base branch. For Bitbucket Data Center repos, use `master` unless the repo explicitly uses
another default branch.
  - `OPEN_PR_IN_BROWSER`: when true, automatically open created PR URL in local browser (default: true)
  - `BITBUCKET_BASE_URL`: Bitbucket Server base URL for Bitbucket remotes.
  - `BITBUCKET_USERNAME` / `BITBUCKET_TOKEN`: Bitbucket credentials for REST PR creation; falls back to Git credential store when possible.
  - `BITBUCKET_REVIEWERS`: comma-separated Bitbucket reviewer usernames; defaults to `REVIEWERS` when unset.
- See `ai-commands/pr/pr.command.example.config` for the committed template.
- Automation script: `ai-commands/pr/pr.command-script.sh`
- Push helper: `ai-commands/pr/push.command-script.sh`
  - Uses `gh pr create` for standard GitHub remotes and an optional alternate SCM REST path only when explicitly configured.
  - Passes through common CLI args (`--title`, `--body-file`, `--base`, `--head`, `--reviewer`).
  - If CLI args do not include reviewer options, it applies `REVIEWERS` from config.
  - If CLI args do not include base options, it applies `BASE_BRANCH` from config. For Bitbucket Data Center remotes,
if `BASE_BRANCH` is empty, the script defaults to `master`.
  - After PR creation, it auto-opens the PR URL via `ai-commands/browser/browser.command.sh` when `OPEN_PR_IN_BROWSER=true`.
  - Explicit CLI args always win over config defaults.

## Default PR Explanation

- When `agent_identities.enabled: true`, every PR body records `Initiated-By-Role: <canonical-role>` and, when different,
  `Executed-By-Role: <canonical-role>`, matching the branch and commit provenance required by
  [`git.command.md`](../git/git.command.md).
- Use `ai-commands/pr/pr-body.template.md` as the default structure when drafting PR bodies.
- Every PR body should explain enough context for a reviewer who did not follow the chat/session:
  - `Summary`: concise outcome bullets.
  - `Why`: the problem/user need/operational gap.
  - `What Changed`: concrete code, docs, command, or workflow changes.
  - `How To Use / Review`: user-facing behavior and the important files/sections to inspect.
  - `Validation`: exact checks that were run, including manual/browser validation when relevant.
  - `Follow-ups / Caveats`: optional, but call out known TODOs, skipped checks, or non-applicability.
- For workflow/tooling PRs such as `ai-profile`, explicitly mention command intent mapping and the human/operator
behavior the command changes.
- For prod-support or deployment-readiness PRs, explicitly mention deploy-risk-report links/checks and any `Report: TODO` caveat behavior.
- Avoid bodies that only list files. File walkthroughs are useful, but they do not replace the human explanation of why
the change exists and how it should be used.
- When an active session plan exists, use it as the authoritative work summary:
  - include completed checklist items from `## Progress`;
  - call out unfinished checklist items under `Remaining`;
  - keep the summary concise and actionable; and
  - include the exact validation commands and outcomes that are evidenced by the session.

## Notes

- For updates to an existing PR body, use `ai-commands/pr/pr-update.command.md` and `ai-commands/pr/pr-update.sh`.
- If `REVIEWERS` is empty, ask the user for the reviewer list and update the selected profile locally.
- For the PR summary, prefer the active session context from `session-root/.current-session-path` + the authoritative
`session.json`; otherwise summarize commits on the current branch.
- Before pushing and opening the PR, run `/code-style` (e.g., `mvn spotless:apply` for Java) and commit any formatter changes it produces.
- Before any `git push` (including "push" and "pr this" shortcuts), read the active
`session-root/<profile>/<session-id>/session-plan.md`, sync completed checkboxes for all finished milestones, then
proceed.
- If no active session plan exists, stop and ask the user whether to continue without session tracking.
- If a PR already exists, push commits to the branch immediately after committing, open the PR in the browser when
useful, then update the PR body as needed.
- If the user says "push", interpret that as commit + push + create/open PR for the correct branch (do not ask again),
unless they explicitly say "push only", "do not create PR", or an open PR already exists.
- If the user says "pr this", interpret that as commit + push + PR (do not ask again).
- If `ai-profile` is improved while working on a different target project, keep those changes separate from the product repo branch.
  - Default branch for ongoing `ai-profile` improvements is `improving`, unless the user explicitly chooses a different
`ai-profile` branch for that workstream.
  - Commit and push `ai-profile` changes separately from the target project repo changes.
  - Treat that `ai-profile` work as background improvement work; do not assume it requires switching the active
session/task unless the user explicitly asks for a separate `ai-profile` session.
- When related `ai-profile` improvements exist, cross-link them from the target project PR body in a clearly separate section.
  - Preferred headings: `## Other` or `## AI Profile Improvements`
  - Include commit links and, if available, PR links.
  - Keep the wording explicit that these are separate workflow/tooling improvements, not part of the product code diff under review.
- Do not force unrelated `ai-profile` changes into the main PR summary; keep the product change summary focused on the target repo work.

## Mandatory PR Execution Rules

- When agent identity enforcement is enabled, reject a new PR when its head branch, commits, and body disagree about
the initiating workflow role. An existing legacy
  head is allowed only by exact authorization naming that branch and PR creation, with `Legacy-Branch-Provenance` recorded.
- When user intent is to create/open a PR (for example: `create pr`, `open pr`, `pr this`) or to push completed branch
work, the agent must execute commit + push + PR in the same turn unless the user explicitly says push-only, an open PR
already exists, or the flow is blocked by permissions/auth.
- PR creation must use `ai-commands/pr/pr.command-script.sh`; do not call `gh pr create` or Bitbucket REST directly when this command exists.
- PR body content must be passed via `--body-file` to avoid shell interpolation/escaping issues.
- Do not pass PR body using `--body`/`-b`.
- Validation sections must be plain-language summaries; do not paste raw terminal output with ANSI escape characters.
- Immediately after PR create/update, verify reviewers via `gh pr view <PR> --json reviewRequests`.
- If reviewers are missing, add reviewers from the selected profile and re-verify before reporting completion.
- Do not report PR done until URL is created and reviewer verification passes.

## Bitbucket Server Notes

The PR command can support alternate repository-host integrations when configured, but the default committed path
assumes standard GitHub remotes.

Use `--head` when the source branch differs from the currently checked-out branch. Use `--base` for the target branch.
For Bitbucket Data Center repos in this workspace, the normal default target is `master`; use an explicit feature
branch only when intentionally opening a PR into another in-flight branch.

## Push Helper

`ai-commands/pr/push.command-script.sh` requires a clean worktree, fetches the resolved remote default base, rebases the
current feature branch onto that base, and only then pushes. Base refresh failure, a dirty worktree, or rebase conflict is
blocking; a failed rebase is aborted to preserve the pre-rebase branch. For Bitbucket Server HTTPS remotes it can use
`BITBUCKET_USERNAME` and `BITBUCKET_TOKEN` through `GIT_ASKPASS`, so the token is not printed in command logs.

Example:

```bash
${AI_COMMANDS_ROOT}/pr/push.command-script.sh --project-dir /path/to/repo --branch my-branch
```
