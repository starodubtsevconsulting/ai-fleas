#!/usr/bin/env bash
set -euo pipefail

# Called through hermes-agents.command.sh after the profile guard.
profile_root="${AI_PROFILE_ROOT:?AI_PROFILE_ROOT is required}"
work_profile="${AI_WORK_PROFILE_ID:?AI_WORK_PROFILE_ID is required}"
workflow="${AI_FLOW_WORKFLOW:?AI_FLOW_WORKFLOW is required}"
command_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
python_bin="${HERMES_PYTHON_BIN:-${HERMES_INSTALL_ROOT:-${HOME}/.hermes/hermes-agent}/venv/bin/python}"
[[ -x "${python_bin}" ]] || { printf '%s\n' 'HERMES_CONNECTION_ERROR: Hermes Python is unavailable.' >&2; exit 2; }

action="${1:-}"
shift || true
instance=''
connection=''
while (($#)); do
  case "$1" in
    --instance) [[ $# -ge 2 ]] || exit 2; instance="$2"; shift 2 ;;
    --connection) [[ $# -ge 2 ]] || exit 2; connection="$2"; shift 2 ;;
    *) printf '%s\n' 'Usage: connection status|check|switch [--instance SLUG] [--connection NAME]' >&2; exit 2 ;;
  esac
done
[[ "${action}" == status || "${action}" == check || "${action}" == switch ]] || exit 2
[[ "${instance}" == '' || "${instance}" =~ ^[a-z0-9][a-z0-9-]*$ ]] || exit 2
if [[ "${action}" != status && ! "${connection}" =~ ^[a-z0-9][a-z0-9-]*$ ]]; then
  printf '%s\n' 'HERMES_CONNECTION_ERROR: select a configured connection.' >&2; exit 2
fi

group="${work_profile}-${workflow%.workflow.md}${instance:+-${instance}}"
status() {
  HERMES_CONNECTION_PROFILE_ROOT="${profile_root}" HERMES_CONNECTION_WORK_PROFILE="${work_profile}" HERMES_CONNECTION_WORKFLOW="${workflow}" HERMES_CONNECTION_GROUP="${group}" HERMES_CONNECTION_REQUESTED="${connection}" "${python_bin}" - <<'PY'
import os
from pathlib import Path
import yaml

root = Path(os.environ['HERMES_CONNECTION_PROFILE_ROOT']) / os.environ['HERMES_CONNECTION_WORK_PROFILE']
work_id = os.environ['HERMES_CONNECTION_WORK_PROFILE']
workflow_id = os.environ['HERMES_CONNECTION_WORKFLOW']
group_id = os.environ['HERMES_CONNECTION_GROUP']
requested = os.environ['HERMES_CONNECTION_REQUESTED']
profile = yaml.safe_load((root / f'{work_id}-work-profile.yml').read_text()) or {}
workflows = [w for w in profile.get('workflows', []) if w.get('path') == workflow_id]
if len(workflows) != 1:
    raise SystemExit('HERMES_CONNECTION_ERROR: workflow is missing or ambiguous.')
local_ai = workflows[0].get('local_ai') or {}
catalog = yaml.safe_load((root / local_ai['providers_config']).read_text()) or {}
providers = [p for p in catalog.get('providers', []) if p.get('id') == local_ai.get('provider')]
if len(providers) != 1:
    raise SystemExit('HERMES_CONNECTION_ERROR: provider is missing or ambiguous.')
provider = providers[0]
models = [m for m in provider.get('models', []) if m.get('id') == local_ai.get('model')]
if len(models) != 1:
    raise SystemExit('HERMES_CONNECTION_ERROR: model is missing or ambiguous.')
model_id = models[0]['provider_model']
connections = (provider.get('endpoint') or {}).get('connections') or {}
if requested and requested not in connections:
    raise SystemExit('HERMES_CONNECTION_ERROR: requested connection is not configured.')
receipts = yaml.safe_load((root / '.local/hermes-agents/bindings.yml').read_text()) or {}
group = (receipts.get('workflow_groups') or {}).get(group_id) or {}
roles = group.get('profiles') or []
if group.get('readiness') != 'ready' or not roles:
    raise SystemExit('HERMES_CONNECTION_ERROR: existing ready group is required.')
home = Path(os.environ.get('HERMES_HOME') or Path.home() / '.hermes') / 'profiles'
endpoints = set()
for role in roles:
    if not role.startswith(group_id + '-'):
        raise SystemExit('HERMES_CONNECTION_ERROR: receipt contains a profile outside the group.')
    config = yaml.safe_load((home / role / 'config.yaml').read_text()) or {}
    model = config.get('model') or {}
    if model.get('default') != model_id or model.get('provider') != provider['id']:
        raise SystemExit(f'HERMES_CONNECTION_ERROR: {role} has unexpected provider or model.')
    endpoints.add(str(model.get('base_url') or '').rstrip('/'))
if len(endpoints) != 1:
    raise SystemExit('HERMES_CONNECTION_MIXED: bot endpoints differ.')
endpoint = endpoints.pop()
routes = {str(v.get('url') or '').rstrip('/'): k for k, v in connections.items()}
route = routes.get(endpoint)
if not route:
    raise SystemExit(f'HERMES_CONNECTION_UNKNOWN: {endpoint}')
print(f'HERMES_CONNECTION: {route} ({endpoint})')
PY
}

clear_unused_secret_commands() {
  local profile_name config_file hermes_bin
  hermes_bin="${HERMES_BIN:-$(command -v hermes)}"
  [[ -x "${hermes_bin}" ]] || return 0
  while IFS= read -r profile_name; do
    [[ -n "${profile_name}" ]] || continue
    config_file="${HERMES_HOME:-${HOME}/.hermes}/profiles/${profile_name}/config.yaml"
    if [[ -f "${config_file}" ]] && grep -Fq 'AI_FLEAS_HERMES_SOURCE=profile-secret-command-v1' "${config_file}"; then
      "${hermes_bin}" -p "${profile_name}" config unset secrets.command >/dev/null
    fi
  done < <(HERMES_CONNECTION_PROFILE_ROOT="${profile_root}" HERMES_CONNECTION_WORK_PROFILE="${work_profile}" HERMES_CONNECTION_WORKFLOW="${workflow}" HERMES_CONNECTION_GROUP="${group}" HERMES_CONNECTION_REQUESTED="${connection}" "${python_bin}" - <<'PY'
import os
from pathlib import Path
import yaml
root = Path(os.environ['HERMES_CONNECTION_PROFILE_ROOT']) / os.environ['HERMES_CONNECTION_WORK_PROFILE']
profile = yaml.safe_load((root / f"{os.environ['HERMES_CONNECTION_WORK_PROFILE']}-work-profile.yml").read_text()) or {}
workflow = next(w for w in profile['workflows'] if w.get('path') == os.environ['HERMES_CONNECTION_WORKFLOW'])
catalog = yaml.safe_load((root / workflow['local_ai']['providers_config']).read_text()) or {}
provider = next(p for p in catalog['providers'] if p.get('id') == workflow['local_ai']['provider'])
connection = (provider.get('endpoint') or {}).get('connections', {}).get(os.environ['HERMES_CONNECTION_REQUESTED']) or {}
if connection.get('headers'):
    raise SystemExit(0)
receipts = yaml.safe_load((root / '.local/hermes-agents/bindings.yml').read_text()) or {}
for name in ((receipts.get('workflow_groups') or {}).get(os.environ['HERMES_CONNECTION_GROUP']) or {}).get('profiles', []):
    print(name)
PY
)
}

if [[ "${action}" == status ]]; then status; exit; fi
args=(--work-profile "${work_profile}" --workflow "${workflow%.workflow.md}" --instance "${instance}" --connection "${connection}")
if [[ -z "${instance}" ]]; then args=(--work-profile "${work_profile}" --workflow "${workflow%.workflow.md}" --connection "${connection}"); fi
"${command_dir}/hermes-agents.command.sh" reconcile "${args[@]}" --preflight-only
[[ "${action}" == check ]] && exit 0
current="$(status)"
if [[ "${current}" != "HERMES_CONNECTION: ${connection} ("* ]]; then
  "${command_dir}/hermes-agents.command.sh" reconcile "${args[@]}"
fi
clear_unused_secret_commands
status
printf '%s\n' 'HERMES_CONNECTION_SWITCH_READY: quit and reopen Hermes Desktop to load the selected route.'
