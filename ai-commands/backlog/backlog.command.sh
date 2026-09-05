#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd -- "$SCRIPT_DIR/../../.." && pwd)"
CURRENT_PLAN_POINTER="$ROOT_DIR/session-root/.current-plan-path"
CURRENT_BACKLOG_POINTER="$ROOT_DIR/session-root/.current-backlog-path"
TERMINAL_SESSION_NAME="${AI_TERMINAL_SESSION_NAME:-ai-shell}"
REFLOW_LAYOUT="$ROOT_DIR/ai-terminal/reflow-layout.sh"
PROJECTS_DIR="$ROOT_DIR/rules/commands/projects/registry"
BROWSER_COMMAND_SH="$ROOT_DIR/rules/commands/browser/browser.command.sh"

ACTION="${1:-list}"
BACKLOG_ARG=""
REPO_OVERRIDE=""
DRY_RUN=0

if [ $# -gt 0 ]; then
  shift
fi

while [ $# -gt 0 ]; do
  case "$1" in
    --backlog)
      BACKLOG_ARG="${2:-}"
      shift 2
      ;;
    --repo)
      REPO_OVERRIDE="${2:-}"
      shift 2
      ;;
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    --help|-h)
      cat <<'EOF'
Usage:
  backlog.command.sh list
  backlog.command.sh pick --backlog <name-or-path>
  backlog.command.sh get --backlog <name-or-path>
  backlog.command.sh open --backlog <name-or-path>
  backlog.command.sh show [--backlog <name-or-path>]
  backlog.command.sh delete [--backlog <name-or-path>]
  backlog.command.sh sync [--backlog <name-or-path>] [--repo <owner/name>] [--dry-run]
EOF
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 2
      ;;
  esac
done

trim() {
  sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//'
}

unquote() {
  local value
  value=$(trim <<<"$1")
  value=$(printf '%s' "$value" | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")
  printf '%s
' "$value"
}

normalize_repo_full_name() {
  local value="$1"
  value="${value%.git}"
  case "$value" in
    https://github.com/*)
      value="${value#https://github.com/}"
      ;;
    http://github.com/*)
      value="${value#http://github.com/}"
      ;;
    git@github.com:*)
      value="${value#git@github.com:}"
      ;;
  esac
  printf '%s
' "$value"
}

extract_backlog_field() {
  local backlog_file field
  backlog_file="$1"
  field="$2"
  awk -v wanted="$field" '
    /^##[[:space:]]+/ { exit }
    $0 ~ "^-+[[:space:]]*" wanted ":[[:space:]]*" {
      line=$0
      sub(/^-+[[:space:]]*/, "", line)
      sub("^" wanted ":[[:space:]]*", "", line)
      print line
      exit
    }
  ' "$backlog_file" | trim
}

resolve_repo_url_from_registry() {
  local selector="$1"
  local file_path line id label repo_url

  if [ ! -d "$PROJECTS_DIR" ]; then
    return 1
  fi

  while IFS= read -r file_path; do
    [ -n "$file_path" ] || continue
    id=""
    label=""
    repo_url=""
    while IFS= read -r line; do
      case "$line" in
        id:*) id=$(unquote "${line#id:}") ;;
        label:*) label=$(unquote "${line#label:}") ;;
        name:*) if [ -z "$label" ]; then label=$(unquote "${line#name:}"); fi ;;
        repo_url:*) repo_url=$(unquote "${line#repo_url:}") ;;
      esac
    done < "$file_path"
    if [ "$selector" = "$id" ] || [ "$selector" = "$label" ]; then
      printf '%s
' "$repo_url"
      return 0
    fi
  done < <(find "$PROJECTS_DIR" -mindepth 2 -maxdepth 2 -type f -name 'project.yml' | sort)
  return 1
}

canonical_backlog_file() {
  local backlog_file root candidate
  backlog_file="$1"
  root="$(backlog_root_dir)"
  if backlog_belongs_to_session "$backlog_file"; then
    candidate="$root/$(basename "$backlog_file")"
    if [ -f "$candidate" ]; then
      printf '%s
' "$candidate"
      return 0
    fi
  fi
  printf '%s
' "$backlog_file"
}

sync_backlog_copy_if_needed() {
  local source_file maybe_session_file
  source_file="$1"
  maybe_session_file="$2"
  if [ -n "$maybe_session_file" ] && [ "$source_file" != "$maybe_session_file" ] && [ -f "$maybe_session_file" ]; then
    cp "$source_file" "$maybe_session_file"
  fi
}

open_github_issue_in_browser() {
  local issue_url
  issue_url="$1"
  if [ -x "$BROWSER_COMMAND_SH" ]; then
    "$BROWSER_COMMAND_SH" "$issue_url" || true
    return 0
  fi
  printf '%s
' "$issue_url"
}

build_github_issue_body() {
  local backlog_file relative_path project project_name profile workflow
  backlog_file="$1"
  relative_path="${backlog_file#$ROOT_DIR/}"
  project="$(extract_backlog_field "$backlog_file" "Project")"
  project_name="$(extract_backlog_field "$backlog_file" "Project Name")"
  profile="$(extract_backlog_field "$backlog_file" "Profile")"
  workflow="$(extract_backlog_field "$backlog_file" "Workflow")"

  printf 'Synced from AI backlog story `%s`.

' "$relative_path"
  printf -- '- Profile: %s
' "$profile"
  printf -- '- Workflow: %s
' "$workflow"
  printf -- '- Project: %s
' "$project"
  printf -- '- Project Name: %s

' "$project_name"
  awk 'BEGIN { emit=0 } /^##[[:space:]]+/ { emit=1 } emit { print }' "$backlog_file"
}

write_github_sync_metadata() {
  local backlog_file repo_full_name issue_number issue_url synced_at tmp_file
  backlog_file="$1"
  repo_full_name="$2"
  issue_number="$3"
  issue_url="$4"
  synced_at="$5"
  tmp_file="$(mktemp)"
  awk -v repo="$repo_full_name" -v issue_number="$issue_number" -v issue_url="$issue_url" -v synced_at="$synced_at" '
    /^- GitHub Repo:/ { next }
    /^- GitHub Issue:/ { next }
    /^- GitHub Issue URL:/ { next }
    /^- GitHub Synced At:/ { next }
    /^- Source:/ {
      print "- GitHub Repo: " repo
      print "- GitHub Issue: #" issue_number
      print "- GitHub Issue URL: " issue_url
      print "- GitHub Synced At: " synced_at
      print
      print $0
      next
    }
    { print }
  ' "$backlog_file" > "$tmp_file"
  mv "$tmp_file" "$backlog_file"
}

sync_backlog_to_github_issue() {
  local requested_file backlog_file project_selector repo_url repo_full_name title issue_body_file issue_url issue_number synced_at
  requested_file="$1"
  backlog_file="$(canonical_backlog_file "$requested_file")"
  project_selector="$(extract_backlog_field "$backlog_file" "Project")"
  title="$(backlog_title "$backlog_file")"

  if [ -z "$project_selector" ] && [ -z "$REPO_OVERRIDE" ]; then
    echo "Backlog story is missing 'Project:' and no --repo override was provided." >&2
    return 1
  fi

  if [ -n "$REPO_OVERRIDE" ]; then
    repo_full_name="$(normalize_repo_full_name "$REPO_OVERRIDE")"
  else
    repo_url="$(resolve_repo_url_from_registry "$project_selector" || true)"
    if [ -z "$repo_url" ]; then
      echo "Could not resolve repo_url for backlog project '$project_selector'." >&2
      return 1
    fi
    repo_full_name="$(normalize_repo_full_name "$repo_url")"
  fi

  if [ "$DRY_RUN" -eq 1 ]; then
    printf 'Backlog: %s
' "$backlog_file"
    printf 'Repo: %s
' "$repo_full_name"
    printf 'Title: %s
' "$title"
    return 0
  fi

  if ! gh auth status >/dev/null 2>&1; then
    echo "GitHub CLI is not authenticated. Run: gh auth login -h github.com" >&2
    return 1
  fi

  issue_body_file="$(mktemp)"
  build_github_issue_body "$backlog_file" > "$issue_body_file"
  issue_url="$(gh issue create --repo "$repo_full_name" --title "$title" --body-file "$issue_body_file")"
  rm -f "$issue_body_file"
  issue_number="${issue_url##*/}"
  synced_at="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  write_github_sync_metadata "$backlog_file" "$repo_full_name" "$issue_number" "$issue_url" "$synced_at"
  sync_backlog_copy_if_needed "$backlog_file" "$requested_file"
  open_github_issue_in_browser "$issue_url"
  printf 'Created GitHub issue: %s
' "$issue_url"
}

is_session_closed() {
  local plan_path
  plan_path="$1"
  if [ -z "$plan_path" ] || [ ! -f "$plan_path" ]; then
    return 1
  fi
  awk '
    /^##[[:space:]]+Session[[:space:]]*$/ { in_session=1; next }
    in_session && /^##[[:space:]]+/ { exit }
    in_session && /^-[[:space:]]*Session (closed|stopped):[[:space:]]*/ { found=1; exit }
    END { exit found ? 0 : 1 }
  ' "$plan_path"
}

resolve_active_plan_path() {
  local plan_path
  if [ ! -f "$CURRENT_PLAN_POINTER" ]; then
    return 1
  fi
  plan_path="$(tr -d '\r' < "$CURRENT_PLAN_POINTER" | head -n 1 | trim)"
  if [ -z "$plan_path" ] || [ ! -f "$plan_path" ]; then
    return 1
  fi
  if is_session_closed "$plan_path"; then
    return 1
  fi
  printf '%s\n' "$plan_path"
}

resolve_profile_id() {
  local env_profile active_plan profile first_dir
  env_profile="$(printf '%s' "${WORK_PROFILE_ID:-${AI_WORK_PROFILE_ID:-}}" | trim)"
  if [ -n "$env_profile" ]; then
    printf '%s\n' "$env_profile"
    return 0
  fi

  active_plan="$(resolve_active_plan_path || true)"
  if [ -n "$active_plan" ]; then
    profile="$(basename "$(dirname "$(dirname "$active_plan")")")"
    if [ -n "$profile" ]; then
      printf '%s\n' "$profile"
      return 0
    fi
  fi

  first_dir="$(
    find "${AI_SESSIONS_ROOT:-$ROOT_DIR/.local/work-session-state}" -mindepth 1 -maxdepth 1 -type d 2>/dev/null \
      | sed "s|${AI_SESSIONS_ROOT:-$ROOT_DIR/.local/work-session-state}/||" \
      | sort \
      | head -n 1
  )"
  if [ -n "$first_dir" ]; then
    printf '%s\n' "$first_dir"
    return 0
  fi

  printf 'sc\n'
}

WORK_PROFILE_ID="$(resolve_profile_id)"

session_dir() {
  local plan_path
  plan_path="$(resolve_active_plan_path || true)"
  if [ -z "$plan_path" ]; then
    return 1
  fi
  dirname "$plan_path"
}

backlog_root_dir() {
  printf '%s\n' "${AI_BACKLOG_ROOT:-${AI_SESSIONS_ROOT:-$ROOT_DIR/.local/work-session-state}}/$WORK_PROFILE_ID/backlog"
}

ensure_profile_runtime_dirs() {
  mkdir -p "${AI_SESSIONS_ROOT:-$ROOT_DIR/.local/work-session-state}/$WORK_PROFILE_ID"
  mkdir -p "$(backlog_root_dir)"
}

list_backlog_files() {
  local root
  root="$(backlog_root_dir)"
  if [ ! -d "$root" ]; then
    return 0
  fi
  find "$root" -mindepth 1 -maxdepth 1 -type f -name '*.md' | sort -r
}

read_current_backlog_file() {
  local path
  if [ ! -f "$CURRENT_BACKLOG_POINTER" ]; then
    return 1
  fi
  path="$(tr -d '\r' < "$CURRENT_BACKLOG_POINTER" | head -n 1 | trim)"
  if [ -z "$path" ] || [ ! -f "$path" ]; then
    return 1
  fi
  printf '%s\n' "$path"
}

write_current_backlog_file() {
  local path
  path="$1"
  mkdir -p "${AI_SESSIONS_ROOT:-$ROOT_DIR/.local/work-session-state}"
  printf '%s\n' "$path" > "$CURRENT_BACKLOG_POINTER"
}

clear_current_backlog_file() {
  mkdir -p "${AI_SESSIONS_ROOT:-$ROOT_DIR/.local/work-session-state}"
  : > "$CURRENT_BACKLOG_POINTER"
}

backlog_belongs_to_session() {
  local backlog_file session_path
  backlog_file="$1"
  session_path="${2:-}"
  if [ -z "$session_path" ]; then
    session_path="$(session_dir || true)"
  fi
  if [ -z "$session_path" ] || [ -z "$backlog_file" ]; then
    return 1
  fi
  case "$backlog_file" in
    "$session_path"/*) return 0 ;;
  esac
  return 1
}

refresh_tmux_terminal_view() {
  if ! command -v tmux >/dev/null 2>&1; then
    return 0
  fi
  if ! tmux has-session -t "$TERMINAL_SESSION_NAME" >/dev/null 2>&1; then
    return 0
  fi
  if [ -x "$REFLOW_LAYOUT" ]; then
    "$REFLOW_LAYOUT" "$TERMINAL_SESSION_NAME" agent >/dev/null 2>&1 || true
  fi
}

resolve_backlog_arg() {
  local root active_backlog active_base session_path candidate matched_count matched_path base stem
  if [ -z "$BACKLOG_ARG" ]; then
    return 1
  fi

  if [ -f "$BACKLOG_ARG" ]; then
    printf '%s\n' "$BACKLOG_ARG"
    return 0
  fi

  root="$(backlog_root_dir)"
  session_path="$(session_dir || true)"
  active_backlog="$(read_current_backlog_file || true)"
  active_base="$(basename "${active_backlog:-}")"

  if [ -n "$session_path" ] && [ -f "$session_path/$BACKLOG_ARG" ]; then
    printf '%s\n' "$session_path/$BACKLOG_ARG"
    return 0
  fi
  if [ -n "$session_path" ] && [ -f "$session_path/$BACKLOG_ARG.md" ]; then
    printf '%s\n' "$session_path/$BACKLOG_ARG.md"
    return 0
  fi
  if [ -f "$root/$BACKLOG_ARG" ]; then
    printf '%s\n' "$root/$BACKLOG_ARG"
    return 0
  fi
  if [ -f "$root/$BACKLOG_ARG.md" ]; then
    printf '%s\n' "$root/$BACKLOG_ARG.md"
    return 0
  fi
  if [ -n "$active_backlog" ] && { [ "$active_base" = "$BACKLOG_ARG" ] || [ "${active_base%.md}" = "$BACKLOG_ARG" ]; }; then
    printf '%s\n' "$active_backlog"
    return 0
  fi

  matched_count=0
  matched_path=""
  while IFS= read -r candidate; do
    [ -n "$candidate" ] || continue
    base="$(basename "$candidate")"
    stem="$(basename "$candidate" .md)"
    if [ "$base" = "$BACKLOG_ARG" ] || [ "$stem" = "$BACKLOG_ARG" ]; then
      printf '%s\n' "$candidate"
      return 0
    fi
    case "$base" in
      "$BACKLOG_ARG"*) matched_count=$((matched_count + 1)); matched_path="$candidate"; continue ;;
    esac
    case "$stem" in
      "$BACKLOG_ARG"*) matched_count=$((matched_count + 1)); matched_path="$candidate" ;;
    esac
  done < <(list_backlog_files)

  if [ "$matched_count" -eq 1 ] && [ -n "$matched_path" ]; then
    printf '%s\n' "$matched_path"
    return 0
  fi
  return 1
}

extract_plan_field() {
  local plan_path field
  plan_path="$1"
  field="$2"
  awk -v wanted="$field" '
    /^##[[:space:]]+Session[[:space:]]*$/ { in_session=1; next }
    in_session && /^##[[:space:]]+/ { exit }
    in_session && $0 ~ "^" wanted ":[[:space:]]*" {
      line=$0
      sub("^" wanted ":[[:space:]]*", "", line)
      print line
      exit
    }
  ' "$plan_path" | trim
}

extract_list_field() {
  local plan_path field
  plan_path="$1"
  field="$2"
  awk -v wanted="$field" '
    /^##[[:space:]]+Session[[:space:]]*$/ { in_session=1; next }
    in_session && /^##[[:space:]]+/ { exit }
    in_session && $0 ~ "^-+[[:space:]]*" wanted ":[[:space:]]*" {
      line=$0
      sub(/^-+[[:space:]]*/, "", line)
      sub("^" wanted ":[[:space:]]*", "", line)
      sub(/[[:space:]]+#[-_[:alnum:]]+([[:space:]]+#[-_[:alnum:]]+)*[[:space:]]*$/, "", line)
      print line
      exit
    }
  ' "$plan_path" | trim
}

backlog_title() {
  local backlog_file title
  backlog_file="$1"
  title="$(awk '/^#[[:space:]]+/ { sub(/^#[[:space:]]+/, "", $0); print; exit }' "$backlog_file" | trim)"
  if [ -n "$title" ]; then
    printf '%s\n' "$title"
    return 0
  fi
  printf '%s\n' "$(basename "$backlog_file" .md)"
}

build_progress_from_backlog() {
  local backlog_file
  backlog_file="$1"
  awk '
    function trim(value) {
      gsub(/^[[:space:]]+|[[:space:]]+$/, "", value)
      return value
    }
    /^##[[:space:]]+Plan[[:space:]]*$/ { in_plan=1; next }
    in_plan && /^##[[:space:]]+/ { in_plan=0 }
    in_plan && /^-[[:space:]]+\[[ xX]\][[:space:]]+/ {
      line=$0
      sub(/^-+[[:space:]]+\[[ xX]\][[:space:]]+/, "", line)
      line=trim(line)
      if (line != "") {
        print line
      }
      next
    }
  ' "$backlog_file"
}

append_role_tag_if_missing() {
  local line
  line="$1"
  if printf '%s' "$line" | grep -Eq '#[-_[:alnum:]]+'; then
    printf '%s\n' "$line"
    return 0
  fi
  printf '%s #coding\n' "$line"
}

compile_backlog_to_active_plan() {
  local backlog_file plan_path started_at workflow project task task_scope picked_at title tmp_file
  local checklist_line items_count

  backlog_file="$1"
  plan_path="$(resolve_active_plan_path || true)"
  if [ -z "$plan_path" ] || [ ! -f "$plan_path" ]; then
    echo "No active session plan. Create/open a session first." >&2
    return 1
  fi

  started_at="$(extract_list_field "$plan_path" "started_at")"
  workflow="$(extract_plan_field "$plan_path" "Selected")"
  project="$(extract_plan_field "$plan_path" "Project")"
  task_scope="$(extract_plan_field "$plan_path" "Task Scope")"
  title="$(backlog_title "$backlog_file")"
  task="$title"
  picked_at="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

  if [ -z "$started_at" ]; then
    started_at="$picked_at"
  fi
  if [ -z "$workflow" ]; then
    workflow="dev"
  fi
  if [ -z "$project" ]; then
    project="ai"
  fi
  if [ -z "$task_scope" ] || [ "$task_scope" = "-" ]; then
    task_scope="Picked from backlog: $(basename "$backlog_file")"
  fi

  tmp_file="$(mktemp)"
  {
    printf '# Session Plan\n\n'
    printf '## Session\n'
    printf -- '- started_at: %s #docs\n' "$started_at"
    printf '### Project & Task\n'
    printf 'Project: %s\n' "$project"
    printf 'Task: %s\n' "$task"
    printf 'Task Scope: %s\n' "$task_scope"
    printf '### Workflow\n'
    printf 'Selected: %s\n\n' "$workflow"
    printf '## Backlog\n'
    printf -- '- source: `%s` #docs\n' "$backlog_file"
    printf -- '- picked_at: %s #docs\n\n' "$picked_at"
    printf '## Progress\n'
  } > "$tmp_file"

  items_count=0
  while IFS= read -r checklist_line; do
    [ -n "$checklist_line" ] || continue
    checklist_line="$(append_role_tag_if_missing "$checklist_line")"
    printf -- '- [ ] %s\n' "$checklist_line" >> "$tmp_file"
    items_count=$((items_count + 1))
  done < <(build_progress_from_backlog "$backlog_file")

  if [ "$items_count" -eq 0 ]; then
    {
      printf -- '- [ ] Review backlog story details #design\n'
      printf -- '- [ ] Implement backlog scope #coding\n'
      printf -- '- [ ] Validate behavior and regressions #test\n'
      printf -- '- [ ] Document outcome #docs\n'
    } >> "$tmp_file"
  fi

  mv "$tmp_file" "$plan_path"
  printf '%s\n' "$plan_path"
}

move_backlog_to_current_session() {
  local backlog_file active_session target_path plan_path
  backlog_file="$1"
  active_session="$(session_dir || true)"
  if [ -z "$active_session" ]; then
    echo "No active session. Open/create a session first." >&2
    return 1
  fi
  if [ ! -f "$backlog_file" ]; then
    echo "Backlog file not found: $backlog_file" >&2
    return 1
  fi

  if backlog_belongs_to_session "$backlog_file" "$active_session"; then
    target_path="$backlog_file"
  else
    target_path="$active_session/$(basename "$backlog_file")"
    if [ ! -e "$target_path" ]; then
      cp "$backlog_file" "$target_path"
    fi
  fi

  write_current_backlog_file "$target_path"
  plan_path="$(compile_backlog_to_active_plan "$target_path")"
  printf '%s|%s\n' "$target_path" "$plan_path"
}

case "$ACTION" in
  list)
    ensure_profile_runtime_dirs
    current_backlog="$(read_current_backlog_file || true)"
    current_session="$(session_dir || true)"
    echo "Backlogs for profile: $WORK_PROFILE_ID"
    if [ -n "$current_backlog" ] && [ -f "$current_backlog" ] && backlog_belongs_to_session "$current_backlog" "$current_session"; then
      echo "Current session backlog:"
      echo "ACTIVE - $(basename "$current_backlog")"
      echo
      echo "Backlog pool:"
      echo
    fi
    if ! list_backlog_files | grep -q .; then
      echo "No backlog files found."
    else
      while IFS= read -r backlog_file; do
        [ -n "$backlog_file" ] || continue
        echo "- $(basename "$backlog_file")"
      done < <(list_backlog_files)
    fi
    ;;
  pick|get|open)
    ensure_profile_runtime_dirs
    backlog_file="$(resolve_backlog_arg || true)"
    if [ -z "$backlog_file" ]; then
      echo "Backlog not found. Use --backlog <name-or-path>." >&2
      exit 1
    fi
    result="$(move_backlog_to_current_session "$backlog_file")"
    IFS='|' read -r moved_backlog session_plan_file <<EOF
$result
EOF
    refresh_tmux_terminal_view
    echo "Active backlog: $moved_backlog"
    echo "Session plan file: $session_plan_file"
    ;;
  show)
    ensure_profile_runtime_dirs
    if [ -n "$BACKLOG_ARG" ]; then
      backlog_file="$(resolve_backlog_arg || true)"
    else
      backlog_file="$(read_current_backlog_file || true)"
    fi
    if [ -z "$backlog_file" ]; then
      echo "No active backlog. Use pick --backlog <name-or-path> first." >&2
      exit 1
    fi
    cat "$backlog_file"
    ;;
  delete)
    ensure_profile_runtime_dirs
    if [ -n "$BACKLOG_ARG" ]; then
      backlog_file="$(resolve_backlog_arg || true)"
    else
      backlog_file="$(read_current_backlog_file || true)"
    fi
    if [ -z "$backlog_file" ]; then
      echo "No backlog selected."
      exit 0
    fi
    if [ ! -f "$backlog_file" ]; then
      echo "Backlog file not found: $backlog_file" >&2
      exit 1
    fi
    current_backlog="$(read_current_backlog_file || true)"
    rm -f "$backlog_file"
    if [ "$backlog_file" = "$current_backlog" ]; then
      clear_current_backlog_file
    fi
    refresh_tmux_terminal_view
    echo "Deleted backlog: $backlog_file"
    ;;
  sync)
    ensure_profile_runtime_dirs
    if [ -n "$BACKLOG_ARG" ]; then
      backlog_file="$(resolve_backlog_arg || true)"
    else
      backlog_file="$(read_current_backlog_file || true)"
    fi
    if [ -z "$backlog_file" ]; then
      echo "No backlog selected. Use --backlog <name-or-path> first." >&2
      exit 1
    fi
    sync_backlog_to_github_issue "$backlog_file"
    refresh_tmux_terminal_view
    ;;
  *)
    echo "Unknown action: $ACTION" >&2
    exit 2
    ;;
esac
