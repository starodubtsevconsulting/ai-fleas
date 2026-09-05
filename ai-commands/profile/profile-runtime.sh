#!/usr/bin/env bash

ai_profile_error() { printf 'PROFILE_BLOCKED: %s\n' "$*" >&2; return 1; }
ai_profile_safe_id() { [[ "${1:-}" =~ ^[A-Za-z0-9][A-Za-z0-9._-]*$ ]]; }
ai_profile_safe_relative_path() { [[ "${1:-}" =~ ^[A-Za-z0-9][A-Za-z0-9._/-]*$ && "$1" != *'..'* && "$1" != /* ]]; }

ai_profile_root() {
  local source_dir
  source_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)" || return 1
  printf '%s\n' "${AI_CONFIG_PROJECT:-$source_dir}"
}

ai_profile_file() {
  local profile_id="${1:-${WORK_PROFILE_ID:-${AI_WORK_PROFILE_ID:-sc}}}" root
  ai_profile_safe_id "$profile_id" || { ai_profile_error "unsafe profile ID: $profile_id"; return 1; }
  root="$(ai_profile_root)" || return 1
  printf '%s/ai-profile/%s/%s-work-profile.yml\n' "$root" "$profile_id" "$profile_id"
}

ai_profile_scalar() {
  awk -F: -v wanted="$2" '$1 == wanted { sub(/^[^:]+:[[:space:]]*/, "", $0); print; exit }' "$1"
}

ai_profile_list() {
  awk -v wanted="$2" '
    $0 == wanted ":" { in_list=1; next }
    in_list && /^[^[:space:]]/ { exit }
    in_list && /^  -[[:space:]]*/ { value=$0; sub(/^  -[[:space:]]*/, "", value); print value }
  ' "$1"
}

ai_profile_has_workflow() {
  awk -v wanted="$2" '
    /^workflows:/ { in_workflows=1; next }
    in_workflows && /^[^[:space:]]/ { exit }
    in_workflows && /^  - path:[[:space:]]*/ {
      value=$0; sub(/^  - path:[[:space:]]*/, "", value); if (value == wanted) found=1
    }
    END { exit(found ? 0 : 1) }
  ' "$1"
}

ai_profile_command_config() {
  awk -v wanted="$2" '
    /^commands:/ { in_commands=1; next }
    in_commands && /^[^[:space:]]/ { exit }
    in_commands && /^  - id:[[:space:]]*/ {
      value=$0; sub(/^  - id:[[:space:]]*/, "", value); selected=(value == wanted); next
    }
    in_commands && selected && /^    config:[[:space:]]*/ {
      value=$0; sub(/^    config:[[:space:]]*/, "", value); print value; exit
    }
  ' "$1"
}

ai_profile_resolve_path() {
  local base="$1" relative="$2" parent
  case "$relative" in /*) printf '%s\n' "$relative"; return 0 ;; esac
  parent="$(cd "$base/$(dirname "$relative")" 2>/dev/null && pwd -P)" || return 1
  printf '%s/%s\n' "$parent" "$(basename "$relative")"
}

ai_profile_activate() {
  local requested_profile="${1:-${WORK_PROFILE_ID:-${AI_WORK_PROFILE_ID:-sc}}}"
  local requested_workflow="${2:-${AI_FLOW_WORKFLOW:-${WORKFLOW_NAME:-}}}"
  local requested_instance="${3:-${AI_WORKFLOW_INSTANCE_ID:-}}"
  local profile_file profile_dir commands_ref workflows_ref governance_repository governance_surface workflow_id path
  local -a governance_paths
  profile_file="$(ai_profile_file "$requested_profile")" || return 1
  [[ -f "$profile_file" ]] || { ai_profile_error "unknown profile: $requested_profile"; return 1; }
  [[ "$(ai_profile_scalar "$profile_file" name)" == "$requested_profile" ]] || { ai_profile_error 'profile name mismatch'; return 1; }
  [[ -n "$requested_workflow" ]] || requested_workflow="$(ai_profile_scalar "$profile_file" default_workflow)"
  ai_profile_has_workflow "$profile_file" "$requested_workflow" || { ai_profile_error "workflow is not registered: $requested_workflow"; return 1; }
  profile_dir="$(dirname "$profile_file")"
  commands_ref="$(ai_profile_scalar "$profile_file" ai_commands_root)"
  workflows_ref="$(ai_profile_scalar "$profile_file" ai_workflows_root)"
  governance_repository="$(ai_profile_scalar "$profile_file" governance_rules_repository)"
  governance_surface="$(ai_profile_list "$profile_file" governance_rules_surface | paste -sd: -)"
  AI_COMMANDS_ROOT="$(ai_profile_resolve_path "$profile_dir" "$commands_ref")" || return 1
  AI_WORKFLOWS_ROOT="$(ai_profile_resolve_path "$profile_dir" "$workflows_ref")" || return 1
  ai_profile_safe_id "$governance_repository" || { ai_profile_error 'missing or unsafe governance repository'; return 1; }
  [[ -n "$governance_surface" ]] || { ai_profile_error 'missing governance surface'; return 1; }
  local IFS=:
  read -r -a governance_paths <<< "$governance_surface"
  for path in "${governance_paths[@]}"; do
    ai_profile_safe_relative_path "$path" || { ai_profile_error "unsafe governance surface: $path"; return 1; }
    [[ -e "$(ai_profile_root)/$path" ]] || { ai_profile_error "missing governance surface: $path"; return 1; }
  done
  workflow_id="$(basename "$requested_workflow" .workflow.md)"
  [[ -z "$requested_instance" ]] || ai_profile_safe_id "$requested_instance" || { ai_profile_error "unsafe workflow instance ID: $requested_instance"; return 1; }
  WORK_PROFILE_ID="$requested_profile"; AI_WORK_PROFILE_ID="$requested_profile"; AI_PROFILE_FILE="$profile_file"
  AI_FLOW_WORKFLOW="$requested_workflow"; AI_WORKFLOW_ID="$workflow_id"; AI_WORKFLOW_INSTANCE_ID="$requested_instance"
  AI_LOGICAL_PROJECT_ID="$requested_profile-$workflow_id${requested_instance:+-$requested_instance}"
  AI_GOVERNANCE_RULES_REPOSITORY="$governance_repository"; AI_GOVERNANCE_RULES_ROOT="$(ai_profile_root)"
  AI_GOVERNANCE_RULES_SURFACE="$governance_surface"
  export WORK_PROFILE_ID AI_WORK_PROFILE_ID AI_PROFILE_FILE AI_COMMANDS_ROOT AI_WORKFLOWS_ROOT
  export AI_FLOW_WORKFLOW AI_WORKFLOW_ID AI_WORKFLOW_INSTANCE_ID AI_LOGICAL_PROJECT_ID
  export AI_GOVERNANCE_RULES_REPOSITORY AI_GOVERNANCE_RULES_ROOT AI_GOVERNANCE_RULES_SURFACE
}

ai_profile_command_config_path() {
  local config_ref
  config_ref="$(ai_profile_command_config "$AI_PROFILE_FILE" "$1")"
  [[ -n "$config_ref" ]] || { ai_profile_error "command is not bound: $1"; return 1; }
  ai_profile_resolve_path "$(dirname "$AI_PROFILE_FILE")" "$config_ref"
}
