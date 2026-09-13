#!/usr/bin/env bash
set -euo pipefail
# ai_command_require_profile runs immediately after explicit lifecycle selections are bootstrapped below.

# Initialization and reconciliation are profile bootstrap operations, so expose their explicit
# selections to the common command guard before normal argument processing.
if [[ "${1:-}" == initialize || "${1:-}" == initialize-system || "${1:-}" == status-system || "${1:-}" == reinitialize || "${1:-}" == re-init || "${1:-}" == reconcile || "${1:-}" == configure || "${1:-}" == setup || "${1:-}" == delete-workflow ]]; then
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
readonly SOURCE_DIR="${COMMAND_DIR}/src"
readonly PROFILE_RESOLVER="${SOURCE_DIR}/resolve-workflow-scope.mjs"
readonly SYSTEM_RESOLVER="${SOURCE_DIR}/resolve-system-scope.mjs"
readonly SYSTEM_BINDING_WRITER="${HERMES_SYSTEM_BINDING_WRITER:-${SOURCE_DIR}/write-system-receipt.py}"
readonly WORKFLOW_BINDING_WRITER="${HERMES_WORKFLOW_BINDING_WRITER:-${SOURCE_DIR}/write-workflow-receipt.py}"
readonly WORKFLOW_REALIZER="${HERMES_WORKFLOW_REALIZER:-${SOURCE_DIR}/realize-workflow.py}"
readonly GROUP_CONFIGURATOR="${HERMES_GROUP_CONFIGURATOR:-${SOURCE_DIR}/configure-group.py}"
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
    '       hermes-agents.command.sh delete PROFILE --confirm-delete' \
    '       hermes-agents.command.sh initialize-system --work-profile ID [--watch-group ID]... [--every DURATION]' \
    '       hermes-agents.command.sh status-system --work-profile ID'
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

action="${1:-}"
[[ -n "${action}" ]] || { usage >&2; exit 2; }
shift

case "${action}" in
  initialize-system)
    work_profile="${WORK_PROFILE_ID:-}"
    every=''
    watch_groups=()
    while (($#)); do
      case "$1" in
        --work-profile) [[ $# -ge 2 ]] || { usage >&2; exit 2; }; work_profile="$2"; shift 2 ;;
        --watch-group) [[ $# -ge 2 ]] || { usage >&2; exit 2; }; validate_profile "$2"; watch_groups+=("$2"); shift 2 ;;
        --every) [[ $# -ge 2 ]] || { usage >&2; exit 2; }; every="$2"; shift 2 ;;
        *) usage >&2; exit 2 ;;
      esac
    done
    [[ -n "${work_profile}" ]] || { printf '%s\n' 'HERMES_SYSTEM_SCOPE_INVALID: use --work-profile or activate a profile.' >&2; exit 2; }
    validate_profile "${work_profile}"
    system_scope="$(node "${SYSTEM_RESOLVER}" "${PROFILE_ROOT}" "${work_profile}")"
    IFS=$'\t' read -r resolved_profile system_profile system_title system_provider system_provider_label system_endpoint system_model system_context system_threshold system_target system_protect system_workspace system_role_path system_schedule_path configured_every <<<"${system_scope}"
    [[ -n "${every}" ]] || every="${configured_every}"
    [[ "${every}" =~ ^[1-9][0-9]*[mhd]$ ]] || { printf '%s\n' 'HERMES_SYSTEM_SCOPE_INVALID: --every must use a positive m, h, or d duration.' >&2; exit 2; }
    watch_csv=''
    if ((${#watch_groups[@]})); then watch_csv="$(IFS=,; printf '%s' "${watch_groups[*]}")"; fi
    binding_registry="${PROFILE_ROOT}/${resolved_profile}/.local/hermes-agents/bindings.yml"
    export HERMES_SCOPE=system HERMES_PROFILE="${system_profile}" HERMES_ROLE=system HERMES_ROLE_TITLE="${system_title}"
    export HERMES_WORK_PROFILE="${resolved_profile}" HERMES_PROVIDER_ID="${system_provider}" HERMES_PROVIDER_LABEL="${system_provider_label}"
    export HERMES_ENDPOINT="${system_endpoint}" HERMES_MODEL="${system_model}" HERMES_CONTEXT_LENGTH="${system_context}"
    export HERMES_COMPRESSION_THRESHOLD="${system_threshold}" HERMES_COMPRESSION_TARGET_RATIO="${system_target}" HERMES_COMPRESSION_PROTECT_LAST_N="${system_protect}"
    export HERMES_WORKSPACE="${system_workspace}" HERMES_SYSTEM_ROLE_PATH="${system_role_path}" HERMES_SYSTEM_SCHEDULE_PATH="${system_schedule_path}"
    export HERMES_SYSTEM_WATCH_GROUPS="${watch_csv}" HERMES_BINDING_REGISTRY_PATH="${binding_registry}" HERMES_GROUP=''
    "${SETUP_SCRIPT}"
    hermes_python="${HERMES_PYTHON_BIN:-${HERMES_INSTALL_ROOT:-${HOME}/.hermes/hermes-agent}/venv/bin/python}"
    "${hermes_python}" "${GROUP_CONFIGURATOR}" --hermes-home "${HERMES_HOME:-${HOME}/.hermes}" --member "${system_profile}" --title "${system_title}" --global-pinned
    schedule_prompt="$(cat "${system_schedule_path}")

Trusted binding registry: ${binding_registry}
Exact ordered watch groups: ${watch_csv:-none}
Before answering, read that exact registry with file or terminal tools. A trusted group receipt exists exactly when the group has an entry under workflow_groups; never infer receipt state from memory or the watch list.
Operate as the System profile defined by SOUL.md. Perform the same lifecycle check as a direct human request."
    jobs_file="${HERMES_HOME:-${HOME}/.hermes}/profiles/${system_profile}/cron/jobs.json"
    scheduler_name="${system_profile}-lifecycle-monitor"
    scheduler_id="$(JOBS_FILE="${jobs_file}" JOB_NAME="${scheduler_name}" python3 -c 'import json, os; p=os.environ["JOBS_FILE"]; d=json.load(open(p)) if os.path.isfile(p) else {}; jobs=d.get("jobs", d if isinstance(d,list) else []); matches=[str(j.get("id")) for j in jobs if isinstance(j,dict) and j.get("name")==os.environ["JOB_NAME"]]; print(matches[0] if len(matches)==1 else "")')"
    hermes_bin="$(resolve_hermes)"
    if [[ -n "${scheduler_id}" ]]; then
      "${hermes_bin}" -p "${system_profile}" cron edit "${scheduler_id}" --schedule "${every}" --prompt "${schedule_prompt}" --name "${scheduler_name}" --deliver "bot-chat:${system_profile}" --workdir "${system_workspace}" --model "${system_model}" --provider "${system_provider}" --continuity
      # Reconciliation is authoritative for an enabled profile schedule. An
      # earlier provider failure may have auto-paused the existing job, and
      # editing its configuration does not resume it.
      "${hermes_bin}" -p "${system_profile}" cron resume "${scheduler_id}"
    else
      "${hermes_bin}" -p "${system_profile}" cron create "${every}" "${schedule_prompt}" --name "${scheduler_name}" --deliver "bot-chat:${system_profile}" --workdir "${system_workspace}" --model "${system_model}" --provider "${system_provider}" --continuity
      scheduler_id="$(JOBS_FILE="${jobs_file}" JOB_NAME="${scheduler_name}" python3 -c 'import json, os; d=json.load(open(os.environ["JOBS_FILE"])); jobs=d.get("jobs", []); matches=[str(j.get("id")) for j in jobs if isinstance(j,dict) and j.get("name")==os.environ["JOB_NAME"]]; print(matches[0] if len(matches)==1 else "")')"
    fi
    [[ -n "${scheduler_id}" ]] || { printf '%s\n' 'HERMES_SYSTEM_SCHEDULER_INVALID: exact scheduler receipt was not found.' >&2; exit 1; }
    binding_args=(--path "${binding_registry}" --profile "${system_profile}" --title "${system_title}" --provider "${system_provider}" --model "${system_model}" --every "${every}" --scheduler-id "${scheduler_id}")
    if ((${#watch_groups[@]})); then
      for group in "${watch_groups[@]}"; do binding_args+=(--watch-group "${group}"); done
    fi
    "${hermes_python}" "${SYSTEM_BINDING_WRITER}" "${binding_args[@]}"
    cron_status="$("${hermes_bin}" -p "${system_profile}" cron status 2>&1 || true)"
    if [[ "${cron_status}" != *'Gateway is running'* || "${cron_status}" != *'cron jobs will fire automatically'* ]]; then
      "${hermes_bin}" -p "${system_profile}" gateway install --start-now --start-on-login
      for _ in 1 2 3 4 5; do
        cron_status="$("${hermes_bin}" -p "${system_profile}" cron status 2>&1 || true)"
        [[ "${cron_status}" == *'Gateway is running'* && "${cron_status}" == *'cron jobs will fire automatically'* ]] && break
        sleep 1
      done
    fi
    [[ "${cron_status}" == *'Gateway is running'* && "${cron_status}" == *'cron jobs will fire automatically'* ]] || {
      printf '%s\n' 'HERMES_SYSTEM_SCHEDULER_INACTIVE: scheduler exists but its profile gateway/ticker is not ready.' >&2
      exit 1
    }
    printf 'SYSTEM_READY: %s; pinned globally; groups=none; scheduler=%s; every=%s; watch=%s\n' "${system_profile}" "${scheduler_id}" "${every}" "${watch_csv:-none}"
    ;;
  status-system)
    work_profile="${WORK_PROFILE_ID:-}"
    while (($#)); do case "$1" in --work-profile) work_profile="${2:-}"; shift 2 ;; *) usage >&2; exit 2 ;; esac; done
    validate_profile "${work_profile}"
    binding_registry="${PROFILE_ROOT}/${work_profile}/.local/hermes-agents/bindings.yml"
    [[ -f "${binding_registry}" ]] || { printf 'HERMES_SYSTEM_NOT_INITIALIZED: %s\n' "${work_profile}" >&2; exit 1; }
    "${PYTHON_BIN}" -c 'import sys,yaml; d=yaml.safe_load(open(sys.argv[1])); s=d["system"]; assert s["scope"]=="system" and s["pinned"] is True and s["groups"]==[]; print("HERMES_SYSTEM_READY: {} scheduler={} watch={}".format(s["profile_id"],s["scheduler"]["id"],",".join(s["watch_groups"])))' "${binding_registry}"
    ;;
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
    IFS=$'\t' read -r resolved_profile resolved_workflow resolved_project resolved_provider resolved_provider_label resolved_endpoint resolved_model resolved_context_window resolved_compression_threshold resolved_compression_target resolved_protect_last_messages resolved_workspace resolved_project_scope resolved_agent_instructions resolved_commands_root resolved_workflow_instructions resolved_command_ids resolved_role_bindings <<<"${scope}"
    [[ "${resolved_agent_instructions}" == '-' ]] && resolved_agent_instructions=''
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
    export HERMES_PROJECT_SCOPE_B64="${resolved_project_scope}"
    export HERMES_GROUP="${derived_group}"
    export HERMES_AGENT_INSTRUCTIONS_PATH="${resolved_agent_instructions}"
    export HERMES_AI_COMMANDS_ROOT="${resolved_commands_root}"
    export HERMES_WORKFLOW_INSTRUCTIONS_PATH="${resolved_workflow_instructions}"
    export HERMES_WORKFLOW_COMMAND_IDS="${resolved_command_ids}"
    binding_registry="${PROFILE_ROOT}/${resolved_profile}/.local/hermes-agents/bindings.yml"
    "${HERMES_WORKFLOW_REALIZER_PYTHON_BIN:-python3}" "${WORKFLOW_REALIZER}" \
      --group "${derived_group}" \
      --role-bindings "${resolved_role_bindings}" \
      --setup-script "${SETUP_SCRIPT}" \
      --binding-writer "${WORKFLOW_BINDING_WRITER}" \
      --binding-python "${HERMES_BINDING_PYTHON_BIN:-${PYTHON_BIN}}" \
      --binding-registry "${binding_registry}" \
      --project-scope "${resolved_project_scope}" \
      -- ${setup_args[@]+"${setup_args[@]}"}
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
      printf 'HERMES_INVALID_INPUT: profile=%s; configured model endpoint is not a valid HTTP(S) URL.\n' "${profile}" >&2
      exit 1
    }
    HERMES_PROFILE="${profile}" HERMES_PROVIDER_ID="${provider}" HERMES_PROVIDER_LABEL="${provider}" \
      HERMES_MODEL="${model}" HERMES_ENDPOINT="${endpoint}" HERMES_WORKSPACE="${workspace}" HERMES_GROUP='' \
      "${SETUP_SCRIPT}" --validate-only >/dev/null
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
    IFS=$'\t' read -r resolved_profile resolved_workflow resolved_project _ _ _ _ _ _ _ _ _ _ _ _ _ _ resolved_role_bindings <<<"${scope}"
    if [[ -n "${instance}" ]]; then validate_profile "${instance}"; fi
    group="${resolved_profile}-${resolved_workflow}${instance:+-${instance}}"
    validate_profile "${group}"
    members=()
    role_bindings=()
    IFS=',' read -r -a role_bindings <<<"${resolved_role_bindings}"
    for role_binding in "${role_bindings[@]}"; do
      IFS='|' read -r role suffix role_provider _ role_endpoint_b64 role_model _ <<<"${role_binding}"
      [[ -n "${role}" && -n "${suffix}" && -n "${role_provider}" && -n "${role_endpoint_b64}" && -n "${role_model}" ]] || {
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
