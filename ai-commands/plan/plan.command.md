# plan.command

## Purpose

Use `plan` to turn a defined outcome into an ordered, verifiable implementation or execution plan.

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

- `<session-root>/<work-profile>/<session-id>/session-plan.md`

## Entry Point

| Entry point | Type | Profile-aware invocation |
|---|---|---|
| `plan/plan.command.md` | AI-readable contract | The initialized workflow role loads this contract after the host activates the selected profile and workflow. |

Every invocation is profile-aware: the host must verify that the active workflow allows this command, resolve `AI_COMMANDS_ROOT`, and provide any profile-owned configuration before this entry point is used.

Committed configuration template: `plan/plan.command.example.config`. Copy it into the selected profile, set only supported command value overrides, reference the copied file through `commands[].config`, and let the host expose it as `AI_COMMAND_CONFIG_PATH`. The committed example is documentation and must never be used as operational configuration.

## Tags

#command #ai-command #plan #planning #checklist #workflow

## FAQ

### Why keep a session plan when a ticket tracker already exists?

The configured ticket tracker remains the durable record for each work item: scope, lifecycle, ownership, and
tracker-facing evidence. The session plan records execution context that may span several work items: order and
relationships, decisions and gotchas, blockers, completed local evidence, and the exact next resume step. It never
replaces tracker meaning and lets a freshly initialized roster recover the workstream after interruption.

### Is `plan` a separate source of product authority?

No. It maintains local session state only. It grants no tracker, source, configuration, command, Git, deployment, or
publication authority. Designer/Reviewer owns plan meaning; Manager reads it only to identify tracker-plan drift.

- create/update the active session plan at `<session-root>/<work-profile>/<session-id>/session-plan.md`
- the active session `session-plan.md` keeps the check-boxes for the given task
- the active session `session-plan.md` is parsed by the Web UI Plan panel, so checklist formatting is mandatory
- use a `## Session` section for session metadata and a `## Progress` section for checklist progress
- all progress items must use checklist syntax exactly: `- [ ] ...` or `- [x] ...`
- every progress checklist item must include at least one role tag such as `#design`, `#coding`, `#test`, or `#docs`
- do not store progress as free-form notes if you expect the Plan panel to render it
- update the active session `session-plan.md` before implementation starts, then keep it current while working
- record material discoveries, evidence, rationale, and open questions in `session.md`; promote execution-changing risks
  to `## Gotchas and Recovery` in `session-plan.md` with why they matter and the exact recovery action
- only archive the plan when the user explicitly asks; do not archive on every plan update
- when ending a session, check whether the plan is complete; if complete, archive it
- if all checklist items under `## Progress` are `- [x]`, explicitly propose: stop current session and start a new session for the next task
- the active session `session-plan.md` is not to be committed (it is in gitignore)
- the active session `session-plan.md` is to be used for other commands like pr, commit, and others that need current
context of the work in progress
- when starting new work, you may seed the active session `session-plan.md` from a story in `<session-root>/<work-profile>/backlog/`
- configure command matching strictness in the selected profile through `AI_COMMAND_CONFIG_PATH`
- when asked to archive the plan, run `archive-plan.sh` (calls backend `/api/plan/clear`)

## Documentation

Plan archiving keeps a snapshot of completed work.

Archive procedure:

- Use `archive-plan.sh` to call the backend plan archive endpoint.
- Backend keeps each session plan in its own timestamped directory under `<session-root>/<work-profile>/<session-id>/session-plan.md`.
- Archiving ends the current session by removing the active `plan.md` and clearing the current-plan pointer; prior
timestamped session directories are the retained history.
- The session plan files are not committed.

## Roles selection

- planner
