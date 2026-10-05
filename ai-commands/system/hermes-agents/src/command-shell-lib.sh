#!/usr/bin/env bash
# Purpose: hold small reusable shell helpers for the Hermes Agents command entrypoint.
# Caller: hermes-agents.command.sh sources this file after declaring command constants.
# Input/output: functions validate input, resolve the Hermes executable, decode base64, and print usage.
# Effects: read-only process/environment inspection; no Hermes lifecycle mutation.

usage() {
  printf '%s\n' \
    'Usage: hermes-agents.command.sh install [--dry-run]' \
    '       hermes-agents.command.sh check-update' \
    '       hermes-agents.command.sh initialize --work-profile ID [--workflow ID] [--project ID] [--instance SLUG] [--connection NAME]' \
    '                               [--agent-instructions FILE] [setup overrides]' \
    '       hermes-agents.command.sh reinitialize --work-profile ID [--workflow ID] [--project ID] [--instance SLUG]' \
    '                               --confirm-reinitialize [--agent-instructions FILE] [setup overrides]' \
    '       hermes-agents.command.sh reconcile --work-profile ID [--workflow ID] [--project ID] [--instance SLUG]' \
    '       hermes-agents.command.sh delete-workflow --work-profile ID [--workflow ID] [--project ID] [--instance SLUG] --confirm-delete' \
    '       hermes-agents.command.sh list' \
    '       hermes-agents.command.sh show PROFILE' \
    '       hermes-agents.command.sh status PROFILE' \
    '       hermes-agents.command.sh connection status|check|switch --work-profile ID --workflow ID [--instance SLUG] [--connection NAME]' \
    '       hermes-agents.command.sh delete PROFILE --confirm-delete' \
    '       hermes-agents.command.sh initialize-system --work-profile ID [--instance SLUG] [--connection NAME] [--watch-group ID]... [--every DURATION]' \
    '       hermes-agents.command.sh reinitialize-system --work-profile ID [--instance SLUG] --confirm-reinitialize [--connection NAME] [--watch-group ID]... [--every DURATION]' \
    '       hermes-agents.command.sh status-system --work-profile ID [--instance SLUG]'
}

resolve_hermes() {
  if [[ -n "${HERMES_BIN:-}" && -x "${HERMES_BIN}" ]]; then
    printf '%s\n' "${HERMES_BIN}"
  elif command -v hermes >/dev/null 2>&1; then
    command -v hermes
  elif [[ -x "${HOME}/.local/bin/hermes" ]]; then
    printf '%s\n' "${HOME}/.local/bin/hermes"
  else
    printf '%s\n' 'HERMES_CLI_MISSING: Hermes CLI was not found.' >&2
    return 1
  fi
}

validate_profile() {
  [[ "$1" =~ ^[a-z0-9][a-z0-9_-]*$ ]] || {
    printf '%s\n' 'HERMES_INVALID_INPUT: unsafe or empty profile ID.' >&2
    return 2
  }
}

decode_base64() {
  BASE64_VALUE="$1" python3 -c 'import base64, os; print(base64.b64decode(os.environ["BASE64_VALUE"], validate=True).decode("utf-8"), end="")'
}
