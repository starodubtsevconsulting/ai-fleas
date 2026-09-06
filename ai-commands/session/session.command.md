# session.command

## Purpose

Use `session` to create, resume, inspect, or close a bounded work session with durable context and status.

## Inputs

| Input | Required | Source | Description |
|---|---|---|---|
| Active AI Profile and workflow | Yes | Host activation | Authorizes the command and resolves profile-owned configuration. |
| Command-specific input | Yes | User, workflow, profile, or source artifact | Session operation, profile/workflow identity, and optional session metadata. |

## Outputs

| Output | Destination | Description |
|---|---|---|
| Command result | Caller, configured artifact path, or authorized external system | Created/opened/closed session state and canonical session path. |

#command #ai-command #session #work-session #session-flow #close-session #terminal #web #plan

Manage AI sessions (`create`, `open`, `close`, `list`).

## Entry Point

| Entry point | Type | Profile-aware invocation |
|---|---|---|
| `session/session.command.sh` | Shell executable | Activate the selected profile and workflow, then invoke through the host's profile-aware command runner. |

Every invocation is profile-aware: the host must verify that the active workflow allows this command, resolve `AI_COMMANDS_ROOT`, and provide any profile-owned configuration before this entry point is used.

Committed configuration template: `session/session.command.example.config`. Copy it into the selected profile, set only supported command value overrides, reference the copied file through `commands[].config`, and let the host expose it as `AI_COMMAND_CONFIG_PATH`. The committed example is documentation and must never be used as operational configuration.

## Tags



## Intent Aliases

- Treat these as synonyms for the same AI work-session lifecycle intent:
  - `session`
  - `work session`
  - `session flow`

## Core Contract

- This command is the core of the workflow integration for an AI work session.
- Session context stands above day-to-day workflow execution and anchors how requests are interpreted while a session is active.
- In terminal mode, this command flow is the supported way to establish or switch session context.
- Agents should not probe legacy literal session-storage paths directly to infer whether a session exists or which plan
to use, unless they are explicitly debugging or repairing the session system itself.
- Reading the configured current-plan pointer is for an already-established active session, or for the `session`
command implementation itself; it is not the default discovery mechanism for arbitrary task execution.
- Command detection and command reporting are mandatory parts of this contract:
  - every user request must be interpreted through the current session/workflow context
  - every action in the request must be mapped to the best matching command before execution
  - the command match decision must be reported in the working response
  - this requirement remains in force for continuation work, follow-up asks, and in-progress tasks
- Do not treat command matching as optional just because the next step seems obvious; this command defines the heart of
the AI/session/workflow integration.

## Behavior

- Terminal mode only. In `web` mode, use web UI controls for session lifecycle.
- Supports actions:
  - `create`: create and activate a new session plan (requires task)
  - `open`: activate a session plan by setting the configured current-plan pointer under `<session-root>`
  - `close`: explicitly close the active session
  - `list`: list known sessions in compact two-line blocks:
    - `session: <session-id> <profile> <workflow> (<active|open|closed>)`
    - `task: <task>`
- Detect session type from `AI_SESSION_UI_MODE` or `<session-root>/.current-ui-mode` (`terminal` or `web`).
- `close` action:
  - resolve active plan via the configured current-plan pointer under `<session-root>`
  - check open checklist items under `## Progress` (`- [ ]`)
  - if open todos exist, ask whether to mark all of them as done before closing
  - verify repository is fully pushed before explicit close:
    - working tree must be clean (including untracked files)
    - no unpushed commits to upstream
  - persist explicit close marker in the plan under `## Session`:
    - `- Session closed: <UTC ISO timestamp> #docs`
    - legacy `Session stopped` markers are treated as closed for compatibility
  - clear active session pointer:
    - the configured current-plan pointer under `<session-root>` is emptied
  - best-effort reset Codex context by sending `/new` to the terminal agent pane (`ai-shell`) without killing tmux panels
- active plan documentation requirement:
  - keep `## Progress` checklist-only for plan panel rendering
  - also maintain a separate durable notes section in the active plan for restart-critical context discovered during work
  - record items such as repo paths, active branches/PRs, validated commands, verified data/report locations,
reconciliation facts, and other information that would otherwise need to be rediscovered next session
  - update that notes section whenever this context materially changes
- `create` action:
  - requires: `--task "<task name>"`
  - optional: `--todo "<first checklist item>"` (default: `Execute task: <task>`)
  - optional: `--scope "<task scope>"`, `--workflow "<workflow>"`, `--project "<project>"`, `--profile "<work-profile>"`
  - when `--profile` is omitted in interactive terminal mode, prompt user to select profile from `rules/*-work-profile.yml`
  - when `--workflow` is omitted in interactive terminal mode, prompt user to select from the selected profile's `workflows` list
  - creates and activates: `<session-root>/<work-profile>/<timestamp>/plan.md`
  - in `terminal` UI mode, once the plan is activated and not closed, right panel must display the plan immediately (not the sessions list)
- `open` action:
  - `--plan <path>` selects a specific plan (required by default)
  - `--latest` explicitly opts in to selecting the latest non-closed plan
  - if selected plan is closed (`Session closed` / `Session stopped`), close marker is removed and session is reopened
  - writes the selected plan to the configured current-plan pointer under `<session-root>`
  - in `terminal` UI mode, once the plan is activated and not closed, right panel must display the plan immediately (not the sessions list)

## Usage

```bash
${AI_COMMANDS_ROOT}/session/session.command.sh close
```

Optional:

```bash
${AI_COMMANDS_ROOT}/session/session.command.sh create --task "harden session flow" --todo "Define session bootstrap rules"
${AI_COMMANDS_ROOT}/session/session.command.sh open --plan <session-root>/example/<session>/plan.md
${AI_COMMANDS_ROOT}/session/session.command.sh open --latest
${AI_COMMANDS_ROOT}/session/session.command.sh list
${AI_COMMANDS_ROOT}/session/session.command.sh close --no-agent-close
```

## Notes

- If user declines marking open todos as done, the command aborts and keeps the session open.
- If git is not fully pushed/clean, the command does **not** write `Session closed`, but in terminal mode it still
clears the configured current-plan pointer under `<session-root>` and resets agent context so panels switch to "no
active session".
- In `web` mode no agent process close is attempted; only plan/session metadata is updated.

## Local selected-bundle state

Session commands resolve the selected config bundle by `AI_CONFIG_BUNDLE_ROOT`,
then compatible `APP_ROOT`, then repository topology. Local session state is
kept only under `<bundle>/.local/work-session-state/`: plans under `sessions/`,
the plan pointer at `.current-plan-path`, and UI mode at `.ui-mode`.
