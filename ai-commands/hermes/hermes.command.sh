#!/usr/bin/env bash
set -euo pipefail

readonly COMMAND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly REPOSITORY_ROOT="$(cd "${COMMAND_DIR}/../.." && pwd)"
readonly SETUP_SCRIPT="${REPOSITORY_ROOT}/ai-launcher/scripts/hermes/setup-sx10-coder.sh"
readonly PROFILE_ROOT="${REPOSITORY_ROOT}/ai-profile"
readonly PROFILE_RESOLVER="${COMMAND_DIR}/resolve-profile-scope.mjs"
readonly DEFAULT_MANAGED_PROFILE='sx10-coder'

usage() {
  printf '%s\n' \
    'Usage: hermes.command.sh setup --work-profile ID [--workflow ID] [--project ID] [--instance SLUG]' \
    '                               [--agent-instructions FILE] [setup overrides]' \
    '       hermes.command.sh list' \
    '       hermes.command.sh show PROFILE' \
    '       hermes.command.sh status [PROFILE]' \
    '       hermes.command.sh delete PROFILE --confirm-delete'
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

action="${1:-}"
[[ -n "${action}" ]] || { usage >&2; exit 2; }
shift

case "${action}" in
  setup)
    [[ -x "${SETUP_SCRIPT}" ]] || { printf 'Setup script is not executable: %s\n' "${SETUP_SCRIPT}" >&2; exit 1; }
    work_profile="${WORK_PROFILE_ID:-}"
    workflow=''
    project=''
    instance=''
    agent_instructions=''
    setup_args=()
    while (($#)); do
      case "$1" in
        --work-profile)
          [[ $# -ge 2 ]] || { usage >&2; exit 2; }
          work_profile="$2"; shift 2
          ;;
        --workflow)
          [[ $# -ge 2 ]] || { usage >&2; exit 2; }
          workflow="$2"; shift 2
          ;;
        --project)
          [[ $# -ge 2 ]] || { usage >&2; exit 2; }
          project="$2"; shift 2
          ;;
        --instance)
          [[ $# -ge 2 ]] || { usage >&2; exit 2; }
          instance="$2"; shift 2
          ;;
        --agent-instructions)
          [[ $# -ge 2 ]] || { usage >&2; exit 2; }
          agent_instructions="$2"; shift 2
          ;;
        *)
          setup_args+=("$1"); shift
          ;;
      esac
    done
    if [[ ${#setup_args[@]} -eq 1 && ( "${setup_args[0]}" == '-h' || "${setup_args[0]}" == '--help' ) ]]; then
      "${SETUP_SCRIPT}" "${setup_args[@]}"
      exit 0
    fi
    [[ -n "${work_profile}" ]] || {
      printf '%s\n' 'HERMES_PROFILE_SCOPE_INVALID: use --work-profile or set WORK_PROFILE_ID.' >&2
      exit 2
    }
    scope="$(node "${PROFILE_RESOLVER}" "${PROFILE_ROOT}" "${work_profile}" "${workflow}" "${project}")"
    IFS=$'\t' read -r resolved_profile resolved_workflow resolved_project resolved_provider resolved_provider_label resolved_endpoint resolved_model resolved_workspace resolved_agent_instructions <<<"${scope}"
    if [[ -n "${agent_instructions}" ]]; then
      [[ "${agent_instructions}" == /* && -f "${agent_instructions}" ]] || {
        printf '%s\n' 'HERMES_PROFILE_SCOPE_INVALID: --agent-instructions must be an existing absolute file.' >&2
        exit 2
      }
      resolved_agent_instructions="${agent_instructions}"
    fi
    if [[ -n "${instance}" ]]; then validate_profile "${instance}"; fi
    derived_hermes_profile="${resolved_profile}-${resolved_workflow}-${resolved_project}${instance:+-${instance}}"
    export HERMES_WORK_PROFILE="${resolved_profile}"
    export HERMES_WORKFLOW="${resolved_workflow}"
    export HERMES_PROJECT="${resolved_project}"
    export HERMES_SX10_PROVIDER_ID="${resolved_provider}"
    export HERMES_SX10_PROVIDER_LABEL="${resolved_provider_label}"
    export HERMES_SX10_ENDPOINT="${resolved_endpoint}"
    export HERMES_SX10_MODEL="${resolved_model}"
    export HERMES_SX10_WORKSPACE="${resolved_workspace}"
    export HERMES_SX10_PROFILE="${derived_hermes_profile}"
    export HERMES_AGENT_INSTRUCTIONS_PATH="${resolved_agent_instructions}"
    if [[ ${#setup_args[@]} -eq 0 ]]; then
      "${SETUP_SCRIPT}"
    else
      "${SETUP_SCRIPT}" "${setup_args[@]}"
    fi
    ;;
  list)
    [[ $# -eq 0 ]] || { usage >&2; exit 2; }
    hermes_bin="$(resolve_hermes)"
    "${hermes_bin}" profile list
    ;;
  show)
    [[ $# -eq 1 ]] || { usage >&2; exit 2; }
    validate_profile "$1"
    hermes_bin="$(resolve_hermes)"
    "${hermes_bin}" profile show "$1"
    ;;
  status)
    [[ $# -le 1 ]] || { usage >&2; exit 2; }
    profile="${1:-${DEFAULT_MANAGED_PROFILE}}"
    validate_profile "${profile}"
    hermes_bin="$(resolve_hermes)"
    provider="$("${hermes_bin}" -p "${profile}" config get model.provider)"
    model="$("${hermes_bin}" -p "${profile}" config get model.default)"
    endpoint="$("${hermes_bin}" -p "${profile}" config get model.base_url)"
    workspace="$("${hermes_bin}" -p "${profile}" config get terminal.cwd)"
    [[ "${endpoint}" =~ ^https?://[^[:space:]]+$ ]] || {
      printf '%s\n' 'HERMES_MODEL_UNAVAILABLE: profile has no valid HTTP(S) model endpoint.' >&2
      exit 1
    }
    models_json="$(curl --fail --silent --show-error --max-time 10 "${endpoint%/}/models")" || {
      printf '%s\n' 'HERMES_MODEL_UNAVAILABLE: configured model endpoint is unreachable.' >&2
      exit 1
    }
    MODEL_ID="${model}" python3 -c '
import json
import os
import sys

payload = json.load(sys.stdin)
expected = os.environ["MODEL_ID"]
items = [*payload.get("data", []), *payload.get("models", [])]
available = {
    str(item.get("id") or item.get("model") or item.get("name") or "")
    for item in items
    if isinstance(item, dict)
}
if expected not in available:
    raise SystemExit(f"HERMES_MODEL_UNAVAILABLE: endpoint does not advertise {expected}")
' <<<"${models_json}"
    printf 'HERMES_READY\nProfile: %s\nProvider: %s\nModel: %s\nEndpoint: %s\nWorkspace: %s\n' \
      "${profile}" "${provider}" "${model}" "${endpoint%/}" "${workspace}"
    ;;
  delete)
    [[ $# -eq 2 && "$2" == '--confirm-delete' ]] || {
      printf '%s\n' 'HERMES_DELETE_CONFIRMATION_REQUIRED: use delete PROFILE --confirm-delete.' >&2
      exit 2
    }
    profile="$1"
    validate_profile "${profile}"
    [[ "${profile}" != 'default' ]] || {
      printf '%s\n' 'HERMES_DEFAULT_PROTECTED: the required default profile cannot be deleted.' >&2
      exit 2
    }
    hermes_bin="$(resolve_hermes)"
    "${hermes_bin}" profile delete "${profile}" --yes
    if "${hermes_bin}" profile list | awk 'NR > 1 { print $1 }' | grep -Fx -- "${profile}" >/dev/null; then
      printf 'Profile still exists after deletion: %s\n' "${profile}" >&2
      exit 1
    fi
    printf 'HERMES_PROFILE_DELETED: %s\n' "${profile}"
    ;;
  -h|--help|help)
    usage
    ;;
  *)
    printf 'HERMES_INVALID_INPUT: unsupported action: %s\n' "${action}" >&2
    usage >&2
    exit 2
    ;;
esac
