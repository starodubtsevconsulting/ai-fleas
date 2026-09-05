# dialog.command

## Tags

#command #ai-command #dialog

Detect and capture dialog moments during an AI session.

Use this when the user is not asking for direct execution (develop/test/design) but asks questions in the middle of work.
Primary heuristic: user input contains double question marks `??`.
Or if user says: "WTF, fucking, stupid, shit, bullshit" and similar insulting words.

When dialog is detected:

- answer the question(s)
- log each question and answer pair
- keep logging separate from source control
- when the dialog closes, append a documentation sync proposal linked to the feature doc
- when a session grows long (default threshold: 6 Q/A entries), emit guidance to shift to specification work or a GPT web session

## Log Output

- folder: `{project_location}/commands/dialog/log/[project-name]/[task-name]/`
- file: one markdown file per dialog session with `*-dialog.md` suffix
- format:
  - project
  - task
  - dialog session id
  - entries with `Q:`, `A:`, and `Role: #role <role>`
  - optional `Documentation Sync Proposal` block when finalized

Example structure:

```md
# Dialog Log

- Project: sample-project
- Task: mobile clipboard guard
- Session: 2026-02-07T06-10-12Z

## Dialog

1. Q: Why does mobile paste bypass ctrl+v?
   A: Mobile paste can come through context menu and input events instead of keyboard shortcuts.
   Role: #role architect

## Documentation Sync Proposal

- Triggered: 2026-02-07T15:55:00Z
- Target doc: docs/apps/locusesse/features/editor-clipboard-guard-feature.md
- Suggested update:
  - Add or refresh a short FAQ/decisions subsection using the Q/A entries from this dialog session.
  - Keep the feature doc aligned with the latest constraints, assumptions, and accepted tradeoffs.
```

## Usage

- Log one Q/A:

```bash
./commands/dialog/dialog.command.sh \
  --project "sample-project" \
  --project-path "../sample-project" \
  --task "clipboard policy" \
  --q "Will this work on mobile?" \
  --a "Yes, if enforced at event level." \
  --role "architect"
```

- Append to a known session:

```bash
./commands/dialog/dialog.command.sh \
  --project "sample-project" \
  --project-path "../sample-project" \
  --task "clipboard policy" \
  --session "2026-02-07T06-10-12Z" \
  --q "Should adapter own listeners?" \
  --a "Yes, adapter should own editor-specific listeners." \
  --role "dev"
```

- Finalize dialog and append documentation proposal:

```bash
./commands/dialog/dialog.command.sh \
  --project "sample-project" \
  --project-path "../sample-project" \
  --task "clipboard policy" \
  --session "2026-02-07T06-10-12Z" \
  --q "Wrap-up: should we sync docs?" \
  --a "Yes, sync the clipboard feature doc with this session decisions." \
  --role "architect" \
  --doc-path "docs/apps/locusesse/features/editor-clipboard-guard-feature.md" \
  --finalize
```

When `--project-path` is provided, logs are written to:
`{project-path}/.ai/dialog/log/[project]/[task]/*-dialog.md`

Without `--project-path`, legacy output remains:
`commands/dialog/log/[project]/[task]/*-dialog.md`

When `--role` is omitted, the command auto-detects role from Q/A text (`architect`, `dev`), otherwise it writes `#role unspecified`.

When `--finalize` is set, the command appends a `Documentation Sync Proposal` section to the same dialog log file. Use
`--doc-path` to bind that proposal to the feature doc that should be updated.

Long-session guidance:

- default threshold is 6 Q/A entries per session
- at or above threshold, the command emits a reminder to prefer spec updates over prolonged dialog
- the reminder is also recorded once in the log as `## Dialog Guidance`
- override threshold with env var: `DIALOG_GUIDANCE_THRESHOLD=<n>`

## Roles selection

- dev
- architect
- and others...

## Input

- `project`
- `task`
- question and answer pairs during session

## Output

- preferred: `{project-path}/.ai/dialog/log/[project-name]/[task-name]/*-dialog.md` (gitignored)
- legacy fallback: `{project_location}/commands/dialog/log/[project-name]/[task-name]/*-dialog.md` (gitignored)
