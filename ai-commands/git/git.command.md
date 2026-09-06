# git.command

## Purpose

Use `git` to perform bounded, authorized source-control operations with explicit repository scope and resulting-state evidence.

## Inputs

| Input | Required | Source | Description |
|---|---|---|---|
| Active AI Profile and workflow | Yes | Host activation | Authorizes execution and resolves profile-owned configuration. |
| Detailed command inputs | As documented below | User, workflow, profile, or artifact | Command-specific values and preconditions. |

- TBD

## Outputs

| Output | Destination | Description |
|---|---|---|
| Detailed command outputs | Caller, configured artifact path, or authorized external system | Observable results, evidence, and effects documented below. |

- TBD

## Entry Point

| Entry point | Type | Profile-aware invocation |
|---|---|---|
| `git/git.command.sh` | Shell executable | Activate the selected profile and workflow, then invoke through the host's profile-aware command runner. |

Every invocation is profile-aware: the host must verify that the active workflow allows this command, resolve `AI_COMMANDS_ROOT`, and provide any profile-owned configuration before this entry point is used.

Committed configuration template: `git/git.command.example.config`. Copy it into the selected profile, set only supported command value overrides, reference the copied file through `commands[].config`, and let the host expose it as `AI_COMMAND_CONFIG_PATH`. The committed example is documentation and must never be used as operational configuration.

## Tags

#command #ai-command #git #version-control

Use `push` as a dedicated command (see `ai-commands/push/push.command.md`).

Normal human workflow rule:

- prefer the user's normal checkout and visible branch state over git-clever alternatives
- do not create or move work into a separate `git worktree` unless the user explicitly asks for a worktree
- when preparing a feature branch from `main`, first switch to the repo's normal checkout, check out `main`, and run
`git pull --ff-only origin main`
- if the worktree is dirty, stop and ask before stashing, resetting, switching branches, or doing any other state-moving git action
- if there is any doubt about what the user expects from `git branch` or `git status`, choose the simplest normal
workflow and ask instead of improvising
- the goal is that the user can run `git branch` and `git status` in their normal checkout and immediately understand where the work is

## Workflow-role provenance

Every AI-initiated Git workstream must identify the exact authorized workflow caller that requested the Git effect. This
caller is the initiating role even when another role produced the files or Command Runner executes the command. Product/model names
such as `codex`, `pi`, `hermes`, or `ai` are execution technology and must not be used as the provenance identity.

- New branch names use `<initiating-role>/<short-kebab-description>`, for example
  `judge/human-prompt-interpretation-cases` or `coder/fix-session-start`.
- Use the lowercase canonical role slug from the initialized roster: `designer-reviewer`, `judge`, `manager`, `coder`,
  `command-runner`, `ui-acceptance-tester`, or `proxy-coder`. A directly human-created workstream uses `human`.
- The initiating role is the verified caller in the command packet, not the mechanical executor. If Designer/Reviewer asks
  Command Runner to create or push Coder-produced work, the prefix is `designer-reviewer/`; record Coder separately as
  `Produced-By-Role: coder` and Command Runner as `Executed-By-Role: command-runner`.
- Existing legacy branches are not renamed implicitly. They remain blocked by default, but may perform one bounded
  commit, push, or PR transition when the human gives exact authorization naming that legacy branch and effect. Record
  `Legacy-Branch-Provenance: <branch>` alongside the canonical initiating role. Authorization does not make the legacy
  prefix valid for a new branch. A rename, replacement branch, or PR recreation is a separate Git effect requiring its
  own explicit authorization.
- When the active profile enables agent identity enforcement, commit and pull-request bodies record
  `Initiated-By-Role`, optional `Produced-By-Role`, and `Executed-By-Role`. While disabled, these fields and agent-provider
  credentials are optional and their absence must not block commit, push, or PR.
- Reviews record `Reviewed-By-Role: <canonical-role>` and preserve the producing role separately. Review authorship never
  rewrites branch or commit provenance.
- Mutating Git invocations carry exact initialized `callerTaskId`, `callerRole`, and `returnTaskId`. The branch role must
  equal that trusted caller role; when enabled, `Initiated-By-Role` must also match. On-behalf-of prose cannot override it.
- While agent identities are disabled, only the new-branch prefix uses the caller role; commit and PR
  `Initiated-By-Role` metadata is not required. Enablement comes only from the trusted profile-referenced identity file.
- Missing or role-mismatched branch provenance blocks new branch creation. Commit/PR metadata and provider-account
  enforcement apply only when `agent_identities.enabled` is true. The exact legacy exception above remains available.

When user intent is `git clone` for a known project, always map it to the `git` command and resolve both the source and
destination from the committed projects registry under the selected profile project definition (`AI_PROFILE_PROJECT_FILE`).

- prefer the registry project id or label as `--project <project-id-or-label>`
- run `${AI_COMMANDS_ROOT}/git/git.command.sh clone --project <project-id-or-label>` to resolve and execute the clone
- default the clone destination to the registry entry's `path`; use `--dest` only when the user explicitly wants a
different checkout location
- if a registered project lacks `repo_url` or `path`, stop and ask to add or confirm it before cloning
- do not improvise a clone destination from the current working directory when a registry-backed project is known
  When user says `push`, interpret it as:

1. commit pending changes first
2. push the branch to remote

Make sure we are the proper Git identity and remote before committing/pushing:

- determine work profile from project path (`projects_root_path`, explicit `projects[].path` entries, and
`projects[].ref` registry files in `rules/*-work-profile.yml`)
- require an explicit profile binding for the provider-neutral `source-control` command whose `capability` and
  `registered_command` both resolve to `git`
- require repository-local/effective `user.name` and `user.email` to exactly match the resolved source-control command
  configuration's `identity_name` and `identity_email`; never repair a mismatch by changing global Git identity
- require `remote.origin.url` to match one of the resolved command configuration's `allowed_remote_url_patterns`
- credentials are selected by the verified remote host (`credential_scope: remote_host`) and remain in ignored/local Git
  credential configuration; never put a token or password in a work profile
- require exact `profileId`, `workflowId`, and project/repository coordinates from the trusted runtime binding or worker
  packet; never derive profile identity from the repository path alone
- run `../push/push.command.sh --check --profile <profile-id> --workflow <workflow-id>` before both commit and push; it
  fails closed before any mutation
- provider-neutral intent and policy remain owned by [`source-control`](../source-control/source-control.command.md); this
  command owns Git mechanics only
- operational overrides: selected profile configuration resolved as `AI_COMMAND_CONFIG_PATH`
- template shape: `ai-commands/git/git.command.example.config` (never populate in the command catalog)

- if identity is missing or wrong, configure it repository-locally only after confirming the active profile

if git is not installed: [install.sh](../install/git/install.sh)

## Roles selection

- dev
