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
    "$command_id" \
    "${AI_AGENT_PLATFORM:-}" || return
}

ai_command_require_profile_only() {
  local command_id="$1" guard_dir profile_id profile_file profile_dir commands_ref config_ref
  guard_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
  source "$guard_dir/profile-runtime.sh"

  profile_id="${AI_WORK_PROFILE_ID:-${WORK_PROFILE_ID:-}}"
  [[ -n "$profile_id" ]] || {
    printf 'PROFILE_REQUIRED: select an AI Profile before running command %s\n' "$command_id" >&2
    return 64
  }
  ai_profile_safe_id "$profile_id" || { ai_profile_error 'unsafe profile ID'; return 1; }
  profile_file="$(ai_profile_file "$profile_id")" || return 1
  [[ -f "$profile_file" ]] || { ai_profile_error "unknown profile: $profile_id"; return 1; }
  [[ "$(ai_profile_scalar "$profile_file" name)" == "$profile_id" ]] || { ai_profile_error 'profile name mismatch'; return 1; }

  profile_dir="$(dirname "$profile_file")"
  commands_ref="$(ai_profile_scalar "$profile_file" ai_commands_root)"
  AI_COMMANDS_ROOT="$(ai_profile_resolve_path "$profile_dir" "$commands_ref")" || return 1
  config_ref="$(ai_profile_command_config "$profile_file" "$command_id")"
  [[ -n "$config_ref" ]] || { ai_profile_error "command is not bound: $command_id"; return 1; }
  AI_COMMAND_CONFIG_PATH="$(ai_profile_resolve_path "$profile_dir" "$config_ref")" || return 1
  [[ -f "$AI_COMMAND_CONFIG_PATH" ]] || { ai_profile_error "missing profile-owned command config: $command_id"; return 1; }

  WORK_PROFILE_ID="$profile_id"; AI_WORK_PROFILE_ID="$profile_id"; AI_PROFILE_FILE="$profile_file"
  export WORK_PROFILE_ID AI_WORK_PROFILE_ID AI_PROFILE_FILE AI_COMMANDS_ROOT AI_COMMAND_CONFIG_PATH
}
