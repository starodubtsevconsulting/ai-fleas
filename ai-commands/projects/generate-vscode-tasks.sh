#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../command-python.setup.sh"
AI_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
PROJECTS_DIR="$AI_ROOT/rules/commands/projects/registry"
CURRENT_PLAN_POINTER="$AI_ROOT/session-root/.current-plan-path"
TASKS_FILE="$AI_ROOT/.vscode/tasks.json"

trim() {
  printf '%s' "$1" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//'
}

unquote() {
  local value
  value=$(trim "$1")
  value=$(printf '%s' "$value" | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")
  printf '%s\n' "$value"
}

json_escape() {
  command_python - "$1" <<'PY'
import json, sys
print(json.dumps(sys.argv[1]))
PY
}

resolve_active_profile() {
  local plan_path
  if [ ! -f "$CURRENT_PLAN_POINTER" ]; then
    return 1
  fi
  plan_path=$(tr -d '\r' < "$CURRENT_PLAN_POINTER" | head -n1 | xargs)
  if [ -z "$plan_path" ] || [ ! -f "$plan_path" ]; then
    return 1
  fi
  basename "$(dirname "$(dirname "$plan_path")")"
}

resolve_ref_file() {
  local raw_ref
  raw_ref=$(unquote "$1")
  if [ -z "$raw_ref" ]; then
    return 1
  fi
  if [[ "$raw_ref" = /* ]]; then
    printf '%s\n' "$raw_ref"
  else
    printf '%s\n' "$AI_ROOT/$raw_ref"
  fi
}

collect_profile_refs() {
  local profile_file
  profile_file="$1"
  awk '
    /^projects:[[:space:]]*$/ { in_projects=1; next }
    in_projects && /^[^[:space:]]/ { exit }
    in_projects && /^[[:space:]]+ref:[[:space:]]*/ {
      sub(/^[[:space:]]+ref:[[:space:]]*/, "", $0)
      print $0
    }
  ' "$profile_file" | while IFS= read -r ref; do
    resolve_ref_file "$ref" || true
  done
}

launchers_dir_for_project() {
  local file_path
  file_path="$1"
  printf '%s\n' "$(dirname "$file_path")/launchers"
}

list_project_launcher_files() {
  local file_path launchers_dir
  file_path="$1"
  launchers_dir="$(launchers_dir_for_project "$file_path")"
  if [ ! -d "$launchers_dir" ]; then
    return 0
  fi
  find "$launchers_dir" -mindepth 1 -maxdepth 1 -type f -name '*.yml' | sort
}

mkdir -p "$(dirname "$TASKS_FILE")"

declare -a project_files
active_profile="$(resolve_active_profile || true)"
if [ -n "$active_profile" ] && [ -f "$AI_ROOT/rules/${active_profile}-work-profile.yml" ]; then
  while IFS= read -r file_path; do
    [ -n "$file_path" ] || continue
    if [ -f "$file_path" ]; then
      project_files+=("$file_path")
    fi
  done < <(collect_profile_refs "$AI_ROOT/rules/${active_profile}-work-profile.yml")
fi

if [ ${#project_files[@]} -eq 0 ]; then
  while IFS= read -r file_path; do
    [ -n "$file_path" ] || continue
    project_files+=("$file_path")
  done < <(find "$PROJECTS_DIR" -mindepth 2 -maxdepth 2 -type f -name 'project.yml' | sort)
fi

{
  printf '{\n'
  printf '  "version": "2.0.0",\n'
  printf '  "tasks": [\n'

  task_index=0
  for file_path in "${project_files[@]}"; do
    id=""
    label=""
    local_runner_script=""
    while IFS= read -r line; do
      case "$line" in
        id:*) id=$(unquote "${line#id:}") ;;
        label:*) label=$(unquote "${line#label:}") ;;
        name:*) if [ -z "$label" ]; then label=$(unquote "${line#name:}"); fi ;;
        local_runner_script:*) local_runner_script=$(unquote "${line#local_runner_script:}") ;;
      esac
    done < "$file_path"

    [ -n "$id" ] || continue
    [ -n "$label" ] || label="$id"

    if [ -n "$local_runner_script" ]; then
      task_index=$((task_index + 1))
      if [ "$task_index" -gt 1 ]; then
        printf ',\n'
      fi
      printf '    {\n'
      printf '      "label": %s,\n' "$(json_escape "Start ${label} locally")"
      printf '      "type": "shell",\n'
      printf '      "command": %s,\n' "$(json_escape "./rules/commands/projects/project-local-runner.command.sh")"
      printf '      "args": ["--project", %s],\n' "$(json_escape "$id")"
      printf '      "options": {\n'
      printf '        "cwd": "${workspaceFolder}"\n'
      printf '      },\n'
      printf '      "presentation": {\n'
      printf '        "reveal": "always",\n'
      printf '        "panel": "shared",\n'
      printf '        "focus": true\n'
      printf '      },\n'
      printf '      "problemMatcher": []\n'
      printf '    }'
    fi

    while IFS= read -r launcher_file; do
      [ -n "$launcher_file" ] || continue
      launcher_id=""
      launcher_label=""
      launcher_script=""
      while IFS= read -r line; do
        case "$line" in
          id:*) launcher_id=$(unquote "${line#id:}") ;;
          label:*) launcher_label=$(unquote "${line#label:}") ;;
          title:*) if [ -z "$launcher_label" ]; then launcher_label=$(unquote "${line#title:}"); fi ;;
          script:*) launcher_script=$(unquote "${line#script:}") ;;
        esac
      done < "$launcher_file"

      [ -n "$launcher_id" ] || continue
      [ -n "$launcher_script" ] || continue
      [ -n "$launcher_label" ] || launcher_label="$launcher_id"

      task_index=$((task_index + 1))
      if [ "$task_index" -gt 1 ]; then
        printf ',\n'
      fi
      printf '    {\n'
      printf '      "label": %s,\n' "$(json_escape "${label}: ${launcher_label}")"
      printf '      "type": "shell",\n'
      printf '      "command": %s,\n' "$(json_escape "./${launcher_script}")"
      printf '      "options": {\n'
      printf '        "cwd": "${workspaceFolder}"\n'
      printf '      },\n'
      printf '      "presentation": {\n'
      printf '        "reveal": "always",\n'
      printf '        "panel": "shared",\n'
      printf '        "focus": true\n'
      printf '      },\n'
      printf '      "problemMatcher": []\n'
      printf '    }'
    done < <(list_project_launcher_files "$file_path")
  done

  printf '\n  ]\n'
  printf '}\n'
} > "$TASKS_FILE"

echo "Generated $TASKS_FILE from project registry launcher entries."
