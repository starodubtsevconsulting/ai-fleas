#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
source "$SCRIPT_DIR/profile-runtime.sh"

profile="${WORK_PROFILE_ID:-${AI_WORK_PROFILE_ID:-example}}"
workflow=""
instance=""
command_id=""
agent_platform=""
entrypoint=""
command_args=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --profile) profile="${2:-}"; shift 2 ;;
    --workflow) workflow="${2:-}"; shift 2 ;;
    --instance) instance="${2:-}"; shift 2 ;;
    --command) command_id="${2:-}"; shift 2 ;;
    --agent-platform) agent_platform="${2:-}"; shift 2 ;;
    --entrypoint) entrypoint="${2:-}"; shift 2 ;;
    --) shift; command_args=("$@"); break ;;
    *) echo "Unknown argument: $1" >&2; exit 2 ;;
  esac
done

[[ -n "$command_id" && -n "$entrypoint" ]] || {
  echo 'Usage: run-command.sh [--profile ID] [--workflow PATH] [--agent-platform ID] --command ID --entrypoint RELATIVE_PATH [-- ARGS...]' >&2
  exit 2
}
ai_profile_safe_relative_path "$entrypoint" || { ai_profile_error 'unsafe command entrypoint'; exit 1; }
[[ "$entrypoint" == "$command_id/"* ]] || { ai_profile_error 'entrypoint must belong to selected command'; exit 1; }

resolve_command_path() {
  local logical_path="$1"
  local direct="$AI_COMMANDS_ROOT/$logical_path"
  local candidate
  local matches=()

  if [[ -f "$direct" ]]; then
    printf '%s\n' "$direct"
    return 0
  fi

  while IFS= read -r candidate; do
    matches+=("$candidate")
  done < <(find "$AI_COMMANDS_ROOT" -mindepth 3 -maxdepth 3 -type f -path "*/$logical_path" 2>/dev/null | sort)

  if [[ ${#matches[@]} -eq 1 ]]; then
    printf '%s\n' "${matches[0]}"
    return 0
  fi

  if [[ ${#matches[@]} -gt 1 ]]; then
    ai_profile_error "ambiguous categorized command path: $logical_path"
    return 1
  fi

  return 1
}

resolve_command_manifest() {
  local id="$1"
  local direct="$AI_COMMANDS_ROOT/$id/$id.command.yml"
  local candidate
  local matches=()

  if [[ -f "$direct" ]]; then
    printf '%s\n' "$direct"
    return 0
  fi

  while IFS= read -r candidate; do
    matches+=("$candidate")
  done < <(find "$AI_COMMANDS_ROOT" -mindepth 3 -maxdepth 3 -type f -path "*/$id/$id.command.yml" 2>/dev/null | sort)

  if [[ ${#matches[@]} -eq 1 ]]; then
    printf '%s\n' "${matches[0]}"
    return 0
  fi

  if [[ ${#matches[@]} -gt 1 ]]; then
    ai_profile_error "ambiguous categorized command id: $id"
    return 1
  fi

  return 1
}

ai_profile_activate_command "$profile" "$workflow" "$instance" "$command_id" "$agent_platform"
resolved_entrypoint="$(resolve_command_path "$entrypoint")" || { ai_profile_error "missing command entrypoint: $entrypoint"; exit 1; }

entry_dir="$(dirname "$resolved_entrypoint")"
entry_file="$(basename "$resolved_entrypoint")"
entry_base="${entry_file%%.command.*}"
if [[ "$entry_base" == "$entry_file" ]]; then
  entry_base="${entry_file%.*}"
fi
manifest="$entry_dir/$entry_base.command.yml"
if [[ ! -f "$manifest" ]]; then
  fallback_manifest="$(resolve_command_manifest "$command_id" || true)"
  [[ -n "$fallback_manifest" && -f "$fallback_manifest" ]] && manifest="$fallback_manifest"
fi
bash "$SCRIPT_DIR/ai-powered-command.guard.sh" "$manifest"

case "$resolved_entrypoint" in
  *.mjs) exec node "$resolved_entrypoint" ${command_args[@]+"${command_args[@]}"} ;;
  *)
    [[ -x "$resolved_entrypoint" ]] || { ai_profile_error "non-executable command entrypoint: $entrypoint"; exit 1; }
    exec "$resolved_entrypoint" ${command_args[@]+"${command_args[@]}"}
    ;;
esac
