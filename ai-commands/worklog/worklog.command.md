# worklog.command

## Purpose

Use `worklog` to record and summarize traceable work activity, evidence, and outcomes for a selected scope.

## Inputs

| Input | Required | Source | Description |
|---|---|---|---|
| Active AI Profile and workflow | Yes | Host activation | Authorizes execution and resolves profile-owned configuration. |
| Detailed command inputs | As documented below | User, workflow, profile, or artifact | Command-specific values and preconditions. |

- `--title` (required)
- `--role` (optional, default placeholder)
- `--want` (optional, default placeholder)
- `--so-that` (optional, default placeholder)
- `--project` (optional, project path/id stored in the story; defaults to `AI_FLOW_PROJECT_DIR` or `ai`)
- `--profile` (optional, defaults to `WORK_PROFILE_ID` or `work`)
- `--slug` (optional, overrides filename slug)

## Outputs

| Output | Destination | Description |
|---|---|---|
| Detailed command outputs | Caller, configured artifact path, or authorized external system | Observable results, evidence, and effects documented below. |

- `session-root/<work-profile>/backlog/<slug>-story.md`

## Entry Point

| Entry point | Type | Profile-aware invocation |
|---|---|---|
| `worklog/worklog.command.sh` | Shell executable | Activate the selected profile and workflow, then invoke through the host's profile-aware command runner. |

Every invocation is profile-aware: the host must verify that the active workflow allows this command, resolve `AI_COMMANDS_ROOT`, and provide any profile-owned configuration before this entry point is used.

Committed configuration template: `worklog/worklog.command.example.config`. Copy it into the selected profile, set only supported command value overrides, reference the copied file through `commands[].config`, and let the host expose it as `AI_COMMAND_CONFIG_PATH`. The committed example is documentation and must never be used as operational configuration.

## Tags

#command #ai-command #worklog

Create backlog stories for future work sessions.

Use this when the user says: "backlog", "put it to the future", "save for later", or asks to track future work.
The command immediately creates a story file so it does not get lost.

Stories are stored in:

- `session-root/<work-profile>/backlog/<slug>-story.md`
- that backlog path is meant to be committed so stories can sync through git/GitHub while the rest of `<session-root>` stays local

## Usage

```bash
${AI_COMMANDS_ROOT}/worklog/worklog.command.sh \
  --title "New SQS contract" \
  --role "dev" \
  --want "emit one event per locale" \
  --so-that "localization-service processes per-locale entries" \
  --project "libs/nest-shared"
```

Explicit profile override:

```bash
${AI_COMMANDS_ROOT}/worklog/worklog.command.sh \
  --title "Refactor worklog" \
  --profile "example"
```

## Story Template

```
# <Title>

- Status: todo
- Created: <UTC timestamp>
- Profile: <work-profile>
- Workflow: <workflow>
- Project: <project-path-or-id>
- Project Name: <folder-name-from-project>
- Source: worklog

## Story

As a <role> I want <goal> so that <benefit>.

## Plan

- [ ] #design
- [ ] #coding
- [ ] #test
- [ ] #docs

## Impl Details

-

## Notes

-

## Acceptance Criteria

-
```
