#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="${AI_FLOW_PROJECT_DIR:-}"
PROJECT_LABEL=""
TASK_TEXT=""
SCOPE_TEXT=""
EXTRA_TEXT=""
QUOTE_TEXT=""
CONFIG_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
COMMANDS_ROOT="${AI_COMMANDS_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)}"
SESSION_ROOT="${AI_SESSIONS_ROOT:-${AI_AGENT_RUNTIME_SESSIONS_ROOT:-$CONFIG_ROOT/.local/work-session-state}}"
SESSION_UI_MODE_PATH="$SESSION_ROOT/.current-ui-mode"
SESSION_UI_MODE="${AI_SESSION_UI_MODE:-}"

resolve_project_metadata() {
  local registry="${AI_PROFILE_PROJECT_FILE:-}"
  local project_dir="$1"
  if [ ! -f "$registry" ]; then
    return 1
  fi
  command_python - "$registry" "$project_dir" <<'PY'
import sys
from pathlib import Path
registry, project_dir = sys.argv[1], sys.argv[2]
base = Path(project_dir).name
entries = []
entry = {}
for line in open(registry, 'r', encoding='utf-8'):
    if line.startswith(' ') or ':' not in line or line.lstrip().startswith('#'):
        continue
    key, value = line.strip().split(':', 1)
    entry[key.strip()] = value.strip().strip('"')
label = entry.get('label') or entry.get('id') or base
app = entry.get('app_name') or label
print(f"{label}|{app}")
PY
}

resolve_session_ui_mode() {
  local raw normalized
  raw="${SESSION_UI_MODE:-}"
  if [ -z "$raw" ] && [ -f "$SESSION_UI_MODE_PATH" ]; then
    raw="$(tr -d '\r' < "$SESSION_UI_MODE_PATH" | head -n1 | xargs)"
  fi
  normalized="$(printf '%s' "$raw" | tr '[:upper:]' '[:lower:]')"
  case "$normalized" in
    web)
      printf '%s\n' "web"
      ;;
    terminal|tmux)
      printf '%s\n' "terminal"
      ;;
    *)
      printf '%s\n' "unknown"
      ;;
  esac
}

usage() {
  cat <<'USAGE'
Usage: init-prompt.sh [--project-dir <path>] [--project-label <label>] [--task <text>] [--scope <text>] [--extra <text>] [--quote <text>]
USAGE
}

while [ $# -gt 0 ]; do
  case "$1" in
    --project-dir)
      PROJECT_DIR="${2:-}"
      shift 2
      ;;
    --project-label)
      PROJECT_LABEL="${2:-}"
      shift 2
      ;;
    --task)
      TASK_TEXT="${2:-}"
      shift 2
      ;;
    --scope)
      SCOPE_TEXT="${2:-}"
      shift 2
      ;;
    --extra)
      EXTRA_TEXT="${2:-}"
      shift 2
      ;;
    --quote)
      QUOTE_TEXT="${2:-}"
      shift 2
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    --)
      shift
      break
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

if [ -n "$PROJECT_DIR" ]; then
  if [ -d "$PROJECT_DIR" ]; then
    PROJECT_DIR="$(cd "$PROJECT_DIR" && pwd)"
  else
    echo "ERROR: Project directory not found: $PROJECT_DIR" >&2
    exit 2
  fi
fi

if [ -z "$PROJECT_DIR" ]; then
  echo "ERROR: Project directory is required (use --project-dir or AI_FLOW_PROJECT_DIR)." >&2
  exit 2
fi

if [ -z "$PROJECT_LABEL" ]; then
  meta="$(resolve_project_metadata "$PROJECT_DIR" || true)"
  if [ -n "$meta" ]; then
    IFS="|" read -r meta_label meta_name <<EOF_META
$meta
EOF_META
    PROJECT_LABEL="$meta_label"
  else
    PROJECT_LABEL="$(basename "$PROJECT_DIR")"
  fi
fi

SESSION_UI_MODE="$(resolve_session_ui_mode)"

printf '%s\n' "Read workflow.md from the ai repo (CODEX_CONFIG_HOME)."
printf 'Project already selected: %s (%s).\n' "$PROJECT_LABEL" "$PROJECT_DIR"
printf '%s\n' "Skip projects and project selection."
printf 'Session UI mode: %s.\n' "$SESSION_UI_MODE"
if [ -n "$TASK_TEXT" ]; then
  printf 'Session task: %s\n' "$TASK_TEXT"
fi
if [ -n "$SCOPE_TEXT" ]; then
  printf 'Session scope: %s\n' "$SCOPE_TEXT"
fi
printf 'MUST: treat every user input as a potential command; scan %s/* and follow the matched command .md instructions before proceeding.\n' "$COMMANDS_ROOT"
printf 'MUST: on startup, read %s/session/session.command.md and honor explicit close semantics (`Session closed`, legacy `Session stopped`) when deciding active/resumable session plans.\n' "$COMMANDS_ROOT"
cat <<'EOF_PROMPT'
Use the active session plan from the configured session root (`AI_SESSIONS_ROOT` or the session helper): resolve `<session-root>/.current-session-path`, then read `<session-dir>/session-plan.md` and AI_FLOW_OUTPUT_DIR for logs/outputs.

MUST: follow the selected workflow instructions before doing any work.
MUST: if the configured session root pointer (`<session-root>/.current-session-path`) is empty/invalid, do not auto-resume old sessions; explicitly create/select a session first before implementation.
MUST: when creating/selecting a fresh session for work, ensure task title exists and at least one todo checklist item is present; infer task title from user request when needed.
MUST: update the active session `session-plan.md` first for every new user request, and keep it current while working.
MUST: write plan items only under ## Progress using checklist format (- [ ] / - [x]) with at least one role tag (for example #design, #coding, #test, #docs).
MUST: if user explicitly fixed a task and asks something out-of-scope, ask whether to rename task or create/switch session before implementation.
MUST: before coding/testing/debugging, verify `session-plan.md` already reflects the current request and immediate next step.

Still follow the workflow order:
1) choose work profile first,
2) choose workflow from the selected profile second,
3) then continue with the rest (feature/Jira scope and optional docs),
4) verify any required local source-control auth for the selected workflow context and report the status if requested.
EOF_PROMPT

if [ -n "$EXTRA_TEXT" ]; then
  echo
  echo "$EXTRA_TEXT"
fi

if [ -n "$QUOTE_TEXT" ]; then
  echo
  echo "$QUOTE_TEXT"
else
  cat <<'EOF_QUOTE'

Star Wars quote: "Do. Or do not. There is no try." - Yoda
EOF_QUOTE
fi
