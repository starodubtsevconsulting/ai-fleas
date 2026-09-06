#!/usr/bin/env bash
set -euo pipefail

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
readonly DEFAULT_CONTEXT_LENGTH='65536'
readonly DEFAULT_COMPRESSION_THRESHOLD='0.25'
readonly DEFAULT_COMPRESSION_TARGET_RATIO='0.15'
readonly DEFAULT_COMPRESSION_PROTECT_LAST_N='8'
readonly GROUP_CONFIGURATOR="${HERMES_GROUP_CONFIGURATOR:-${SCRIPT_DIR}/configure-hermes-group.py}"

profile="${HERMES_PROFILE:-}"
provider_id="${HERMES_PROVIDER_ID:-}"
provider_label="${HERMES_PROVIDER_LABEL:-${provider_id}}"
model="${HERMES_MODEL:-}"
endpoint="${HERMES_ENDPOINT:-}"
workspace="${HERMES_WORKSPACE:-}"
work_profile="${HERMES_WORK_PROFILE:-}"
workflow="${HERMES_WORKFLOW:-}"
project="${HERMES_PROJECT:-}"
agent_instructions_path="${HERMES_AGENT_INSTRUCTIONS_PATH:-}"
ai_commands_root="${HERMES_AI_COMMANDS_ROOT:-}"
workflow_instructions_path="${HERMES_WORKFLOW_INSTRUCTIONS_PATH:-}"
workflow_command_ids="${HERMES_WORKFLOW_COMMAND_IDS:-}"
group="${HERMES_GROUP:-}"
role="${HERMES_ROLE:-worker}"
role_title="${HERMES_ROLE_TITLE:-Worker}"
hermes_bin="${HERMES_BIN:-}"
context_length="${HERMES_CONTEXT_LENGTH:-${DEFAULT_CONTEXT_LENGTH}}"
compression_threshold="${HERMES_COMPRESSION_THRESHOLD:-${DEFAULT_COMPRESSION_THRESHOLD}}"
compression_target_ratio="${HERMES_COMPRESSION_TARGET_RATIO:-${DEFAULT_COMPRESSION_TARGET_RATIO}}"
compression_protect_last_n="${HERMES_COMPRESSION_PROTECT_LAST_N:-${DEFAULT_COMPRESSION_PROTECT_LAST_N}}"

usage() {
  printf '%s\n' \
    'Usage: setup-hermes-profile.sh [--profile NAME] [--workspace ABSOLUTE_PATH]' \
    '                           [--endpoint URL] [--model MODEL_ID]' \
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

[[ "${profile}" =~ ^[a-z0-9][a-z0-9_-]*$ ]] || {
  echo 'Profile must contain only lowercase letters, digits, hyphens, and underscores.' >&2
  exit 2
}
[[ "${provider_id}" =~ ^[a-z0-9][a-z0-9_-]*$ ]] || {
  echo 'Provider ID must contain only lowercase letters, digits, hyphens, and underscores.' >&2
  exit 2
}
[[ "${model}" =~ ^[A-Za-z0-9._:/+-]+$ ]] || {
  echo 'Model ID contains unsupported characters.' >&2
  exit 2
}
ENDPOINT="${endpoint}" python3 -c '
import os
import sys
from urllib.parse import urlparse

endpoint = os.environ["ENDPOINT"]
parsed = urlparse(endpoint)
if parsed.scheme not in {"http", "https"} or not parsed.netloc or any(char.isspace() for char in endpoint):
    raise SystemExit("Endpoint must be an HTTP(S) URL without whitespace.")
' || exit 2
[[ "${workspace}" == /* && -d "${workspace}" ]] || {
  echo "Workspace is not an existing absolute directory: ${workspace}" >&2
  exit 2
}
[[ -z "${group}" || "${group}" =~ ^[a-z0-9][a-z0-9_-]*$ ]] || {
  echo 'Group ID must contain only lowercase letters, digits, hyphens, and underscores.' >&2
  exit 2
}

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
[[ -x "${hermes_bin}" ]] || { echo "Hermes CLI is not executable: ${hermes_bin}" >&2; exit 1; }

models_url="${endpoint%/}/models"
models_json="$(curl --fail --silent --show-error --max-time 10 "${models_url}")" || {
  echo "Configured model target is unreachable: ${provider_label}; no profile changes were made." >&2
  exit 1
}
MODEL_ID="${model}" python3 -c '
import json
import os
import sys

payload = json.load(sys.stdin)
expected = os.environ["MODEL_ID"]
available = {
    str(item.get("id") or item.get("model") or item.get("name") or "")
    for collection in (payload.get("data", []), payload.get("models", []))
    for item in collection
    if isinstance(item, dict)
}
if expected not in available:
    raise SystemExit(f"Configured model is not advertised by the selected target: {expected}")
' <<<"${models_json}"

hermes_root="${HERMES_HOME:-${HOME}/.hermes}"
profile_dir="${hermes_root}/profiles/${profile}"
if [[ ! -d "${profile_dir}" ]]; then
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
"${hermes_bin}" -p "${profile}" config set terminal.backend local
"${hermes_bin}" -p "${profile}" config set terminal.cwd "${workspace}"

soul_tmp="$(mktemp "${profile_dir}/.SOUL.md.XXXXXX")"
cleanup() { [[ -z "${soul_tmp:-}" ]] || rm -f -- "${soul_tmp}"; }
trap cleanup EXIT INT TERM
printf '# Hermes Profile: %s\n\n' "${profile}" >"${soul_tmp}"
printf '%s\n' \
  "You are an assistant backed by the profile-selected ${provider_label} model target." \
  "Your logical workflow role is \`${role}\` (${role_title})." \
  "Your AI work profile is \`${work_profile:-not-recorded}\`, workflow is \`${workflow:-not-recorded}\`, and project is \`${project:-not-recorded}\`." \
  "Your default and authorized project folder is \`${workspace}\`." \
  >>"${soul_tmp}"
if [[ -n "${agent_instructions_path}" ]]; then
  [[ "${agent_instructions_path}" == /* && -f "${agent_instructions_path}" ]] || {
    echo "Agent instructions path is not an existing absolute file: ${agent_instructions_path}" >&2
    exit 2
  }
  printf '%s\n' "Your AI configuration instructions are \`${agent_instructions_path}\`; read them completely before work and follow the rules that apply to the task." >>"${soul_tmp}"
else
  printf '%s\n' 'No separate AI configuration instructions file was assigned to this Hermes profile.' >>"${soul_tmp}"
fi
if [[ -n "${ai_commands_root}" || -n "${workflow_instructions_path}" || -n "${workflow_command_ids}" ]]; then
  [[ "${ai_commands_root}" == /* && -d "${ai_commands_root}" ]] || {
    echo "AI commands root is not an existing absolute directory: ${ai_commands_root}" >&2
    exit 2
  }
  [[ "${workflow_instructions_path}" == /* && -f "${workflow_instructions_path}" ]] || {
    echo "Workflow instructions path is not an existing absolute file: ${workflow_instructions_path}" >&2
    exit 2
  }
  [[ "${workflow_command_ids}" =~ ^[a-z0-9][a-z0-9_-]*(,[a-z0-9][a-z0-9_-]*)*$ ]] || {
    echo "Workflow command IDs are missing or unsafe: ${workflow_command_ids}" >&2
    exit 2
  }
  printf '%s\n' \
    "Your active workflow contract is \`${workflow_instructions_path}\`; read it before substantive work." \
    "Your selected AI command catalog root is \`${ai_commands_root}\`. The commands allowed by this workflow are: \`${workflow_command_ids}\`." \
    'For every user request, first match the intent against those selected commands. When one matches, read `<AI commands root>/<command>/<command>.command.md` completely and use its documented scripts, adapters, drivers, configuration, and verification steps instead of improvising an equivalent workflow.' \
    'Load only the matching command contracts; do not treat unselected catalog commands as authorized merely because they exist.' \
    >>"${soul_tmp}"
fi
printf '%s\n' \
  'Begin coding tasks in the authorized project folder and do not access another project unless the user explicitly changes this profile configuration.' \
  'Explain intended destructive or external effects before performing them. Never reveal credentials or secret values.' \
  >>"${soul_tmp}"
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
actual_workspace="$("${hermes_bin}" -p "${profile}" config get terminal.cwd)"
[[ "${actual_provider}" == "${provider_id}" ]]
[[ "${actual_model}" == "${model}" ]]
[[ "${actual_endpoint%/}" == "${endpoint%/}" ]]
[[ "${actual_context_length}" == "${context_length}" ]]
[[ "${actual_compression_threshold}" == "${compression_threshold}" ]]
[[ "${actual_compression_target_ratio}" == "${compression_target_ratio}" ]]
[[ "${actual_compression_protect_last_n}" == "${compression_protect_last_n}" ]]
[[ "${actual_workspace}" == "${workspace}" ]]

if [[ -n "${group}" ]]; then
  [[ -f "${GROUP_CONFIGURATOR}" ]] || {
    echo "Hermes group configurator was not found: ${GROUP_CONFIGURATOR}" >&2
    exit 1
  }
  hermes_python="${HERMES_PYTHON_BIN:-${HERMES_INSTALL_ROOT:-${HOME}/.hermes/hermes-agent}/venv/bin/python}"
  [[ -x "${hermes_python}" ]] || {
    echo "Hermes Python runtime is not executable: ${hermes_python}" >&2
    exit 1
  }
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
