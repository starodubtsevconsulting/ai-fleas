#!/usr/bin/env bash
set -euo pipefail
# ai_command_require_profile runs immediately after explicit lifecycle selections are bootstrapped below.

# Initialization and reconciliation are profile bootstrap operations, so expose their explicit
# selections to the common command guard before normal argument processing.
if [[ "${1:-}" == initialize || "${1:-}" == reconcile || "${1:-}" == configure || "${1:-}" == setup || "${1:-}" == delete-workflow ]]; then
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
ai_command_require_profile "hermes-app" || exit $?

readonly COMMAND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly REPOSITORY_ROOT="$(cd "${COMMAND_DIR}/../.." && pwd)"
readonly SETUP_SCRIPT="${COMMAND_DIR}/setup-hermes-profile.sh"
readonly INSTALL_SCRIPT="${COMMAND_DIR}/install-hermes.sh"
readonly PROFILE_ROOT="${AI_PROFILE_ROOT:-$(dirname "$(dirname "${AI_PROFILE_FILE}")")}"
readonly PROFILE_RESOLVER="${COMMAND_DIR}/resolve-profile-scope.mjs"
readonly GROUP_CONFIGURATOR="${HERMES_GROUP_CONFIGURATOR:-${COMMAND_DIR}/configure-hermes-group.py}"
readonly PYTHON_BIN="${HERMES_PYTHON_BIN:-${HERMES_INSTALL_ROOT:-${HOME}/.hermes/hermes-agent}/venv/bin/python}"
readonly HERMES_UPSTREAM_REPOSITORY="${HERMES_UPSTREAM_REPOSITORY:-https://github.com/NousResearch/hermes-agent.git}"

usage() {
  printf '%s\n' \
    'Usage: hermes-app.command.sh install [--dry-run]' \
    '       hermes-app.command.sh check-update' \
    '       hermes-app.command.sh initialize --work-profile ID [--workflow ID] [--project ID] [--instance SLUG]' \
    '                               [--agent-instructions FILE] [setup overrides]' \
    '       hermes-app.command.sh reconcile --work-profile ID [--workflow ID] [--project ID] [--instance SLUG]' \
    '       hermes-app.command.sh delete-workflow --work-profile ID [--workflow ID] [--project ID] [--instance SLUG] --confirm-delete' \
    '       hermes-app.command.sh list' \
    '       hermes-app.command.sh show PROFILE' \
    '       hermes-app.command.sh status PROFILE' \
    '       hermes-app.command.sh delete PROFILE --confirm-delete'
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
    [[ -n "${installed_tag}" ]] || { printf 'HERMES_UPDATE_CHECK_FAILED: could not parse installed version: %s\n' "${installed_line}" >&2; exit 1; }
    remote_refs="$(git ls-remote --tags --refs "${HERMES_UPSTREAM_REPOSITORY}" 'v*' 2>/dev/null)" || { printf '%s\n' 'HERMES_UPDATE_CHECK_FAILED: stable release metadata is unavailable; update status is unknown.' >&2; exit 1; }
    latest_tag="$(awk '{ sub("refs/tags/", "", $2); print $2 }' <<<"${remote_refs}" | grep -E '^v[0-9]{4}\.[0-9]+\.[0-9]+(\.[0-9]+)?$' | sort -V | tail -n 1)"
    [[ -n "${latest_tag}" ]] || { printf '%s\n' 'HERMES_UPDATE_CHECK_FAILED: upstream returned no stable date-version tags.' >&2; exit 1; }
    supported_tag="$(sed -nE "s/^readonly HERMES_VERSION='.*\(([0-9]{4}\.[0-9]+\.[0-9]+(\.[0-9]+)?)\)'/v\1/p" "${INSTALL_SCRIPT}")"
    newest="$(printf '%s\n%s\n' "${installed_tag}" "${latest_tag}" | sort -V | tail -n 1)"
    printf 'Installed: %s\nLatest stable: %s\nSupported installer pin: %s\n' "${installed_tag}" "${latest_tag}" "${supported_tag:-unknown}"
    if [[ "${installed_tag}" == "${latest_tag}" || "${newest}" == "${installed_tag}" ]]; then printf '%s\n' 'HERMES_UP_TO_DATE: no stable upgrade is currently recommended.'; elif [[ "${supported_tag}" == "${latest_tag}" ]]; then printf '%s\n' 'HERMES_UPDATE_AVAILABLE: review the release, then run hermes-app.command.sh install to apply the supported stable upgrade.'; else printf '%s\n' 'HERMES_UPDATE_AVAILABLE: a newer stable release exists, but the public installer pin must be reviewed and updated before installation.'; fi
    ;;
  install) [[ -x "${INSTALL_SCRIPT}" ]] || { printf 'Installer is not executable: %s\n' "${INSTALL_SCRIPT}" >&2; exit 1; }; "${INSTALL_SCRIPT}" "$@" ;;
  initialize|reconcile|configure|setup)
    [[ -x "${SETUP_SCRIPT}" ]] || { printf 'Setup script is not executable: %s\n' "${SETUP_SCRIPT}" >&2; exit 1; }
    work_profile="${WORK_PROFILE_ID:-}"; workflow=''; project=''; instance=''; agent_instructions=''; setup_args=()
    while (($#)); do case "$1" in --work-profile) work_profile="$2"; shift 2;; --workflow) workflow="$2"; shift 2;; --project) project="$2"; shift 2;; --instance) instance="$2"; shift 2;; --agent-instructions) agent_instructions="$2"; shift 2;; *) setup_args+=("$1"); shift;; esac; done
    [[ -n "${work_profile}" ]] || { printf '%s\n' 'HERMES_PROFILE_SCOPE_INVALID: use --work-profile or set WORK_PROFILE_ID.' >&2; exit 2; }
    scope="$(node "${PROFILE_RESOLVER}" "${PROFILE_ROOT}" "${work_profile}" "${workflow}" "${project}")"
    IFS=$'\t' read -r resolved_profile resolved_workflow resolved_project resolved_provider resolved_provider_label resolved_endpoint resolved_model resolved_context_window resolved_compression_threshold resolved_compression_target resolved_protect_last_messages resolved_workspace resolved_agent_instructions resolved_commands_root resolved_workflow_instructions resolved_command_ids resolved_role_bindings <<<"${scope}"
    [[ -z "${agent_instructions}" ]] || resolved_agent_instructions="${agent_instructions}"; [[ -z "${instance}" ]] || validate_profile "${instance}"; derived_group="${resolved_profile}-${resolved_workflow}${instance:+-${instance}}"
    export HERMES_WORK_PROFILE="${resolved_profile}" HERMES_WORKFLOW="${resolved_workflow}" HERMES_PROJECT="${resolved_project}" HERMES_PROVIDER_ID="${resolved_provider}" HERMES_PROVIDER_LABEL="${resolved_provider_label}" HERMES_ENDPOINT="${resolved_endpoint}" HERMES_MODEL="${resolved_model}" HERMES_CONTEXT_LENGTH="${resolved_context_window}" HERMES_COMPRESSION_THRESHOLD="${resolved_compression_threshold}" HERMES_COMPRESSION_TARGET_RATIO="${resolved_compression_target}" HERMES_COMPRESSION_PROTECT_LAST_N="${resolved_protect_last_messages}" HERMES_WORKSPACE="${resolved_workspace}" HERMES_GROUP="${derived_group}" HERMES_AGENT_INSTRUCTIONS_PATH="${resolved_agent_instructions}" HERMES_AI_COMMANDS_ROOT="${resolved_commands_root}" HERMES_WORKFLOW_INSTRUCTIONS_PATH="${resolved_workflow_instructions}" HERMES_WORKFLOW_COMMAND_IDS="${resolved_command_ids}"
    IFS=',' read -r -a role_bindings <<<"${resolved_role_bindings}"
    for role_binding in "${role_bindings[@]}"; do role="${role_binding%%:*}"; profile_suffix="${role_binding#*:}"; case "${role}" in admin) role_title='Admin';; designer-reviewer) role_title='Designer/Reviewer';; judge) role_title='Judge';; manager) role_title='Manager';; coder) role_title='Coder';; command-runner) role_title='Command Runner';; ui-acceptance-tester) role_title='UI Acceptance Tester';; *) role_title="${role}";; esac; export HERMES_PROFILE="${derived_group}-${profile_suffix}" HERMES_ROLE="${role}" HERMES_ROLE_TITLE="${role_title}"; if [[ ${#setup_args[@]} -eq 0 ]]; then "${SETUP_SCRIPT}"; else "${SETUP_SCRIPT}" "${setup_args[@]}"; fi; done
    ;;
  list) "$(resolve_hermes)" profile list ;;
  show) validate_profile "$1"; "$(resolve_hermes)" profile show "$1" ;;
  status) profile="$1"; validate_profile "${profile}"; hermes_bin="$(resolve_hermes)"; provider="$("${hermes_bin}" -p "${profile}" config get model.provider)"; model="$("${hermes_bin}" -p "${profile}" config get model.default)"; endpoint="$("${hermes_bin}" -p "${profile}" config get model.base_url)"; workspace="$("${hermes_bin}" -p "${profile}" config get terminal.cwd)"; printf 'HERMES_READY\nProfile: %s\nProvider: %s\nModel: %s\nEndpoint: %s\nWorkspace: %s\n' "${profile}" "${provider}" "${model}" "${endpoint%/}" "${workspace}" ;;
  delete) profile="$1"; validate_profile "${profile}"; "$(resolve_hermes)" profile delete "${profile}" --yes ;;
  *) usage >&2; exit 2 ;;
esac
