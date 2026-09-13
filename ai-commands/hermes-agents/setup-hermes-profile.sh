#!/usr/bin/env bash
set -euo pipefail

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
readonly DEFAULT_CONTEXT_LENGTH='65536'
readonly DEFAULT_COMPRESSION_THRESHOLD='0.25'
readonly DEFAULT_COMPRESSION_TARGET_RATIO='0.15'
readonly DEFAULT_COMPRESSION_PROTECT_LAST_N='8'
readonly SOURCE_DIR="${SCRIPT_DIR}/src"
readonly GROUP_CONFIGURATOR="${HERMES_GROUP_CONFIGURATOR:-${SOURCE_DIR}/configure-group.py}"
readonly PROFILE_VALIDATOR="${HERMES_PROFILE_VALIDATOR:-${SOURCE_DIR}/validate-profile.py}"

profile="${HERMES_PROFILE:-}"
provider_id="${HERMES_PROVIDER_ID:-}"
provider_label="${HERMES_PROVIDER_LABEL:-${provider_id}}"
model="${HERMES_MODEL:-}"
endpoint="${HERMES_ENDPOINT:-}"
workspace="${HERMES_WORKSPACE:-}"
work_profile="${HERMES_WORK_PROFILE:-}"
workflow="${HERMES_WORKFLOW:-}"
project="${HERMES_PROJECT:-}"
project_scope_b64="${HERMES_PROJECT_SCOPE_B64:-}"
agent_instructions_path="${HERMES_AGENT_INSTRUCTIONS_PATH:-}"
ai_commands_root="${HERMES_AI_COMMANDS_ROOT:-}"
workflow_instructions_path="${HERMES_WORKFLOW_INSTRUCTIONS_PATH:-}"
workflow_command_ids="${HERMES_WORKFLOW_COMMAND_IDS:-}"
role_instructions_path="${HERMES_ROLE_INSTRUCTIONS_PATH:-}"
flow_instructions_path="${HERMES_FLOW_INSTRUCTIONS_PATH:-}"
group="${HERMES_GROUP:-}"
role="${HERMES_ROLE:-worker}"
role_title="${HERMES_ROLE_TITLE:-Worker}"
scope="${HERMES_SCOPE:-workflow}"
system_role_path="${HERMES_SYSTEM_ROLE_PATH:-}"
system_schedule_path="${HERMES_SYSTEM_SCHEDULE_PATH:-}"
system_watch_groups="${HERMES_SYSTEM_WATCH_GROUPS:-}"
binding_registry_path="${HERMES_BINDING_REGISTRY_PATH:-}"
hermes_bin="${HERMES_BIN:-}"
context_length="${HERMES_CONTEXT_LENGTH:-${DEFAULT_CONTEXT_LENGTH}}"
compression_threshold="${HERMES_COMPRESSION_THRESHOLD:-${DEFAULT_COMPRESSION_THRESHOLD}}"
compression_target_ratio="${HERMES_COMPRESSION_TARGET_RATIO:-${DEFAULT_COMPRESSION_TARGET_RATIO}}"
compression_protect_last_n="${HERMES_COMPRESSION_PROTECT_LAST_N:-${DEFAULT_COMPRESSION_PROTECT_LAST_N}}"
validate_only=false

usage() {
  printf '%s\n' \
    'Usage: setup-hermes-profile.sh [--profile NAME] [--workspace ABSOLUTE_PATH]' \
    '                           [--endpoint URL] [--model MODEL_ID] [--validate-only]' \
    '' \
    'Creates or reconciles one Hermes Desktop bot backed by the selected' \
    'OpenAI-compatible model target. Existing conversations and memory are' \
    'preserved when the profile already exists.'
}

while (($#)); do
  case "$1" in
    --profile)
      [[ $# -ge 2 ]] || { usage >&2; exit 2; }
      profile="$2"
      shift 2
      ;;
    --workspace)
      [[ $# -ge 2 ]] || { usage >&2; exit 2; }
      workspace="$2"
      shift 2
      ;;
    --endpoint)
      [[ $# -ge 2 ]] || { usage >&2; exit 2; }
      endpoint="$2"
      shift 2
      ;;
    --model)
      [[ $# -ge 2 ]] || { usage >&2; exit 2; }
      model="$2"
      shift 2
      ;;
    --validate-only)
      validate_only=true
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      usage >&2
      exit 2
      ;;
  esac
done

if [[ -z "${hermes_bin}" ]]; then
  if command -v hermes >/dev/null 2>&1; then
    hermes_bin="$(command -v hermes)"
  elif [[ -x "${HOME}/.local/bin/hermes" ]]; then
    hermes_bin="${HOME}/.local/bin/hermes"
  else
    echo 'Hermes CLI was not found. Install Hermes before running this setup.' >&2
    exit 1
  fi
fi
hermes_python="${HERMES_PYTHON_BIN:-${HERMES_INSTALL_ROOT:-${HOME}/.hermes/hermes-agent}/venv/bin/python}"
export HERMES_BIN="${hermes_bin}" HERMES_GROUP_CONFIGURATOR="${GROUP_CONFIGURATOR}" HERMES_EFFECTIVE_PYTHON_BIN="${hermes_python}"
validator_args=()
[[ "${validate_only}" == true ]] || validator_args+=(--quiet)
"${HERMES_PROFILE_VALIDATOR_PYTHON_BIN:-python3}" "${PROFILE_VALIDATOR}" ${validator_args[@]+"${validator_args[@]}"}

if [[ "${validate_only}" == true ]]; then
  exit 0
fi

hermes_root="${HERMES_HOME:-${HOME}/.hermes}"
profile_dir="${hermes_root}/profiles/${profile}"
# Hermes Desktop can briefly recreate an incomplete directory for a profile
# whose active UI session was just deleted. Directory existence therefore is
# not lifecycle identity; the CLI registry is authoritative.
registered_profiles="$("${hermes_bin}" profile list | awk 'NR > 1 { print $1 }')"
if ! grep -Fx -- "${profile}" <<<"${registered_profiles}" >/dev/null; then
  "${hermes_bin}" profile create "${profile}" \
    --description "Assistant for ${workspace}, backed by ${model} on ${provider_label}."
fi

provider_json="$(PROVIDER_LABEL="${provider_label}" ENDPOINT="${endpoint%/}" MODEL_ID="${model}" python3 -c '
import json
import os

print(json.dumps({
    "name": os.environ["PROVIDER_LABEL"],
    "base_url": os.environ["ENDPOINT"],
    "model": os.environ["MODEL_ID"],
    "discover_models": False,
    "models": {os.environ["MODEL_ID"]: {}},
}))
')"
"${hermes_bin}" -p "${profile}" config set --force "providers.${provider_id}" "${provider_json}"
"${hermes_bin}" -p "${profile}" config set model.provider "${provider_id}"
"${hermes_bin}" -p "${profile}" config set model.default "${model}"
"${hermes_bin}" -p "${profile}" config set model.base_url "${endpoint%/}"
"${hermes_bin}" -p "${profile}" config set model.api_mode chat_completions
"${hermes_bin}" -p "${profile}" config set model.context_length "${context_length}"
"${hermes_bin}" -p "${profile}" config set compression.threshold "${compression_threshold}"
"${hermes_bin}" -p "${profile}" config set compression.target_ratio "${compression_target_ratio}"
"${hermes_bin}" -p "${profile}" config set compression.protect_last_n "${compression_protect_last_n}"
if [[ "${scope}" == 'system' ]]; then
  # The System profile has a fixed visible identity. Automatic chat-title
  # generation adds no lifecycle value and can monopolize a one-slot local
  # provider ahead of the user's actual request.
  "${hermes_bin}" -p "${profile}" config set auxiliary.title_generation.enabled false
fi
"${hermes_bin}" -p "${profile}" config set terminal.backend local
"${hermes_bin}" -p "${profile}" config set terminal.cwd "${workspace}"

# Canonical Bot Chats are eternal, history-preserving sessions. Some Hermes
# CLI delivery paths still restore their persisted route even when the session
# explicitly follows profile configuration, so reconcile that metadata before
# scheduler delivery without deleting messages.
python3 "${SOURCE_DIR}/migrate-profile-sessions.py" \
  --state-db "${profile_dir}/state.db" \
  --title 'Bot Chat' \
  --model "${model}" \
  --provider "${provider_id}" \
  --base-url "${endpoint%/}"

soul_tmp="$(mktemp "${profile_dir}/.SOUL.md.XXXXXX")"
cleanup() { [[ -z "${soul_tmp:-}" ]] || rm -f -- "${soul_tmp}"; }
trap cleanup EXIT INT TERM
printf '# Hermes Profile: %s\n\n' "${profile}" >"${soul_tmp}"
if [[ "${scope}" == 'system' ]]; then
  printf '%s\n' \
    "You are the profile-scoped Hermes System agent for AI work profile \`${work_profile}\`." \
    'You exist outside every workflow group. Never join a group and never expose your direct profile ID to workflow agents.' \
    "Your visible title is \`${role_title}\`. You are a narrow, user-facing lifecycle operator, not a product-work assistant." \
    "Your portable authority and human-facing prompt interpretations are defined in \`${system_role_path}\`. Read that file completely before every response or operation; it remains authoritative." \
    >>"${soul_tmp}"
  printf '\n## Enforced conversational scope\n\n' >>"${soul_tmp}"
  printf '%s\n' \
    'For a greeting or casual opening, reply only with a brief operational introduction: say that you are up, identify this profile, and offer help with watched workflows, agent health, or lifecycle operations.' \
    'Do not act as a general assistant. Do not offer coding, research, automation, general conversation, weather, or help with whatever the user needs.' \
    'When a request is outside profile/system configuration, watched-workflow health, agent lifecycle, or an explicitly active AI-powered command, do not answer it. Briefly state your operational scope and invite an in-scope request.' \
    'These scope rules apply directly on every turn; do not wait to read another file before enforcing them.' \
    >>"${soul_tmp}"
  printf '\n## Active lifecycle binding\n\n' >>"${soul_tmp}"
  printf '%s\n' \
    "Trusted Hermes binding registry: \`${binding_registry_path}\`. Resolve lifecycle identities only from that exact registry." \
    "For every check, status, watch, unwatch, or lifecycle request, first read that exact registry with the available file or terminal tools. Never answer from this prompt's watch list, memory, UI names, or a previous run. A group has a trusted receipt exactly when it has a matching entry under \`workflow_groups\` in the registry." \
    "Ordered watched logical groups: \`${system_watch_groups:-none}\`. A missing group receipt is pending state, not authorization to guess." \
    "Scheduled lifecycle instruction: \`${system_schedule_path}\`. Manual checks execute the same operation immediately." \
    >>"${soul_tmp}"
else
printf '%s\n' \
  "You are an assistant backed by the profile-selected ${provider_label} model target." \
  "Your logical workflow role is \`${role}\` (${role_title})." \
  "Your AI work profile is \`${work_profile:-not-recorded}\` and workflow/logical group is \`${workflow:-not-recorded}\`." \
  >>"${soul_tmp}"
if [[ -n "${project_scope_b64}" ]]; then
  project_scope_text="$(PROJECT_SCOPE_B64="${project_scope_b64}" PRIMARY_PROJECT="${project}" python3 -c '
import base64
import json
import os

try:
    projects = json.loads(base64.b64decode(os.environ["PROJECT_SCOPE_B64"], validate=True))
except Exception as error:
    raise SystemExit(f"Invalid encoded Hermes project scope: {error}")
if not isinstance(projects, list) or not projects:
    raise SystemExit("Hermes project scope must contain at least one project")
lines = ["Your complete ordered project scope is:"]
for index, project in enumerate(projects):
    if not isinstance(project, dict) or not all(isinstance(project.get(key), str) and project[key] for key in ("id", "repo_path")):
        raise SystemExit("Hermes project scope contains an invalid project record")
    kind = "primary/default" if index == 0 else "associated"
    lines.append("- `{}` ({}): `{}`".format(project["id"], kind, project["repo_path"]))
if projects[0]["id"] != os.environ["PRIMARY_PROJECT"]:
    raise SystemExit("Hermes primary project does not match the ordered project scope")
print("\n".join(lines))
')"
  printf '%s\n' "${project_scope_text}" "The primary project is the default terminal working directory. Every listed project is authorized work scope for this logical group; projects outside this list are not." >>"${soul_tmp}"
else
  printf '%s\n' "Your primary and only recorded project is \`${project:-not-recorded}\` at \`${workspace}\`." >>"${soul_tmp}"
fi
if [[ "${scope}" != 'system' && -n "${role_instructions_path}" ]]; then
  printf '\n## Portable role contract\n\n' >>"${soul_tmp}"
  printf '%s\n' "Your portable role contract is \`${role_instructions_path}\`; read it completely before every response or operation and follow it as the authoritative role definition." >>"${soul_tmp}"
fi
if [[ "${scope}" != 'system' && -n "${flow_instructions_path}" ]]; then
  printf '\n## Assigned workflow flow\n\n' >>"${soul_tmp}"
  printf '%s\n' "Your assigned workflow flow is \`${flow_instructions_path}\`; read it completely before work that uses the flow and follow it as the authoritative flow definition." >>"${soul_tmp}"
fi
fi
if [[ "${scope}" != 'system' && -n "${agent_instructions_path}" ]]; then
  printf '%s\n' "Your AI configuration instructions are \`${agent_instructions_path}\`; read them completely before work and follow the rules that apply to the task." >>"${soul_tmp}"
elif [[ "${scope}" != 'system' ]]; then
  printf '%s\n' 'No separate AI configuration instructions file was assigned to this Hermes profile.' >>"${soul_tmp}"
fi
if [[ "${scope}" != 'system' && ( -n "${ai_commands_root}" || -n "${workflow_instructions_path}" || -n "${workflow_command_ids}" ) ]]; then
  printf '%s\n' \
    "Your active workflow contract is \`${workflow_instructions_path}\`; read it before substantive work." \
    "Your selected AI command catalog root is \`${ai_commands_root}\`. The commands allowed by this workflow are: \`${workflow_command_ids}\`." \
    'For every user request, first match the intent against those selected commands. When one matches, read `<AI commands root>/<command>/<command>.command.md` completely and use its documented scripts, adapters, drivers, configuration, and verification steps instead of improvising an equivalent workflow.' \
    'Load only the matching command contracts; do not treat unselected catalog commands as authorized merely because they exist.' \
    >>"${soul_tmp}"
fi
if [[ "${scope}" == 'system' ]]; then
  printf '%s\n' 'Never answer out-of-domain requests. Explain intended lifecycle mutations before performing them and never reveal credentials or secret values.' >>"${soul_tmp}"
else
  printf '%s\n' \
    'Begin coding tasks in the primary project unless the request concerns another project in the authorized ordered scope.' \
    'Explain intended destructive or external effects before performing them. Never reveal credentials or secret values.' \
    >>"${soul_tmp}"
fi
chmod 0600 "${soul_tmp}"
mv -f -- "${soul_tmp}" "${profile_dir}/SOUL.md"
soul_tmp=''

actual_provider="$("${hermes_bin}" -p "${profile}" config get model.provider)"
actual_model="$("${hermes_bin}" -p "${profile}" config get model.default)"
actual_endpoint="$("${hermes_bin}" -p "${profile}" config get model.base_url)"
actual_context_length="$("${hermes_bin}" -p "${profile}" config get model.context_length)"
actual_compression_threshold="$("${hermes_bin}" -p "${profile}" config get compression.threshold)"
actual_compression_target_ratio="$("${hermes_bin}" -p "${profile}" config get compression.target_ratio)"
actual_compression_protect_last_n="$("${hermes_bin}" -p "${profile}" config get compression.protect_last_n)"
if [[ "${scope}" == 'system' ]]; then
  actual_title_generation_enabled="$("${hermes_bin}" -p "${profile}" config get auxiliary.title_generation.enabled)"
fi
actual_workspace="$("${hermes_bin}" -p "${profile}" config get terminal.cwd)"
[[ "${actual_provider}" == "${provider_id}" ]]
[[ "${actual_model}" == "${model}" ]]
[[ "${actual_endpoint%/}" == "${endpoint%/}" ]]
[[ "${actual_context_length}" == "${context_length}" ]]
[[ "${actual_compression_threshold}" == "${compression_threshold}" ]]
[[ "${actual_compression_target_ratio}" == "${compression_target_ratio}" ]]
[[ "${actual_compression_protect_last_n}" == "${compression_protect_last_n}" ]]
[[ "${scope}" != 'system' || "${actual_title_generation_enabled}" == 'false' ]]
[[ "${actual_workspace}" == "${workspace}" ]]

if [[ -n "${group}" ]]; then
  "${hermes_python}" "${GROUP_CONFIGURATOR}" \
    --hermes-home "${hermes_root}" \
    --group "${group}" \
    --member "${profile}" \
    --title "${role_title}"
  if [[ "${role}" == 'admin' && "${HERMES_GROUP_ONLY_NAVIGATION:-true}" == 'true' ]]; then
    "${hermes_python}" "${GROUP_CONFIGURATOR}" \
      --hermes-home "${hermes_root}" \
      --member default \
      --title Hermes \
      --hide-only
  fi
fi

printf 'Hermes bot ready: %s\n' "${profile}"
printf 'Role: %s\n' "${role}"
printf 'Provider: %s (%s)\n' "${provider_id}" "${provider_label}"
printf 'Model: %s\n' "${model}"
printf 'Context: %s tokens; compress at %s; target %s; protect last %s messages\n' \
  "${context_length}" "${compression_threshold}" "${compression_target_ratio}" "${compression_protect_last_n}"
printf 'Workspace: %s\n' "${workspace}"
printf 'Open Hermes Desktop > BOTS > %s and start a new chat.\n' "${profile}"
