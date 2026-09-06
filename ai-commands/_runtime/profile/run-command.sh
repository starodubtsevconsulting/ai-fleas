#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
source "$SCRIPT_DIR/profile-runtime.sh"

profile="${WORK_PROFILE_ID:-${AI_WORK_PROFILE_ID:-example}}"
workflow=""
instance=""
command_id=""
entrypoint=""
command_args=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --profile) profile="${2:-}"; shift 2 ;;
    --workflow) workflow="${2:-}"; shift 2 ;;
    --instance) instance="${2:-}"; shift 2 ;;
    --command) command_id="${2:-}"; shift 2 ;;
    --entrypoint) entrypoint="${2:-}"; shift 2 ;;
    --) shift; command_args=("$@"); break ;;
    *) echo "Unknown argument: $1" >&2; exit 2 ;;
  esac
done

[[ -n "$command_id" && -n "$entrypoint" ]] || {
  echo 'Usage: run-command.sh [--profile ID] [--workflow PATH] --command ID --entrypoint RELATIVE_PATH [-- ARGS...]' >&2
  exit 2
}
ai_profile_safe_relative_path "$entrypoint" || { ai_profile_error 'unsafe command entrypoint'; exit 1; }
[[ "$entrypoint" == "$command_id/"* ]] || { ai_profile_error 'entrypoint must belong to selected command'; exit 1; }

ai_profile_activate_command "$profile" "$workflow" "$instance" "$command_id"
resolved_entrypoint="$AI_COMMANDS_ROOT/$entrypoint"
[[ -f "$resolved_entrypoint" ]] || { ai_profile_error "missing command entrypoint: $entrypoint"; exit 1; }
case "$resolved_entrypoint" in
  *.mjs) exec node "$resolved_entrypoint" ${command_args[@]+"${command_args[@]}"} ;;
  *)
    [[ -x "$resolved_entrypoint" ]] || { ai_profile_error "non-executable command entrypoint: $entrypoint"; exit 1; }
    exec "$resolved_entrypoint" ${command_args[@]+"${command_args[@]}"}
    ;;
esac
