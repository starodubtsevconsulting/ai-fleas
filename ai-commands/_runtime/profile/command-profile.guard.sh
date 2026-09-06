#!/usr/bin/env bash

ai_command_require_profile() {
  local command_id="$1" guard_dir
  guard_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
  source "$guard_dir/profile-runtime.sh"

  [[ -n "${AI_WORK_PROFILE_ID:-${WORK_PROFILE_ID:-}}" ]] || {
    printf 'PROFILE_REQUIRED: select an AI Profile before running command %s\n' "$command_id" >&2
    return 64
  }
  [[ -n "${AI_FLOW_WORKFLOW:-}" ]] || {
    printf 'PROFILE_REQUIRED: select a workflow before running command %s\n' "$command_id" >&2
    return 64
  }

  ai_profile_activate_command \
    "${AI_WORK_PROFILE_ID:-$WORK_PROFILE_ID}" \
    "$AI_FLOW_WORKFLOW" \
    "${AI_WORKFLOW_INSTANCE_ID:-}" \
    "$command_id" || return
}
