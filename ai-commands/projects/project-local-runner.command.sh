#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../command-python.setup.sh"
AI_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
CONFIG_BUNDLE_ROOT="${AI_CONFIG_BUNDLE_ROOT:-$AI_ROOT/ai-config}"
PROJECTS_DIR="$CONFIG_BUNDLE_ROOT/projects"
LEGACY_PROJECTS_DIR="$AI_ROOT/ai-commands/projects/registry"
PROJECT_ID=""
DRY_RUN=0
BROWSER_CMD="$AI_ROOT/ai-commands/browser/browser.command.sh"

declare -a RUNNER_ARGS=()

usage() {
  cat <<USAGE
Usage: ./ai-commands/projects/project-local-runner.command.sh --project <project-id> [--dry-run] [-- <args...>]

Options:
  --project <project-id>  Registered project id to run locally.
  --dry-run               Print the resolved command without executing it.
  -h, --help              Show this help.
USAGE
}

trim() {
  printf '%s' "$1" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//'
}

unquote() {
  local value
  value=$(trim "$1")
  value=$(printf '%s' "$value" | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")
  printf '%s\n' "$value"
}

resolve_path() {
  local base_path relative_path
  base_path="$1"
  relative_path="$2"
  if [ -z "$relative_path" ]; then
    printf '%s\n' "$base_path"
    return 0
  fi
  if [[ "$relative_path" = /* ]]; then
    printf '%s\n' "$relative_path"
  else
    printf '%s\n' "$base_path/$relative_path"
  fi
}

project_path_base() {
  local registry_file
  registry_file="$1"
  if [[ "$registry_file" = "$CONFIG_BUNDLE_ROOT"/* ]]; then
    printf '%s\n' "$CONFIG_BUNDLE_ROOT"
  else
    printf '%s\n' "$AI_ROOT"
  fi
}

resolve_url() {
  command_python - "$1" "$2" <<'PYURL'
from urllib.parse import urljoin
import sys
print(urljoin(sys.argv[1], sys.argv[2]))
PYURL
}

page_has_html() {
  local file_path
  file_path="$1"
  if command -v rg >/dev/null 2>&1; then
    rg -qi '<html' "$file_path"
  else
    grep -Eqi '<html' "$file_path"
  fi
}

find_registry_file() {
  local candidate direct_candidate id
  direct_candidate="$PROJECTS_DIR/$PROJECT_ID/project.yml"
  if [ -f "$direct_candidate" ]; then
    printf '%s\n' "$direct_candidate"
    return 0
  fi
  while IFS= read -r candidate; do
    [ -f "$candidate" ] || continue
    id=$(awk -F ': *' '/^id:[[:space:]]*/ {print $2; exit}' "$candidate" | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")
    if [ "$id" = "$PROJECT_ID" ]; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done < <(find "$PROJECTS_DIR" "$LEGACY_PROJECTS_DIR" -mindepth 2 -maxdepth 3 -type f -name 'project.yml' 2>/dev/null | sort)
  return 1
}

extract_start_local_command() {
  local file_path
  file_path="$1"
  awk -f <(cat <<'AWK'
function trim(value) {
  sub(/^[[:space:]]+/, "", value)
  sub(/[[:space:]]+$/, "", value)
  return value
}
function unquote(value) {
  value = trim(value)
  sub(/^"/, "", value)
  sub(/"$/, "", value)
  sub(/^'"'"'/, "", value)
  sub(/'"'"'$/, "", value)
  return value
}
function flush() {
  if (entry_id == "start_local" && command != "") {
    print command
    found = 1
    exit
  }
  entry_id = ""
  command = ""
}
/^faq:[[:space:]]*$/ { in_faq=1; next }
in_faq && /^[^[:space:]]/ && NF { flush(); exit }
in_faq && /^[[:space:]]*-[[:space:]]+/ {
  flush()
  line = $0
  sub(/^[[:space:]]*-[[:space:]]+/, "", line)
  if (line ~ /^id:[[:space:]]*/) {
    sub(/^id:[[:space:]]*/, "", line)
    entry_id = unquote(line)
  }
  next
}
in_faq && /^[[:space:]]+[A-Za-z_][A-Za-z0-9_-]*:[[:space:]]*/ {
  line = $0
  sub(/^[[:space:]]+/, "", line)
  if (line ~ /^id:[[:space:]]*/) {
    sub(/^id:[[:space:]]*/, "", line)
    entry_id = unquote(line)
  } else if (line ~ /^command:[[:space:]]*/) {
    sub(/^command:[[:space:]]*/, "", line)
    command = unquote(line)
  }
  next
}
END {
  if (!found && entry_id == "start_local" && command != "") {
    print command
  }
}
AWK
) "$file_path"
}

extract_page_asset_refs() {
  local file_path
  file_path="$1"
  if command -v rg >/dev/null 2>&1; then
    rg -o '(src|href)="[^"]+\.(js|css)(\?[^"]*)?"' "$file_path" | sed -E 's/^(src|href)="//; s/"$//'
  else
    grep -Eo '(src|href)="[^"]+\.(js|css)(\?[^"]*)?"' "$file_path" | sed -E 's/^(src|href)="//; s/"$//'
  fi
}

wait_for_browser_url_ready() {
  local url body_file attempt code all_ok asset asset_url asset_code
  url="$1"
  body_file="$(mktemp)"
  trap 'rm -f "$body_file"' RETURN

  for attempt in $(seq 1 60); do
    code="$(curl -sS --max-time 4 -o "$body_file" -w "%{http_code}" "$url" 2>/dev/null || true)"

    if [[ "$code" =~ ^[23][0-9][0-9]$ ]] && page_has_html "$body_file"; then
      all_ok=1
      while IFS= read -r asset; do
        [ -n "$asset" ] || continue
        asset_url="$(resolve_url "$url" "$asset")"
        asset_code="$(curl -sS -o /dev/null -w "%{http_code}" --max-time 4 "$asset_url" 2>/dev/null || true)"
        if [[ ! "$asset_code" =~ ^[23][0-9][0-9]$ ]]; then
          all_ok=0
          break
        fi
      done < <(extract_page_asset_refs "$body_file")

      if [ "$all_ok" -eq 1 ]; then
        return 0
      fi
    fi

    if [ "$code" = "504" ]; then
      sleep 2
    else
      sleep 1
    fi
  done

  return 1
}

schedule_browser_open() {
  local url
  url="$1"
  if [ -z "$url" ] || [ ! -x "$BROWSER_CMD" ]; then
    return 0
  fi

  (
    if command -v curl >/dev/null 2>&1; then
      if wait_for_browser_url_ready "$url"; then
        "$BROWSER_CMD" "$url" >/dev/null 2>&1 || true
        exit 0
      fi
    else
      sleep 5
    fi
    "$BROWSER_CMD" "$url" >/dev/null 2>&1 || true
  ) >/dev/null 2>&1 &
}

print_log_metadata() {
  local log_file browser_url extra_logs_text
  log_file="$1"
  browser_url="$2"
  extra_logs_text="$3"

  printf 'Started: %s\n' "$(date -Iseconds)"
  printf 'Project: %s\n' "$project_label"
  printf 'Working directory: %s\n' "$working_dir"
  printf 'Command: %s\n' "$run_command"
  if [ -n "$browser_url" ]; then
    printf 'Browser URL: %s\n' "$browser_url"
  fi
  printf 'Launcher log: %s\n' "$log_file"
  if [ -n "$extra_logs_text" ]; then
    printf 'Related logs:\n%s\n' "$extra_logs_text"
  fi
  if [ -n "$run_notes" ]; then
    printf 'Notes: %s\n' "$run_notes"
  fi
  printf '\n'
}

while [ $# -gt 0 ]; do
  case "$1" in
    --project)
      if [ $# -lt 2 ]; then
        echo "Missing value for --project" >&2
        usage >&2
        exit 1
      fi
      PROJECT_ID="$2"
      shift 2
      ;;
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    --)
      shift
      RUNNER_ARGS=("$@")
      break
      ;;
    *)
      RUNNER_ARGS+=("$1")
      shift
      ;;
  esac
done

if [ -z "$PROJECT_ID" ]; then
  echo "Missing required --project argument" >&2
  usage >&2
  exit 1
fi

registry_file="$(find_registry_file || true)"
if [ -z "$registry_file" ]; then
  echo "Unknown project id: $PROJECT_ID" >&2
  exit 1
fi

project_path=""
project_label="$PROJECT_ID"
run_command=""
run_usage=""
run_notes=""
run_min_args="0"
run_workdir=""
run_browser_url="${PROJECT_LOCAL_RUNNER_OPEN_URL:-}"
run_log_file="${PROJECT_LOCAL_RUNNER_LOG_FILE:-}"
run_extra_logs="${PROJECT_LOCAL_RUNNER_EXTRA_LOGS:-}"

while IFS= read -r line; do
  case "$line" in
    label:*) project_label=$(unquote "${line#label:}") ;;
    path:*) project_path=$(unquote "${line#path:}") ;;
    repo_path:*) if [ -z "$project_path" ]; then project_path=$(unquote "${line#repo_path:}"); fi ;;
    local_runner_command:*) run_command=$(unquote "${line#local_runner_command:}") ;;
    local_runner_usage:*) run_usage=$(unquote "${line#local_runner_usage:}") ;;
    local_runner_notes:*) run_notes=$(unquote "${line#local_runner_notes:}") ;;
    local_runner_min_args:*) run_min_args=$(unquote "${line#local_runner_min_args:}") ;;
    local_runner_workdir:*) run_workdir=$(unquote "${line#local_runner_workdir:}") ;;
    local_runner_browser_url:*) if [ -z "$run_browser_url" ]; then run_browser_url=$(unquote "${line#local_runner_browser_url:}"); fi ;;
    local_runner_log_file:*) if [ -z "$run_log_file" ]; then run_log_file=$(unquote "${line#local_runner_log_file:}"); fi ;;
  esac
done < "$registry_file"

if [ -z "$project_path" ]; then
  echo "Project registry entry is missing path: $registry_file" >&2
  exit 1
fi

if [ -z "$run_command" ]; then
  run_command=$(extract_start_local_command "$registry_file")
fi

if [ -z "$run_command" ]; then
  echo "Project registry entry is missing a local start command: $registry_file" >&2
  exit 1
fi

project_root=$(resolve_path "$(project_path_base "$registry_file")" "$project_path")
if [ ! -d "$project_root" ]; then
  echo "Project path does not exist: $project_root" >&2
  exit 1
fi

if [ -n "$run_workdir" ]; then
  working_dir=$(resolve_path "$project_root" "$run_workdir")
else
  working_dir="$project_root"
fi

if [ ! -d "$working_dir" ]; then
  echo "Runner working directory does not exist: $working_dir" >&2
  exit 1
fi

if [ -z "$run_log_file" ]; then
  run_log_file="$(dirname "$registry_file")/start-local.log"
fi

if ! [[ "$run_min_args" =~ ^[0-9]+$ ]]; then
  echo "Invalid local_runner_min_args value in $registry_file: $run_min_args" >&2
  exit 1
fi

if [ ${#RUNNER_ARGS[@]} -lt "$run_min_args" ]; then
  echo "Missing required runner arguments for $PROJECT_ID" >&2
  if [ -n "$run_usage" ]; then
    echo "Usage: $run_usage" >&2
  fi
  if [ -n "$run_notes" ]; then
    echo "$run_notes" >&2
  fi
  exit 1
fi

printf 'Project: %s\n' "$project_label"
printf 'Working directory: %s\n' "$working_dir"
printf 'Command: %s\n' "$run_command"
if [ -n "$run_browser_url" ]; then
  printf 'Browser URL: %s\n' "$run_browser_url"
fi
printf 'Launcher log: %s\n' "$run_log_file"
if [ -n "$run_extra_logs" ]; then
  printf 'Related logs:\n%s\n' "$run_extra_logs"
fi
if [ -n "$run_notes" ]; then
  printf 'Notes: %s\n' "$run_notes"
fi

if [ "$DRY_RUN" -eq 1 ]; then
  exit 0
fi

mkdir -p "$(dirname "$run_log_file")"
: > "$run_log_file"
print_log_metadata "$run_log_file" "$run_browser_url" "$run_extra_logs" | tee -a "$run_log_file" >/dev/null

schedule_browser_open "$run_browser_url"
cd "$working_dir"
set +e
bash -lc "$run_command" project-local-runner "${RUNNER_ARGS[@]}" 2>&1 | tee -a "$run_log_file"
command_exit_status=${PIPESTATUS[0]}
set -e
printf '\nFinished: %s\nExit status: %s\n' "$(date -Iseconds)" "$command_exit_status" | tee -a "$run_log_file" >/dev/null
exit "$command_exit_status"
