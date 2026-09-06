#!/usr/bin/env bash
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/../_runtime/profile" && pwd -P)/command-profile.guard.sh"
ai_command_require_profile "session" || exit $?
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
RUNTIME_PATHS_SH="$SCRIPT_DIR/../runtime-paths.sh"
# shellcheck source=../runtime-paths.sh
source "$RUNTIME_PATHS_SH"
RULES_ROOT="$(ai_rules_root "$ROOT_DIR")"
SESSIONS_ROOT="$(ai_sessions_root "$ROOT_DIR")"
CURRENT_PLAN_POINTER="$(ai_current_plan_pointer_path "$ROOT_DIR")"
CURRENT_UI_MODE_PATH="$(ai_current_ui_mode_path "$ROOT_DIR")"
TERMINAL_SESSION_NAME="${AI_TERMINAL_SESSION_NAME:-ai-shell}"
REFLOW_LAYOUT="$ROOT_DIR/ai-terminal/reflow-layout.sh"
SESSION_INFO_PANEL_SCRIPT="$ROOT_DIR/ai-terminal/ui/session-info-panel.sh"
RIGHT_PANEL_SCRIPT="$ROOT_DIR/ai-terminal/ui/sessions-list-panel.sh"
CLOSED_AT_UTC=""
NO_AGENT_CLOSE="false"
ACTION="close"
OPEN_PLAN_PATH=""
OPEN_USE_LATEST="false"
CREATE_TASK=""
CREATE_TODO=""
CREATE_SCOPE=""
CREATE_WORKFLOW=""
CREATE_PROJECT="ai"
CREATE_PROFILE=""

usage() {
  cat <<'USAGE'
Usage:
  session.command.sh [open|close|list|create] [options]

Behavior:
  - Terminal mode only (web mode should use web UI controls)
  - Supports:
    - open: set active session plan pointer
    - close: explicitly close active session (default)
    - list: show available sessions and status
    - create: create and activate a new session plan
  - close:
    - checks active plan todos under ## Progress
    - if todos exist, asks whether to mark all as done
    - verifies git state is fully pushed before explicit close
    - writes "Session closed:" attribute under ## Session
    - clears active plan pointer (session-root/.current-plan-path)
    - best-effort sends '/new' to terminal agent pane (no tmux kill)
  - open:
    - requires explicit --plan <path> by default
    - optional --latest auto-selects latest non-closed plan
    - if selected plan is closed, removes close marker and reopens it
  - create:
    - requires --task "<task name>"
    - optional --todo "<first checklist item>" (default: "Execute task: <task>")
    - optional --scope "<task scope>", --workflow "<workflow>", --project "<project>", --profile "<work-profile>"
    - writes and activates: session-root/<work-profile>/<timestamp>/plan.md
USAGE
}

if [ $# -gt 0 ]; then
  case "$1" in
    open|close|list|create)
      ACTION="$1"
      shift
      ;;
  esac
fi

while [ $# -gt 0 ]; do
  case "$1" in
    --plan)
      OPEN_PLAN_PATH="${2:-}"
      shift 2
      ;;
    --latest)
      OPEN_USE_LATEST="true"
      shift
      ;;
    --task)
      CREATE_TASK="${2:-}"
      shift 2
      ;;
    --todo)
      CREATE_TODO="${2:-}"
      shift 2
      ;;
    --scope)
      CREATE_SCOPE="${2:-}"
      shift 2
      ;;
    --workflow)
      CREATE_WORKFLOW="${2:-}"
      shift 2
      ;;
    --project)
      CREATE_PROJECT="${2:-}"
      shift 2
      ;;
    --profile)
      CREATE_PROFILE="${2:-}"
      shift 2
      ;;
    --no-agent-close)
      NO_AGENT_CLOSE="true"
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

is_plan_closed() {
  local plan_path="$1"
  awk '
    /^##[[:space:]]+Session[[:space:]]*$/ { in_session=1; next }
    in_session && /^##[[:space:]]+/ { exit }
    in_session && /^-[[:space:]]*Session (closed|stopped):[[:space:]]*/ { found=1; exit }
    END { exit found ? 0 : 1 }
  ' "$plan_path"
}

resolve_ui_mode() {
  local raw normalized
  raw="${AI_SESSION_UI_MODE:-}"
  if [ -z "$raw" ] && [ -f "$CURRENT_UI_MODE_PATH" ]; then
    raw="$(tr -d '\r' < "$CURRENT_UI_MODE_PATH" | head -n1 | xargs)"
  fi
  normalized="$(printf '%s' "$raw" | tr '[:upper:]' '[:lower:]')"
  case "$normalized" in
    terminal|tmux)
      printf 'terminal\n'
      ;;
    web)
      printf 'web\n'
      ;;
    *)
      printf 'unknown\n'
      ;;
  esac
}

resolve_plan_path() {
  local path
  if [ ! -f "$CURRENT_PLAN_POINTER" ]; then
    return 1
  fi
  path="$(tr -d '\r' < "$CURRENT_PLAN_POINTER" | head -n1 | xargs)"
  if [ -z "$path" ] || [ ! -f "$path" ]; then
    return 1
  fi
  printf '%s\n' "$path"
}

resolve_latest_open_plan() {
  local candidate
  while IFS= read -r candidate; do
    [ -n "$candidate" ] || continue
    if ! is_plan_closed "$candidate"; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done < <(find "$SESSIONS_ROOT" -type f -name plan.md 2>/dev/null | sort -r)
  return 1
}

trim_value() {
  printf '%s' "$1" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//'
}

resolve_work_profile_id() {
  local env_profile active_plan profile first_dir
  env_profile="$(trim_value "${CREATE_PROFILE:-${WORK_PROFILE_ID:-${AI_WORK_PROFILE_ID:-}}}")"
  if [ -n "$env_profile" ]; then
    printf '%s\n' "$env_profile"
    return 0
  fi

  active_plan="$(resolve_plan_path || true)"
  if [ -n "$active_plan" ]; then
    profile="$(basename "$(dirname "$(dirname "$active_plan")")")"
    profile="$(trim_value "$profile")"
    if [ -n "$profile" ]; then
      printf '%s\n' "$profile"
      return 0
    fi
  fi

  first_dir="$(
    find "$SESSIONS_ROOT" -mindepth 1 -maxdepth 1 -type d 2>/dev/null \
      | sed "s|$SESSIONS_ROOT/||" \
      | sort \
      | head -n1
  )"
  if [ -n "$first_dir" ]; then
    printf '%s\n' "$first_dir"
    return 0
  fi

  printf 'example\n'
}

normalize_workflow_id() {
  local value
  value="$(trim_value "$1")"
  value="${value##*/}"
  value="${value%.workflow.md}"
  value="${value%.md}"
  printf '%s\n' "$value"
}

resolve_profile_file() {
  local profile
  profile="$(trim_value "$1")"
  if [ -z "$profile" ]; then
    return 1
  fi
  printf '%s\n' "$(ai_profile_file_path "$ROOT_DIR" "$profile")"
}

read_profile_workflows() {
  local profile profile_file
  profile="$(trim_value "$1")"
  profile_file="$(resolve_profile_file "$profile" || true)"
  if [ -z "$profile_file" ] || [ ! -f "$profile_file" ]; then
    return 1
  fi

  awk '
    /^workflows:[[:space:]]*$/ { in_list=1; next }
    in_list && /^[[:space:]]*-[[:space:]]*/ {
      sub(/^[[:space:]]*-[[:space:]]*/, "", $0)
      gsub(/^[[:space:]]+|[[:space:]]+$/, "", $0)
      if ($0 != "") {
        print $0
      }
      next
    }
    in_list && /^[^[:space:]-]/ { exit }
  ' "$profile_file" | while IFS= read -r wf; do
    normalize_workflow_id "$wf"
  done | awk 'NF > 0 && !seen[$0]++ { print $0 }'
}

prompt_select_profile() {
  local profiles_raw count idx answer
  profiles_raw="$(
    find "$RULES_ROOT" -maxdepth 1 -type f -name '*-work-profile.yml' 2>/dev/null \
      | sed 's|.*/||' \
      | sed 's|-work-profile\.yml$||' \
      | sort
  )"

  count="$(printf '%s\n' "$profiles_raw" | awk 'NF { c++ } END { print c + 0 }')"
  if [ "$count" -eq 0 ]; then
    resolve_work_profile_id
    return 0
  fi

  if [ "$count" -eq 1 ]; then
    printf '%s\n' "$profiles_raw" | awk 'NF { print; exit }'
    return 0
  fi

  echo "Select work profile:" >&2
  idx=1
  while IFS= read -r profile; do
    [ -n "$profile" ] || continue
    printf '  %s) %s\n' "$idx" "$profile" >&2
    idx=$((idx + 1))
  done <<< "$profiles_raw"

  while true; do
    read -r -p "Profile [1-$count]: " answer || true
    answer="$(trim_value "${answer:-}")"
    if [ -n "$answer" ] && [ "$answer" -ge 1 ] 2>/dev/null && [ "$answer" -le "$count" ] 2>/dev/null; then
      printf '%s\n' "$profiles_raw" | awk -v target="$answer" 'NF { i++; if (i == target) { print; exit } }'
      return 0
    fi
    echo "Invalid selection. Enter a number between 1 and $count." >&2
  done
}

prompt_select_workflow() {
  local profile workflows_raw count idx answer
  profile="$(trim_value "$1")"
  workflows_raw="$(read_profile_workflows "$profile" || true)"
  count="$(printf '%s\n' "$workflows_raw" | awk 'NF { c++ } END { print c + 0 }')"

  if [ "$count" -eq 0 ]; then
    printf 'dev\n'
    return 0
  fi

  if [ "$count" -eq 1 ]; then
    printf '%s\n' "$workflows_raw" | awk 'NF { print; exit }'
    return 0
  fi

  echo "Select workflow for profile '$profile':" >&2
  idx=1
  while IFS= read -r workflow; do
    [ -n "$workflow" ] || continue
    printf '  %s) %s\n' "$idx" "$workflow" >&2
    idx=$((idx + 1))
  done <<< "$workflows_raw"

  while true; do
    read -r -p "Workflow [1-$count]: " answer || true
    answer="$(trim_value "${answer:-}")"
    if [ -n "$answer" ] && [ "$answer" -ge 1 ] 2>/dev/null && [ "$answer" -le "$count" ] 2>/dev/null; then
      printf '%s\n' "$workflows_raw" | awk -v target="$answer" 'NF { i++; if (i == target) { print; exit } }'
      return 0
    fi
    echo "Invalid selection. Enter a number between 1 and $count." >&2
  done
}

session_meta_field() {
  local plan_path="$1"
  local field="$2"
  awk -v wanted="$field" '
    function trim(value) {
      gsub(/^[[:space:]]+|[[:space:]]+$/, "", value)
      return value
    }
    BEGIN {
      wanted_l=tolower(wanted)
    }
    /^##[[:space:]]+Session[[:space:]]*$/ { in_session=1; next }
    in_session && /^##[[:space:]]+/ { exit }
    in_session {
      line=$0
      sub(/^-+[[:space:]]*/, "", line)
      split_idx=index(line, ":")
      if (split_idx <= 0) {
        next
      }
      key=trim(substr(line, 1, split_idx - 1))
      value=trim(substr(line, split_idx + 1))
      sub(/[[:space:]]+#[-_[:alnum:]]+([[:space:]]+#[-_[:alnum:]]+)*[[:space:]]*$/, "", value)
      if (tolower(key) == wanted_l) {
        print value
        exit
      }
    }
  ' "$plan_path"
}

list_sessions() {
  local active_pointer candidate status profile session_id workflow task
  active_pointer=''
  if [ -f "$CURRENT_PLAN_POINTER" ]; then
    active_pointer="$(tr -d '\r' < "$CURRENT_PLAN_POINTER" | head -n1 | xargs)"
  fi

  echo "Session list:"
  while IFS= read -r candidate; do
    [ -n "$candidate" ] || continue
    status='open'
    if is_plan_closed "$candidate"; then
      status='closed'
    fi
    if [ "$candidate" = "$active_pointer" ] && [ "$status" != "closed" ]; then
      status='active'
    fi

    profile="$(basename "$(dirname "$(dirname "$candidate")")")"
    session_id="$(basename "$(dirname "$candidate")")"
    workflow="$(session_meta_field "$candidate" "Selected" | xargs)"
    if [ -z "$workflow" ]; then
      workflow="$(session_meta_field "$candidate" "Workflow" | xargs)"
    fi
    if [ -z "$workflow" ]; then
      workflow="n/a"
    fi
    task="$(session_meta_field "$candidate" "Task" | xargs)"
    if [ -z "$task" ]; then
      task="n/a"
    fi

    printf 'session: %s %s %s (%s)\n' "$session_id" "$profile" "$workflow" "$status"
    printf 'task: %s\n' "$task"
  done < <(find "$SESSIONS_ROOT" -type f -name plan.md 2>/dev/null | sort -r)
}

create_session() {
  local task todo scope workflow workflow_input workflows_for_profile project profile explicit_profile session_id started_at plan_dir plan_path current_active

  task="$(trim_value "$CREATE_TASK")"
  if [ -z "$task" ]; then
    echo "Cannot create session: --task is required." >&2
    exit 2
  fi

  todo="$(trim_value "$CREATE_TODO")"
  if [ -z "$todo" ]; then
    todo="Execute task: $task"
  fi

  scope="$(trim_value "$CREATE_SCOPE")"
  if [ -z "$scope" ]; then
    scope="$todo"
  fi

  project="$(trim_value "$CREATE_PROJECT")"
  if [ -z "$project" ]; then
    project="ai"
  fi

  explicit_profile="$(trim_value "$CREATE_PROFILE")"
  if [ -n "$explicit_profile" ]; then
    profile="$explicit_profile"
  elif [ -t 0 ]; then
    profile="$(prompt_select_profile)"
  else
    profile="$(resolve_work_profile_id)"
  fi

  workflow_input="$(trim_value "$CREATE_WORKFLOW")"
  if [ -n "$workflow_input" ]; then
    workflow="$(normalize_workflow_id "$workflow_input")"
  elif [ -t 0 ]; then
    workflow="$(prompt_select_workflow "$profile")"
  else
    workflows_for_profile="$(read_profile_workflows "$profile" || true)"
    workflow="$(printf '%s\n' "$workflows_for_profile" | awk 'NF { print; exit }')"
    if [ -z "$workflow" ]; then
      workflow="dev"
    fi
  fi
  session_id="$(date '+%Y-%m-%d_%H-%M-%S')"
  started_at="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  plan_dir="$SESSIONS_ROOT/$profile/$session_id"
  plan_path="$plan_dir/plan.md"

  current_active="$(resolve_plan_path || true)"

  mkdir -p "$plan_dir"
  mkdir -p "$(dirname "$CURRENT_PLAN_POINTER")"

  cat > "$plan_path" <<EOF
# Session Plan

## Session
- started_at: $started_at #docs
### Project & Task
Project: $project
Task: $task
Task Scope: $scope
### Workflow
Selected: $workflow

## Progress
- [ ] $todo #coding
EOF

  printf '%s\n' "$plan_path" > "$CURRENT_PLAN_POINTER"
  echo "Session created: $plan_path"
  if [ -n "$current_active" ] && [ "$current_active" != "$plan_path" ]; then
    echo "Switched active session from: $current_active"
  fi
  echo "Active plan pointer set: $CURRENT_PLAN_POINTER"
  refresh_terminal_panels
}

remove_closed_attribute() {
  local plan_path="$1"
  local tmp_file
  tmp_file="$(mktemp)"
  awk '
    /^##[[:space:]]+Session[[:space:]]*$/ { in_session=1; print; next }
    in_session && /^##[[:space:]]+/ { in_session=0; print; next }
    in_session && /^-[[:space:]]*Session (closed|stopped):[[:space:]]*/ { next }
    { print }
  ' "$plan_path" > "$tmp_file"
  mv "$tmp_file" "$plan_path"
}

open_session() {
  local plan_path

  if [ -n "$OPEN_PLAN_PATH" ]; then
    if [ ! -f "$OPEN_PLAN_PATH" ]; then
      echo "Cannot open session: plan not found: $OPEN_PLAN_PATH" >&2
      exit 2
    fi
    plan_path="$OPEN_PLAN_PATH"
  elif [ "$OPEN_USE_LATEST" = "true" ]; then
    plan_path="$(resolve_latest_open_plan || true)"
    if [ -z "$plan_path" ]; then
      echo "No open session plan found to activate. Create/open a plan first." >&2
      exit 1
    fi
  else
    echo "Refusing implicit session selection." >&2
    echo "Use '--plan <path>' to choose explicitly, or '--latest' to opt in to auto-select." >&2
    exit 2
  fi

  if is_plan_closed "$plan_path"; then
    remove_closed_attribute "$plan_path"
    echo "Reopened closed session: removed close marker from $plan_path"
  fi

  mkdir -p "$(dirname "$CURRENT_PLAN_POINTER")"
  printf '%s\n' "$plan_path" > "$CURRENT_PLAN_POINTER"
  echo "Session opened: $plan_path"
  echo "Active plan pointer set: $CURRENT_PLAN_POINTER"
  refresh_terminal_panels
}

count_open_todos() {
  local plan_path="$1"
  awk '
    /^##[[:space:]]+Progress[[:space:]]*$/ { in_progress=1; next }
    in_progress && /^##[[:space:]]+/ { exit }
    in_progress && /^- \[ \]/ { count++ }
    END { print count + 0 }
  ' "$plan_path"
}

mark_all_todos_done() {
  local plan_path="$1"
  local tmp_file
  tmp_file="$(mktemp)"
  awk '
    /^##[[:space:]]+Progress[[:space:]]*$/ { in_progress=1; print; next }
    in_progress && /^##[[:space:]]+/ { in_progress=0; print; next }
    in_progress && /^- \[ \]/ {
      sub(/^- \[ \]/, "- [x]")
      print
      next
    }
    { print }
  ' "$plan_path" > "$tmp_file"
  mv "$tmp_file" "$plan_path"
}

upsert_closed_attribute() {
  local plan_path="$1"
  local closed_value="$2"
  local tmp_file
  tmp_file="$(mktemp)"
  awk -v closed="$closed_value" '
    BEGIN { in_session=0; replaced=0 }
    /^##[[:space:]]+Session[[:space:]]*$/ { in_session=1; print; next }
    in_session && /^##[[:space:]]+/ {
      if (!replaced) {
        print "- Session closed: " closed " #docs"
        replaced=1
      }
      in_session=0
      print
      next
    }
    in_session && /^-[[:space:]]*Session (closed|stopped):[[:space:]]*/ {
      print "- Session closed: " closed " #docs"
      replaced=1
      next
    }
    { print }
    END {
      if (in_session && !replaced) {
        print "- Session closed: " closed " #docs"
      }
    }
  ' "$plan_path" > "$tmp_file"
  mv "$tmp_file" "$plan_path"
}

clear_plan_pointer() {
  if [ -f "$CURRENT_PLAN_POINTER" ]; then
    : > "$CURRENT_PLAN_POINTER"
  fi
}

ensure_git_repo() {
  if git -C "$ROOT_DIR" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    return 0
  fi
  echo "Repository check failed: $ROOT_DIR is not a git work tree." >&2
  return 1
}

has_uncommitted_or_untracked() {
  local status_output filtered_output
  status_output="$(git -C "$ROOT_DIR" status --porcelain --untracked-files=all)"
  filtered_output="$(
    printf '%s\n' "$status_output" \
      | grep -Ev '^\?\? .*(/|^)\.(plan|sessions)/' \
      || true
  )"
  if [ -n "$filtered_output" ]; then
    return 0
  fi
  return 1
}

has_unpushed_commits() {
  local upstream
  upstream="$(git -C "$ROOT_DIR" rev-parse --abbrev-ref --symbolic-full-name '@{upstream}' 2>/dev/null || true)"
  if [ -z "$upstream" ]; then
    return 0
  fi

  local ahead_count
  ahead_count="$(git -C "$ROOT_DIR" rev-list --count "${upstream}..HEAD" 2>/dev/null || echo "0")"
  if [ "${ahead_count:-0}" -gt 0 ]; then
    return 0
  fi
  return 1
}

ensure_ready_for_explicit_close() {
  local failed=0
  if ! ensure_git_repo; then
    return 1
  fi

  if has_uncommitted_or_untracked; then
    echo "Cannot mark session as explicitly closed: working tree is not clean."
    echo "Action needed: commit/stash/remove local changes, then push."
    failed=1
  fi

  if has_unpushed_commits; then
    echo "Cannot mark session as explicitly closed: branch has unpushed commits or no upstream."
    echo "Action needed: push current branch and retry close."
    failed=1
  fi

  if [ "$failed" -ne 0 ]; then
    return 1
  fi
  return 0
}

reset_terminal_agent_context() {
  if [ "$NO_AGENT_CLOSE" = "true" ]; then
    echo "Terminal agent reset skipped (--no-agent-close)."
    return 0
  fi

  if ! command -v tmux >/dev/null 2>&1; then
    echo "tmux not found; skipped terminal agent reset."
    return 0
  fi

  if tmux has-session -t "$TERMINAL_SESSION_NAME" 2>/dev/null; then
    local agent_pane
    agent_pane="$(tmux list-panes -t "$TERMINAL_SESSION_NAME":agent -F '#{pane_id} #{pane_left} #{pane_top}' 2>/dev/null | sort -k2,2n -k3,3n | head -n 1 | awk '{print $1}')"
    if [ -n "$agent_pane" ]; then
      tmux send-keys -t "$agent_pane" "/new" C-m >/dev/null 2>&1 || true
      echo "Sent '/new' to agent pane: $agent_pane"
      return 0
    fi
    echo "Agent pane not found in tmux session '$TERMINAL_SESSION_NAME'; skipped '/new'."
    return 0
  fi

  echo "No active tmux session named '$TERMINAL_SESSION_NAME'; nothing to reset."
}

refresh_terminal_panels() {
  if ! command -v tmux >/dev/null 2>&1; then
    echo "tmux not found; skipped terminal panel refresh."
    return 0
  fi

  if ! tmux has-session -t "$TERMINAL_SESSION_NAME" 2>/dev/null; then
    echo "No active tmux session named '$TERMINAL_SESSION_NAME'; skipped terminal panel refresh."
    return 0
  fi

  local top_right_pane lower_right_pane
  top_right_pane="$(tmux list-panes -t "$TERMINAL_SESSION_NAME":agent -F '#{pane_id} #{pane_left} #{pane_top}' 2>/dev/null | sort -k2,2nr -k3,3n | head -n 1 | awk '{print $1}')"
  lower_right_pane="$(tmux list-panes -t "$TERMINAL_SESSION_NAME":agent -F '#{pane_id} #{pane_left} #{pane_top}' 2>/dev/null | sort -k2,2nr -k3,3nr | head -n 1 | awk '{print $1}')"

  if [ -n "$top_right_pane" ]; then
    tmux send-keys -t "$top_right_pane" -X cancel >/dev/null 2>&1 || true
    tmux clear-history -t "$top_right_pane" >/dev/null 2>&1 || true
    if [ -x "$SESSION_INFO_PANEL_SCRIPT" ]; then
      tmux respawn-pane -k -t "$top_right_pane" "bash -lc '$SESSION_INFO_PANEL_SCRIPT'" >/dev/null 2>&1 || true
    fi
  fi

  if [ -n "$lower_right_pane" ]; then
    tmux send-keys -t "$lower_right_pane" -X cancel >/dev/null 2>&1 || true
    tmux clear-history -t "$lower_right_pane" >/dev/null 2>&1 || true
    if [ -x "$RIGHT_PANEL_SCRIPT" ]; then
      tmux respawn-pane -k -t "$lower_right_pane" "bash -lc '$RIGHT_PANEL_SCRIPT'" >/dev/null 2>&1 || true
    fi
  fi

  if [ -x "$REFLOW_LAYOUT" ]; then
    "$REFLOW_LAYOUT" "$TERMINAL_SESSION_NAME" agent >/dev/null 2>&1 || true
  fi

  echo "Refreshed terminal right-side panels for session '$TERMINAL_SESSION_NAME'."
}

UI_MODE="$(resolve_ui_mode)"
if [ "$UI_MODE" != "terminal" ]; then
  echo "session command is terminal-only; current ui-mode is '$UI_MODE'. Use web UI session controls instead."
  exit 5
fi

case "$ACTION" in
  list)
    list_sessions
    exit 0
    ;;
  open)
    open_session
    exit 0
    ;;
  create)
    create_session
    exit 0
    ;;
  close)
    ;;
  *)
    echo "Unsupported action: $ACTION (expected: open|close|list|create)" >&2
    exit 2
    ;;
esac

PLAN_PATH="$(resolve_plan_path || true)"
if [ -z "$PLAN_PATH" ]; then
  echo "No active session plan found via $CURRENT_PLAN_POINTER." >&2
  exit 1
fi

OPEN_TODOS="$(count_open_todos "$PLAN_PATH")"
if [ "$OPEN_TODOS" -gt 0 ]; then
  echo "Open todos in plan: $OPEN_TODOS"
  if [ -t 0 ]; then
    read -r -p "Mark all open todos as done before closing this session? [y/N]: " answer || true
  else
    answer="n"
  fi

  case "${answer:-n}" in
    y|Y|yes|YES)
      mark_all_todos_done "$PLAN_PATH"
      ;;
    *)
      echo "Session close aborted. Keep working plan open or mark todos manually."
      exit 3
      ;;
  esac
fi

if ! ensure_ready_for_explicit_close; then
  clear_plan_pointer
  echo "Explicit close requirements failed: session marker not written."
  echo "Cleared active plan pointer for terminal UI close: $CURRENT_PLAN_POINTER"
  echo "Detected session ui-mode: $UI_MODE"
  refresh_terminal_panels
  reset_terminal_agent_context
  echo "Session UI close completed (history remains open)."
  exit 4
fi

CLOSED_AT_UTC="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
upsert_closed_attribute "$PLAN_PATH" "$CLOSED_AT_UTC"
clear_plan_pointer

echo "Session closed attribute written: $CLOSED_AT_UTC"
echo "Cleared active plan pointer: $CURRENT_PLAN_POINTER"
echo "Detected session ui-mode: $UI_MODE"

refresh_terminal_panels
reset_terminal_agent_context

echo "Session close completed."
