#!/usr/bin/env bash
set -euo pipefail
# ai_command_require_profile runs immediately after explicit lifecycle selections are bootstrapped below.

# Initialization and reconciliation are profile bootstrap operations, so expose their explicit
# selections to the common command guard before normal argument processing.
if [[ "${1:-}" == initialize || "${1:-}" == reinitialize || "${1:-}" == re-init || "${1:-}" == reconcile || "${1:-}" == configure || "${1:-}" == setup || "${1:-}" == delete-workflow ]]; then
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
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)/_runtime/profile/command-profile.guard.sh"
ai_command_require_profile "hermes-agents" || exit $?

readonly COMMAND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly REPOSITORY_ROOT="$(cd "${COMMAND_DIR}/../.." && pwd)"
readonly SETUP_SCRIPT="${COMMAND_DIR}/setup-hermes-profile.sh"
readonly INSTALL_SCRIPT="${COMMAND_DIR}/install-agents.sh"
readonly PROFILE_ROOT="${AI_PROFILE_ROOT:-$(dirname "$(dirname "${AI_PROFILE_FILE}")")}"
readonly PROFILE_RESOLVER="${COMMAND_DIR}/resolve-profile-scope.mjs"
readonly GROUP_CONFIGURATOR="${HERMES_GROUP_CONFIGURATOR:-${COMMAND_DIR}/configure-hermes-group.py}"
readonly PYTHON_BIN="${HERMES_PYTHON_BIN:-${HERMES_INSTALL_ROOT:-${HOME}/.hermes/hermes-agent}/venv/bin/python}"
readonly HERMES_UPSTREAM_REPOSITORY="${HERMES_UPSTREAM_REPOSITORY:-https://github.com/NousResearch/hermes-agent.git}"

usage() {
  printf '%s\n' \
    'Usage: hermes-agents.command.sh install [--dry-run]' \
    '       hermes-agents.command.sh check-update' \
    '       hermes-agents.command.sh initialize --work-profile ID [--workflow ID] [--project ID] [--instance SLUG]' \
    '                               [--agent-instructions FILE] [setup overrides]' \
    '       hermes-agents.command.sh reinitialize --work-profile ID [--workflow ID] [--project ID] [--instance SLUG]' \
    '                               --confirm-reinitialize [--agent-instructions FILE] [setup overrides]' \
    '       hermes-agents.command.sh reconcile --work-profile ID [--workflow ID] [--project ID] [--instance SLUG]' \
    '       hermes-agents.command.sh delete-workflow --work-profile ID [--workflow ID] [--project ID] [--instance SLUG] --confirm-delete' \
    '       hermes-agents.command.sh list' \
    '       hermes-agents.command.sh show PROFILE' \
    '       hermes-agents.command.sh status PROFILE' \
    '       hermes-agents.command.sh delete PROFILE --confirm-delete'
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
  check-update)
    [[ $# -eq 0 ]] || { usage >&2; exit 2; }
    hermes_bin="$(resolve_hermes)"
    installed_line="$("${hermes_bin}" --version 2>/dev/null | sed -n '1p')"
    installed_tag="$(sed -nE 's/^Hermes Agent v[^ ]+ \(([0-9]{4}\.[0-9]+\.[0-9]+(\.[0-9]+)?)\).*/v\1/p' <<<"${installed_line}")"
    [[ -n "${installed_tag}" ]] || {
      printf 'HERMES_UPDATE_CHECK_FAILED: could not parse installed version: %s\n' "${installed_line}" >&2
      exit 1
    }
    remote_refs="$(git ls-remote --tags --refs "${HERMES_UPSTREAM_REPOSITORY}" 'v*' 2>/dev/null)" || {
      printf '%s\n' 'HERMES_UPDATE_CHECK_FAILED: stable release metadata is unavailable; update status is unknown.' >&2
      exit 1
    }
    latest_tag="$(awk '{ sub("refs/tags/", "", $2); print $2 }' <<<"${remote_refs}" | grep -E '^v[0-9]{4}\.[0-9]+\.[0-9]+(\.[0-9]+)?$' | sort -V | tail -n 1)"
    [[ -n "${latest_tag}" ]] || {
      printf '%s\n' 'HERMES_UPDATE_CHECK_FAILED: upstream returned no stable date-version tags.' >&2
      exit 1
    }
    supported_tag="$(sed -nE "s/^readonly HERMES_VERSION='.*\(([0-9]{4}\.[0-9]+\.[0-9]+(\.[0-9]+)?)\)'/v\1/p" "${INSTALL_SCRIPT}")"
    newest="$(printf '%s\n%s\n' "${installed_tag}" "${latest_tag}" | sort -V | tail -n 1)"
    printf 'Installed: %s\nLatest stable: %s\nSupported installer pin: %s\n' "${installed_tag}" "${latest_tag}" "${supported_tag:-unknown}"
    if [[ "${installed_tag}" == "${latest_tag}" || "${newest}" == "${installed_tag}" ]]; then
      printf '%s\n' 'HERMES_UP_TO_DATE: no stable upgrade is currently recommended.'
    elif [[ "${supported_tag}" == "${latest_tag}" ]]; then
      printf '%s\n' 'HERMES_UPDATE_AVAILABLE: review the release, then run hermes-agents.command.sh install to apply the supported stable upgrade.'
    else
      printf '%s\n' 'HERMES_UPDATE_AVAILABLE: a newer stable release exists, but the public installer pin must be reviewed and updated before installation.'
    fi
    ;;
  install)
    [[ -x "${INSTALL_SCRIPT}" ]] || { printf 'Installer is not executable: %s\n' "${INSTALL_SCRIPT}" >&2; exit 1; }
    "${INSTALL_SCRIPT}" "$@"
    ;;
  reinitialize|re-init)
    confirmed=false
    delete_args=()
    initialize_args=()
    while (($#)); do
      case "$1" in
        --work-profile|--workflow|--project|--instance)
          [[ $# -ge 2 ]] || { usage >&2; exit 2; }
          delete_args+=("$1" "$2")
          initialize_args+=("$1" "$2")
          shift 2
          ;;
        --agent-instructions)
          [[ $# -ge 2 ]] || { usage >&2; exit 2; }
          initialize_args+=("$1" "$2")
          shift 2
          ;;
        --confirm-reinitialize)
          confirmed=true
          shift
          ;;
        *)
          initialize_args+=("$1")
          shift
          ;;
      esac
    done
    [[ "${confirmed}" == true ]] || {
      printf '%s\n' 'HERMES_REINITIALIZE_CONFIRMATION_REQUIRED: use reinitialize ... --confirm-reinitialize.' >&2
      exit 2
    }
    "$0" delete-workflow "${delete_args[@]}" --confirm-delete
    sync_seconds="${HERMES_REINITIALIZE_SYNC_SECONDS:-5}"
    [[ "${sync_seconds}" =~ ^([0-9]|[12][0-9]|30)$ ]] || {
      printf '%s\n' 'HERMES_REINITIALIZE_SYNC_INVALID: HERMES_REINITIALIZE_SYNC_SECONDS must be an integer from 0 through 30.' >&2
      exit 2
    }
    if ((sync_seconds > 0)); then
      printf 'HERMES_REINITIALIZE_SYNC: waiting %s seconds for Hermes Desktop to retire the deleted room.\n' "${sync_seconds}"
      sleep "${sync_seconds}"
    fi
    "$0" initialize "${initialize_args[@]}"
    ;;
  initialize|reconcile|configure|setup)
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
    IFS=$'\t' read -r resolved_profile resolved_workflow resolved_project resolved_provider resolved_provider_label resolved_endpoint resolved_model resolved_context_window resolved_compression_threshold resolved_compression_target resolved_protect_last_messages resolved_workspace resolved_agent_instructions resolved_commands_root resolved_workflow_instructions resolved_command_ids resolved_role_bindings <<<"${scope}"
    if [[ -n "${agent_instructions}" ]]; then
      [[ "${agent_instructions}" == /* && -f "${agent_instructions}" ]] || {
        printf '%s\n' 'HERMES_PROFILE_SCOPE_INVALID: --agent-instructions must be an existing absolute file.' >&2
        exit 2
      }
      resolved_agent_instructions="${agent_instructions}"
    fi
    if [[ -n "${instance}" ]]; then validate_profile "${instance}"; fi
    derived_group="${resolved_profile}-${resolved_workflow}${instance:+-${instance}}"
    export HERMES_WORK_PROFILE="${resolved_profile}"
    export HERMES_WORKFLOW="${resolved_workflow}"
    export HERMES_PROJECT="${resolved_project}"
    export HERMES_PROVIDER_ID="${resolved_provider}"
    export HERMES_PROVIDER_LABEL="${resolved_provider_label}"
    export HERMES_ENDPOINT="${resolved_endpoint}"
    export HERMES_MODEL="${resolved_model}"
    export HERMES_CONTEXT_LENGTH="${resolved_context_window}"
    export HERMES_COMPRESSION_THRESHOLD="${resolved_compression_threshold}"
    export HERMES_COMPRESSION_TARGET_RATIO="${resolved_compression_target}"
    export HERMES_COMPRESSION_PROTECT_LAST_N="${resolved_protect_last_messages}"
    export HERMES_WORKSPACE="${resolved_workspace}"
    export HERMES_GROUP="${derived_group}"
    export HERMES_AGENT_INSTRUCTIONS_PATH="${resolved_agent_instructions}"
    export HERMES_AI_COMMANDS_ROOT="${resolved_commands_root}"
    export HERMES_WORKFLOW_INSTRUCTIONS_PATH="${resolved_workflow_instructions}"
    export HERMES_WORKFLOW_COMMAND_IDS="${resolved_command_ids}"
    IFS=',' read -r -a role_bindings <<<"${resolved_role_bindings}"
    for role_binding in "${role_bindings[@]}"; do
      IFS=':' read -r role profile_suffix role_provider role_endpoint <<<"${role_binding}"
      [[ -n "${role}" && -n "${profile_suffix}" && -n "${role_provider}" && -n "${role_endpoint}" ]] || {
        printf '%s\n' 'HERMES_PROFILE_SCOPE_INVALID: malformed Hermes role binding.' >&2
        exit 2
      }
      case "${role}" in
        admin) role_title='Admin' ;;
        designer-reviewer) role_title='Designer/Reviewer' ;;
        judge) role_title='Judge' ;;
        manager) role_title='Manager' ;;
        coder) role_title='Coder' ;;
        command-runner) role_title='Command Runner' ;;
        ui-acceptance-tester) role_title='UI Acceptance Tester' ;;
        *) role_title="${role}" ;;
      esac
      export HERMES_PROFILE="${derived_group}-${profile_suffix}"
      export HERMES_ROLE="${role}"
      export HERMES_ROLE_TITLE="${role_title}"
      export HERMES_PROVIDER_ID="${role_provider}"
      export HERMES_PROVIDER_LABEL="${role_provider}"
      export HERMES_ENDPOINT="${role_endpoint}"
      if [[ ${#setup_args[@]} -eq 0 ]]; then
        "${SETUP_SCRIPT}"
      else
        "${SETUP_SCRIPT}" "${setup_args[@]}"
      fi
    done
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
    [[ $# -eq 1 ]] || { usage >&2; exit 2; }
    profile="$1"
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
  delete-workflow)
    work_profile="${WORK_PROFILE_ID:-}"
    workflow=''; project=''; instance=''; confirmed=false
    while (($#)); do
      case "$1" in
        --work-profile) [[ $# -ge 2 ]] || { usage >&2; exit 2; }; work_profile="$2"; shift 2 ;;
        --workflow) [[ $# -ge 2 ]] || { usage >&2; exit 2; }; workflow="$2"; shift 2 ;;
        --project) [[ $# -ge 2 ]] || { usage >&2; exit 2; }; project="$2"; shift 2 ;;
        --instance) [[ $# -ge 2 ]] || { usage >&2; exit 2; }; instance="$2"; shift 2 ;;
        --confirm-delete) confirmed=true; shift ;;
        *) usage >&2; exit 2 ;;
      esac
    done
    [[ "${confirmed}" == true ]] || { printf '%s\n' 'HERMES_DELETE_CONFIRMATION_REQUIRED: use delete-workflow ... --confirm-delete.' >&2; exit 2; }
    [[ -n "${work_profile}" ]] || { printf '%s\n' 'HERMES_PROFILE_SCOPE_INVALID: use --work-profile or set WORK_PROFILE_ID.' >&2; exit 2; }
    scope="$(node "${PROFILE_RESOLVER}" "${PROFILE_ROOT}" "${work_profile}" "${workflow}" "${project}")"
    IFS=$'\t' read -r resolved_profile resolved_workflow resolved_project _ _ _ _ _ _ _ _ _ _ _ _ _ resolved_role_bindings <<<"${scope}"
    if [[ -n "${instance}" ]]; then validate_profile "${instance}"; fi
    group="${resolved_profile}-${resolved_workflow}${instance:+-${instance}}"
    validate_profile "${group}"
    members=()
    IFS=',' read -r -a role_bindings <<<"${resolved_role_bindings}"
    for role_binding in "${role_bindings[@]}"; do
      IFS=':' read -r role suffix role_provider role_endpoint <<<"${role_binding}"
      [[ -n "${role}" && -n "${suffix}" && -n "${role_provider}" && -n "${role_endpoint}" ]] || {
        printf '%s\n' 'HERMES_PROFILE_SCOPE_INVALID: malformed Hermes role binding.' >&2
        exit 2
      }
      member="${group}-${suffix}"
      validate_profile "${member}"
      members+=("${member}")
    done
    configurator_args=("${GROUP_CONFIGURATOR}" --hermes-home "${HERMES_HOME:-${HOME}/.hermes}" --delete-group --group "${group}")
    for member in "${members[@]}"; do configurator_args+=(--member "${member}"); done
    "${PYTHON_BIN}" "${configurator_args[@]}"
    hermes_bin="$(resolve_hermes)"
    existing_profiles="$("${hermes_bin}" profile list | awk 'NR > 1 { print $1 }')"
    for member in "${members[@]}"; do
      if grep -Fx -- "${member}" <<<"${existing_profiles}" >/dev/null; then
        "${hermes_bin}" profile delete "${member}" --yes
        printf 'HERMES_PROFILE_DELETED: %s\n' "${member}"
      fi
    done
    printf 'HERMES_WORKFLOW_DELETED: %s (%s)\n' "${group}" "${resolved_project}"
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
