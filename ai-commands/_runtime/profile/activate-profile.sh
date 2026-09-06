#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/profile-runtime.sh"
profile="${WORK_PROFILE_ID:-${AI_WORK_PROFILE_ID:-example}}"; workflow=""; instance=""; command_id=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --profile) profile="${2:-}"; shift 2 ;;
    --workflow) workflow="${2:-}"; shift 2 ;;
    --instance) instance="${2:-}"; shift 2 ;;
    --command) command_id="${2:-}"; shift 2 ;;
    *) echo "Usage: $0 [--profile ID] [--workflow PATH] [--instance ID] [--command ID]" >&2; exit 2 ;;
  esac
done
if [[ -n "$command_id" ]]; then
  ai_profile_activate_command "$profile" "$workflow" "$instance" "$command_id"
else
  ai_profile_activate "$profile" "$workflow" "$instance"
fi
printf 'PROFILE_ID=%s\nWORKFLOW_ID=%s\nWORKFLOW_INSTANCE_ID=%s\nLOGICAL_PROJECT_ID=%s\n' "$WORK_PROFILE_ID" "$AI_WORKFLOW_ID" "$AI_WORKFLOW_INSTANCE_ID" "$AI_LOGICAL_PROJECT_ID"
printf 'AI_AGENT_PLATFORM=%s\n' "$AI_AGENT_PLATFORM"
printf 'AI_AGENT_PLATFORM_CONTRACT=%s\n' "$AI_AGENT_PLATFORM_CONTRACT"
printf 'AI_COMMANDS_ROOT=%s\nAI_WORKFLOWS_ROOT=%s\n' "$AI_COMMANDS_ROOT" "$AI_WORKFLOWS_ROOT"
printf 'AI_GOVERNANCE_RULES_REPOSITORY=%s\nAI_GOVERNANCE_RULES_ROOT=%s\nAI_GOVERNANCE_RULES_SURFACE=%s\n' "$AI_GOVERNANCE_RULES_REPOSITORY" "$AI_GOVERNANCE_RULES_ROOT" "$AI_GOVERNANCE_RULES_SURFACE"
if [[ -n "${AI_COMMAND_CONFIG_PATH:-}" ]]; then printf 'AI_COMMAND_CONFIG_PATH=%s\n' "$AI_COMMAND_CONFIG_PATH"; fi
