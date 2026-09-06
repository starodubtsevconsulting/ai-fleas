#!/usr/bin/env bash
set -euo pipefail
# ai_command_require_profile runs immediately after explicit lifecycle selections are bootstrapped below.
if [[ "${1:-}" == initialize || "${1:-}" == reconcile || "${1:-}" == configure || "${1:-}" == setup || "${1:-}" == delete-workflow ]]; then
  bootstrap_args=("$@")
  for ((bootstrap_index=1; bootstrap_index<${#bootstrap_args[@]}; bootstrap_index++)); do
    case "${bootstrap_args[bootstrap_index]}" in
      --work-profile) ((bootstrap_index + 1 < ${#bootstrap_args[@]})) || break; export WORK_PROFILE_ID="${bootstrap_args[bootstrap_index + 1]}" AI_WORK_PROFILE_ID="${bootstrap_args[bootstrap_index + 1]}"; bootstrap_index=$((bootstrap_index + 1));;
      --workflow) ((bootstrap_index + 1 < ${#bootstrap_args[@]})) || break; bootstrap_workflow="${bootstrap_args[bootstrap_index + 1]}"; [[ "${bootstrap_workflow}" == *.workflow.md ]] || bootstrap_workflow="${bootstrap_workflow}.workflow.md"; export AI_FLOW_WORKFLOW="${bootstrap_workflow}"; bootstrap_index=$((bootstrap_index + 1));;
    esac
  done
fi
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)/_runtime/profile/command-profile.guard.sh"
ai_command_require_profile "hermes-app" || exit $?
readonly COMMAND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)" REPOSITORY_ROOT="$(cd "${COMMAND_DIR}/../.." && pwd)" SETUP_SCRIPT="${COMMAND_DIR}/setup-hermes-profile.sh" INSTALL_SCRIPT="${COMMAND_DIR}/install-hermes.sh" PROFILE_ROOT="${AI_PROFILE_ROOT:-$(dirname "$(dirname "${AI_PROFILE_FILE}")")}" PROFILE_RESOLVER="${COMMAND_DIR}/resolve-profile-scope.mjs" GROUP_CONFIGURATOR="${HERMES_GROUP_CONFIGURATOR:-${COMMAND_DIR}/configure-hermes-group.py}" PYTHON_BIN="${HERMES_PYTHON_BIN:-${HERMES_INSTALL_ROOT:-${HOME}/.hermes/hermes-agent}/venv/bin/python}"
usage(){ printf '%s\n' 'Usage: hermes-app.command.sh initialize --work-profile ID [--workflow ID] [--project ID] [--instance SLUG]' '       hermes-app.command.sh reconcile --work-profile ID [--workflow ID] [--project ID] [--instance SLUG]' '       hermes-app.command.sh list|show|status|delete ...'; }
resolve_hermes(){ if [[ -n "${HERMES_BIN:-}" && -x "${HERMES_BIN}" ]];then printf '%s\n' "${HERMES_BIN}";elif command -v hermes >/dev/null 2>&1;then command -v hermes;elif [[ -x "${HOME}/.local/bin/hermes" ]];then printf '%s\n' "${HOME}/.local/bin/hermes";else printf '%s\n' 'HERMES_CLI_MISSING: Hermes CLI was not found.' >&2;return 1;fi; }
validate_profile(){ [[ "$1" =~ ^[a-z0-9][a-z0-9_-]*$ ]]||{ printf '%s\n' 'HERMES_INVALID_INPUT: unsafe or empty profile ID.' >&2;return 2;}; }
action="${1:-}";[[ -n "${action}" ]]||{ usage >&2;exit 2;};shift
case "${action}" in
 install) "${INSTALL_SCRIPT}" "$@";;
 initialize|reconcile|configure|setup)
  work_profile="${WORK_PROFILE_ID:-}";workflow='';project='';instance='';agent_instructions='';setup_args=()
  while (($#));do case "$1" in --work-profile)work_profile="$2";shift 2;;--workflow)workflow="$2";shift 2;;--project)project="$2";shift 2;;--instance)instance="$2";shift 2;;--agent-instructions)agent_instructions="$2";shift 2;;*)setup_args+=("$1");shift;;esac;done
  [[ -n "${work_profile}" ]]||{ printf '%s\n' 'HERMES_PROFILE_SCOPE_INVALID: use --work-profile or set WORK_PROFILE_ID.' >&2;exit 2;}
  scope="$(node "${PROFILE_RESOLVER}" "${PROFILE_ROOT}" "${work_profile}" "${workflow}" "${project}")"
  IFS=$'\t' read -r resolved_profile resolved_workflow resolved_project resolved_provider resolved_provider_label resolved_endpoint resolved_model resolved_context_window resolved_compression_threshold resolved_compression_target resolved_protect_last_messages resolved_workspace resolved_agent_instructions resolved_commands_root resolved_workflow_instructions resolved_command_ids resolved_role_bindings <<<"${scope}"
  [[ -z "${agent_instructions}" ]]||resolved_agent_instructions="${agent_instructions}";[[ -z "${instance}" ]]||validate_profile "${instance}";derived_group="${resolved_profile}-${resolved_workflow}${instance:+-${instance}}"
  export HERMES_WORK_PROFILE="${resolved_profile}" HERMES_WORKFLOW="${resolved_workflow}" HERMES_PROJECT="${resolved_project}" HERMES_MODEL="${resolved_model}" HERMES_CONTEXT_LENGTH="${resolved_context_window}" HERMES_COMPRESSION_THRESHOLD="${resolved_compression_threshold}" HERMES_COMPRESSION_TARGET_RATIO="${resolved_compression_target}" HERMES_COMPRESSION_PROTECT_LAST_N="${resolved_protect_last_messages}" HERMES_WORKSPACE="${resolved_workspace}" HERMES_GROUP="${derived_group}" HERMES_AGENT_INSTRUCTIONS_PATH="${resolved_agent_instructions}" HERMES_AI_COMMANDS_ROOT="${resolved_commands_root}" HERMES_WORKFLOW_INSTRUCTIONS_PATH="${resolved_workflow_instructions}" HERMES_WORKFLOW_COMMAND_IDS="${resolved_command_ids}"
  IFS=',' read -r -a role_bindings <<<"${resolved_role_bindings}"
  for encoded in "${role_bindings[@]}";do decoded="$(node -e 'const v=JSON.parse(Buffer.from(process.argv[1],"base64url").toString()); process.stdout.write([v.role,v.suffix,v.aiProvider,v.endpoint].join("\t"))' "${encoded}")";IFS=$'\t' read -r role profile_suffix role_provider role_endpoint <<<"${decoded}";[[ -n "${role}" && -n "${profile_suffix}" && -n "${role_provider}" && -n "${role_endpoint}" ]]||{ printf '%s\n' 'HERMES_PROFILE_SCOPE_INVALID: malformed Hermes role binding.' >&2;exit 2;};case "${role}" in admin)role_title='Admin';;designer-reviewer)role_title='Designer/Reviewer';;judge)role_title='Judge';;manager)role_title='Manager';;coder)role_title='Coder';;command-runner)role_title='Command Runner';;ui-acceptance-tester)role_title='UI Acceptance Tester';;*)role_title="${role}";;esac;export HERMES_PROFILE="${derived_group}-${profile_suffix}" HERMES_ROLE="${role}" HERMES_ROLE_TITLE="${role_title}" HERMES_PROVIDER_ID="${role_provider}" HERMES_PROVIDER_LABEL="${role_provider}" HERMES_ENDPOINT="${role_endpoint}";if [[ ${#setup_args[@]} -eq 0 ]];then "${SETUP_SCRIPT}";else "${SETUP_SCRIPT}" "${setup_args[@]}";fi;done
  ;;
 list) "$(resolve_hermes)" profile list;;
 show) validate_profile "$1";"$(resolve_hermes)" profile show "$1";;
 status) profile="$1";validate_profile "${profile}";hermes_bin="$(resolve_hermes)";provider="$("${hermes_bin}" -p "${profile}" config get model.provider)";model="$("${hermes_bin}" -p "${profile}" config get model.default)";endpoint="$("${hermes_bin}" -p "${profile}" config get model.base_url)";workspace="$("${hermes_bin}" -p "${profile}" config get terminal.cwd)";printf 'HERMES_READY\nProfile: %s\nProvider: %s\nModel: %s\nEndpoint: %s\nWorkspace: %s\n' "${profile}" "${provider}" "${model}" "${endpoint%/}" "${workspace}";;
 delete) profile="$1";validate_profile "${profile}";"$(resolve_hermes)" profile delete "${profile}" --yes;;
 *) usage >&2;exit 2;;
esac
