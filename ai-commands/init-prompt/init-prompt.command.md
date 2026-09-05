# init-prompt.command

## Tags

#command #ai-command #init-prompt

Generate a startup prompt string for `start.sh` / `_electron-agent-launcher.sh` once the target project is known
(project context + initial instructions).

Usage:

- `INIT_PROJECT_INSTRUCTION="$(./commands/init-prompt/init-prompt.sh --project-dir <path> --project-label <label>)"
./_electron-agent-launcher.sh`
- `INIT_PROJECT_INSTRUCTION="$(./commands/init-prompt/init-prompt.sh --project-dir <path> --extra "Use short answers."
--quote "Quote: Stay hungry.")" ./_electron-agent-launcher.sh`
- If `--project-dir` is omitted, uses `AI_FLOW_PROJECT_DIR` when set.
- If `--project-label` is omitted, resolves from `commands/projects/projects-registry.yml` (fallback to project dir basename).
- `--extra` accepts free-text instructions appended to the prompt.
- `--quote` overrides the default Star Wars quote with custom text.

Notes:

- This command prints the prompt to stdout (no side effects).
- Intended for `INIT_PROJECT_INSTRUCTION` or `--startup-prompt`.
- The prompt can come from the project entry point (`./ai`) or be generated after project selection in the `ai` flow; see `workflow.md`.
- The default startup prompt includes explicit `MUST` instructions for:
  - workflow-first execution,
  - command matching from `rules/commands/*`,
  - updating `<session-root>/<work-profile>/<session-id>/session-plan.md` first for every request,
  - checklist-only progress under `## Progress` with role tags.

- The default prompt includes a Star Wars quote.

## Roles selection

- dev

## Input

- TBD

## Output

- TBD
