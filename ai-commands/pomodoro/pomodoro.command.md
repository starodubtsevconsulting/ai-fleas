# pomodoro.command

## Tags

#command #ai-command #pomodoro

Read-only pomodoro status command.

## What It Does

- reads the current pomodoro state from the active session path `session-root/<work-profile>/<session>/pomodoro/pomodoro.state.json`
- returns `{}` when no state file exists

## Implementation Layout

- `commands/pomodoro/pomodoro.command.sh` outputs the state file

## Files It Reads

- `session-root/<work-profile>/<session>/pomodoro/pomodoro.state.json`
- no global fallback: when no active session pointer exists, there is no active pomodoro state file

## State Format

The active session `pomodoro.state.json` includes:

- `status: running|idle`
- `phase: pomodoro|break|none`
- `task: ...`
- `session: N`
- `leftMin: number`
- `totalMin: number`
- `startReason: session_start|manual_start|user_activity_resume`
- `lastEvent: break_end|pomodoro_end|stopped|start|tick|idle`
- `lastEventAt: <epoch seconds>`
- `phaseStartAt: <epoch seconds or blank>`
- `phaseDurationMin: <minutes or blank>`

## Command Behavior

- read-only: `--status` outputs the active session pomodoro state file
- all other flags are rejected

## Natural Language Mapping (Status)

If the user asks about pomodoro status, interpret it as running:

- `./commands/pomodoro/pomodoro.command.sh --status`

Example user requests that should map to `pomodoro --status`:

- "pomodoro status"
- "status of pomodoro"
- "what's the pomodoro status?"
- "how much time is left?"
- "how much time left in the pomodoro?"
- "pomodoro time left"
- "are we in break or pomodoro?"
- "is pomodoro running?"

## Session Presets (Optional)

Pomodoro defaults to built-in durations unless a session preset file is provided.
The runtime reads `session-root/pomodoro.session.config` when present.

**Location:** `session-root/pomodoro.session.config` (gitignored)
