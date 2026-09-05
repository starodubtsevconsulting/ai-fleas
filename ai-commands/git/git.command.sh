#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RULES_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
AI_ROOT="$(cd "$RULES_DIR/.." && pwd)"
PROJECTS_DIR="$RULES_DIR/commands/projects/registry"

usage() {
  cat <<'USAGE'
Usage:
  ./rules/commands/git/git.command.sh clone --project <project-id-or-label> [--dest <path>] [--dry-run] [-- <extra git clone args...>]

Behavior:
  - resolves the project from the committed registry under rules/commands/projects/registry/
  - reads repo_url and path from the matching project.yml
  - defaults the clone destination to the registry path unless --dest overrides it
  - runs git clone <repo_url> <dest> [extra args]
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

ACTION=""
PROJECT_SELECTOR=""
DEST_PATH=""
DRY_RUN=0
EXTRA_ARGS=()

while [ $# -gt 0 ]; do
  case "$1" in
    clone)
      ACTION="clone"
      shift
      ;;
    --project)
      PROJECT_SELECTOR="${2:-}"
      shift 2
      ;;
    --dest)
      DEST_PATH="${2:-}"
      shift 2
      ;;
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    --)
      shift
      while [ $# -gt 0 ]; do
        EXTRA_ARGS+=("$1")
        shift
      done
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      EXTRA_ARGS+=("$1")
      shift
      ;;
  esac
done

if [ "$ACTION" != "clone" ]; then
  echo "Unsupported or missing action."
  usage >&2
  exit 1
fi

if [ -z "$PROJECT_SELECTOR" ]; then
  echo "Missing required --project <project-id-or-label>." >&2
  exit 1
fi

if [ ! -d "$PROJECTS_DIR" ]; then
  echo "Missing committed project registry directory: $PROJECTS_DIR" >&2
  exit 1
fi

find_registry_file() {
  local selector="$1"
  local file_path line id label

  while IFS= read -r file_path; do
    [ -n "$file_path" ] || continue
    id=""
    label=""

    while IFS= read -r line; do
      case "$line" in
        id:*) id=$(unquote "${line#id:}") ;;
        label:*) label=$(unquote "${line#label:}") ;;
        name:*) if [ -z "$label" ]; then label=$(unquote "${line#name:}"); fi ;;
      esac
    done < "$file_path"

    if [ "$selector" = "$id" ] || [ "$selector" = "$label" ]; then
      printf '%s\n' "$file_path"
      return 0
    fi
  done < <(find "$PROJECTS_DIR" -mindepth 2 -maxdepth 2 -type f -name 'project.yml' | sort)

  return 1
}

resolve_repo_url_from_registry() {
  local project_file="$1"
  local raw

  raw=$(awk '/^repo_url:[[:space:]]*/ { sub(/^repo_url:[[:space:]]*/, "", $0); print; exit }' "$project_file")
  unquote "$raw"
}

resolve_project_path_from_registry() {
  local project_file="$1"
  local raw_path

  raw_path=$(awk '/^path:[[:space:]]*/ { sub(/^path:[[:space:]]*/, "", $0); print; exit } /^repo_path:[[:space:]]*/ { sub(/^repo_path:[[:space:]]*/, "", $0); print; exit }' "$project_file")
  raw_path=$(unquote "$raw_path")
  if [ -z "$raw_path" ]; then
    return 1
  fi
  if [[ "$raw_path" = /* ]]; then
    printf '%s\n' "$raw_path"
    return 0
  fi
  (
    cd "$AI_ROOT" 2>/dev/null &&
    cd "$raw_path" 2>/dev/null &&
    pwd
  )
}

registry_file="$(find_registry_file "$PROJECT_SELECTOR" || true)"
if [ -z "$registry_file" ]; then
  echo "Could not resolve a registered project for '$PROJECT_SELECTOR'." >&2
  exit 1
fi

repo_url="$(resolve_repo_url_from_registry "$registry_file" || true)"
if [ -z "$repo_url" ]; then
  echo "Project '$PROJECT_SELECTOR' is registered but missing repo_url in $registry_file" >&2
  exit 1
fi

project_path="$(resolve_project_path_from_registry "$registry_file" || true)"
if [ -z "$project_path" ]; then
  echo "Project '$PROJECT_SELECTOR' is registered but missing path in $registry_file" >&2
  exit 1
fi

if [ -z "$DEST_PATH" ]; then
  DEST_PATH="$project_path"
fi

cmd=(git clone "$repo_url")
if [ -n "$DEST_PATH" ]; then
  cmd+=("$DEST_PATH")
fi
if [ ${#EXTRA_ARGS[@]} -gt 0 ]; then
  cmd+=("${EXTRA_ARGS[@]}")
fi

if [ "$DRY_RUN" -eq 1 ]; then
  printf 'Resolved project: %s\n' "$PROJECT_SELECTOR"
  printf 'Resolved registry_file: %s\n' "$registry_file"
  printf 'Resolved repo_url: %s\n' "$repo_url"
  printf 'Resolved destination: %s\n' "$DEST_PATH"
  printf 'Clone command:'
  for part in "${cmd[@]}"; do
    printf ' %q' "$part"
  done
  printf '\n'
  exit 0
fi

"${cmd[@]}"
