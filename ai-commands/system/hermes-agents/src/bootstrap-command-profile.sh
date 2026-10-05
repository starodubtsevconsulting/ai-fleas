#!/usr/bin/env bash
# Purpose: expose explicit Hermes lifecycle selections to the shared profile guard.
# Caller: hermes-agents.command.sh sources this file before parsing its public action.
# Input/output: reads the caller's argv, exports profile/workflow selectors, and runs the guard.
# Effects: environment exports and validation only; it does not create, update, or delete profiles.

if [[ "${1:-}" == initialize || "${1:-}" == initialize-system || "${1:-}" == reinitialize-system || "${1:-}" == status-system || "${1:-}" == reinitialize || "${1:-}" == re-init || "${1:-}" == reconcile || "${1:-}" == configure || "${1:-}" == setup || "${1:-}" == delete-workflow || "${1:-}" == connection ]]; then
  bootstrap_args=("$@")
  for ((bootstrap_index=1; bootstrap_index<${#bootstrap_args[@]}; bootstrap_index++)); do
    case "${bootstrap_args[bootstrap_index]}" in
      --work-profile)
        ((bootstrap_index + 1 < ${#bootstrap_args[@]})) || break
        export WORK_PROFILE_ID="${bootstrap_args[bootstrap_index + 1]}"
        export AI_WORK_PROFILE_ID="${WORK_PROFILE_ID}"
        bootstrap_index=$((bootstrap_index + 1))
        ;;
      --workflow)
        ((bootstrap_index + 1 < ${#bootstrap_args[@]})) || break
        bootstrap_workflow="${bootstrap_args[bootstrap_index + 1]}"
        [[ "${bootstrap_workflow}" == *.workflow.md ]] || bootstrap_workflow="${bootstrap_workflow}.workflow.md"
        export AI_FLOW_WORKFLOW="${bootstrap_workflow}"
        bootstrap_index=$((bootstrap_index + 1))
        ;;
    esac
  done
fi

source "$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)/_runtime/profile/command-profile.guard.sh"
case "${1:-}" in
  initialize-system|reinitialize-system|status-system) ai_command_require_profile_only "hermes-agents" || exit $? ;;
  *) ai_command_require_profile "hermes-agents" || exit $? ;;
esac
