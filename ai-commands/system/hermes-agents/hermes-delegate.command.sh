#!/usr/bin/env bash
set -euo pipefail

profile_root="${AI_PROFILE_ROOT:?AI_PROFILE_ROOT must select the operational profile root}"
work_profile="${AI_WORK_PROFILE_ID:?AI_WORK_PROFILE_ID must select a work profile}"
workflow="${AI_FLOW_WORKFLOW:?AI_FLOW_WORKFLOW must select a workflow}"
hermes_python="${HERMES_INSTALL_ROOT:-${HOME}/.hermes/hermes-agent}/venv/bin/python"
[[ -x "${hermes_python}" ]] || { printf '%s\n' 'HERMES_CODER_BLOCKED: Hermes Python is unavailable.' >&2; exit 2; }

mode="${1:-}"
selected_project=''
assignment=''
case "${mode}" in
  check)
    if [[ $# -eq 3 && "$2" == --project && -n "$3" ]]; then selected_project="$3"
    elif [[ $# -ne 1 ]]; then mode=''; fi
    ;;
  run)
    if [[ $# -eq 4 && "$2" == --project && -n "$3" && -n "$4" ]]; then
      selected_project="$3"; assignment="$4"
    elif [[ $# -eq 2 && -n "$2" ]]; then assignment="$2"
    else mode=''; fi
    ;;
  *) mode='' ;;
esac
[[ -n "${mode}" ]] || {
  printf '%s\n' 'Usage: hermes-delegate.command.sh check [--project ID] | run [--project ID] "bounded implementation assignment"' >&2
  exit 2
}

resolved="$(HERMES_DELEGATE_PROFILE_ROOT="${profile_root}" HERMES_DELEGATE_WORK_PROFILE="${work_profile}" HERMES_DELEGATE_WORKFLOW="${workflow}" HERMES_DELEGATE_PROJECT_ID="${selected_project}" "${hermes_python}" - <<'PY'
import os
import re
import subprocess
from pathlib import Path
import yaml

work_profile_id = os.environ['HERMES_DELEGATE_WORK_PROFILE']
workflow_id = os.environ['HERMES_DELEGATE_WORKFLOW'].removesuffix('.workflow.md')
root = Path(os.environ['HERMES_DELEGATE_PROFILE_ROOT']) / work_profile_id
work_profile = yaml.safe_load((root / f'{work_profile_id}-work-profile.yml').read_text()) or {}
gpt_config = yaml.safe_load((root / 'commands-config/gpt-agents/config.yml').read_text()) or {}
binding = ((gpt_config.get('execution_delegates') or {}).get(workflow_id) or {}).get('coder') or {}
required = {
    'platform': 'hermes',
    'transport': 'cli-oneshot',
    'route': 'admin-to-real-coder',
    'preferred': True,
    'authorization': 'direct-delegation-or-admin-dev-run',
    'toolsets': ['file'],
}
if any(binding.get(key) != value for key, value in required.items()) or binding.get('routing_policy') not in ('all-coder-work', 'explicit-only'):
    raise SystemExit('HERMES_CODER_BLOCKED: declared Coder route is missing or invalid.')
if not re.fullmatch(r'[a-z0-9][a-z0-9-]*', str(binding.get('id') or '')):
    raise SystemExit('HERMES_CODER_BLOCKED: delegate ID is invalid.')
profile_id = binding.get('profile')
if not isinstance(profile_id, str) or not re.fullmatch(r'[a-z0-9][a-z0-9-]*-coder', profile_id):
    raise SystemExit('HERMES_CODER_BLOCKED: Hermes Coder profile ID is invalid.')
workflow = [item for item in work_profile.get('workflows', []) if item.get('path') == f'{workflow_id}.workflow.md']
if len(workflow) != 1:
    raise SystemExit('HERMES_CODER_BLOCKED: selected workflow is missing or ambiguous.')
workflow = workflow[0]
allowed_projects = binding.get('projects') or []
default_project = binding.get('default_project')
if not isinstance(allowed_projects, list) or not allowed_projects or len(set(allowed_projects)) != len(allowed_projects) or default_project not in allowed_projects:
    raise SystemExit('HERMES_CODER_BLOCKED: delegate project selection is invalid.')
project_id = os.environ.get('HERMES_DELEGATE_PROJECT_ID') or default_project
if project_id not in allowed_projects:
    raise SystemExit('HERMES_CODER_BLOCKED: selected project is not authorized for this delegate.')
project_roots = {}
for item in workflow.get('projects', []):
    record = yaml.safe_load((root / item['ref']).read_text()) or {}
    record_id = record.get('id')
    if record_id in project_roots:
        raise SystemExit('HERMES_CODER_BLOCKED: duplicate workflow project ID.')
    project_roots[record_id] = Path(record['repo_path']).expanduser().resolve()
if any(item not in project_roots for item in allowed_projects) or not project_roots[project_id].is_dir():
    raise SystemExit('HERMES_CODER_BLOCKED: selected project root is missing or ambiguous.')
workspace = project_roots[project_id]
catalog = yaml.safe_load((root / workflow['local_ai']['providers_config']).read_text()) or {}
providers = [item for item in catalog.get('providers', []) if item.get('id') == workflow['local_ai']['provider']]
if len(providers) != 1:
    raise SystemExit('HERMES_CODER_BLOCKED: model provider is missing or ambiguous.')
provider = providers[0]
models = [item for item in provider.get('models', []) if item.get('id') == workflow['local_ai']['model']]
if len(models) != 1:
    raise SystemExit('HERMES_CODER_BLOCKED: workflow model is missing or ambiguous.')
expected_model = models[0]['provider_model']
endpoints = {str(item.get('url') or '').rstrip('/') for item in ((provider.get('endpoint') or {}).get('connections') or {}).values()}
hermes_home = Path(os.environ.get('HERMES_HOME') or Path.home() / '.hermes')
runtime = yaml.safe_load((hermes_home / 'profiles' / profile_id / 'config.yaml').read_text()) or {}
model = runtime.get('model') or {}
if model.get('provider') != provider['id'] or model.get('default') != expected_model or str(model.get('base_url') or '').rstrip('/') not in endpoints:
    raise SystemExit('HERMES_CODER_BLOCKED: live Hermes provider, model, or endpoint differs from the selected workflow.')
if Path((runtime.get('terminal') or {}).get('cwd') or '').expanduser().resolve() != project_roots[default_project]:
    raise SystemExit('HERMES_CODER_BLOCKED: Hermes Coder default workspace differs from its binding.')
group_id = profile_id[:-len('-coder')]
receipts = yaml.safe_load((root / '.local/hermes-agents/bindings.yml').read_text()) or {}
group = (receipts.get('workflow_groups') or {}).get(group_id) or {}
if group.get('readiness') != 'ready' or profile_id not in group.get('profiles', []):
    raise SystemExit('HERMES_CODER_BLOCKED: Hermes workflow receipt is not ready for this Coder.')
if not any(item.get('id') == project_id and Path(item.get('repo_path') or '').resolve() == workspace for item in group.get('projects', [])):
    raise SystemExit('HERMES_CODER_BLOCKED: selected project is absent from the Hermes workflow receipt.')
branch = subprocess.run(['git', '-C', str(workspace), 'symbolic-ref', '--quiet', '--short', 'HEAD'], capture_output=True, text=True)
if branch.returncode != 0 or not branch.stdout.strip():
    raise SystemExit('HERMES_CODER_BLOCKED: selected project is not on a named branch.')
print(profile_id)
print(workspace)
print(branch.stdout.strip())
print(project_id)
print(binding['id'])
PY
)"

profile_id="$(printf '%s\n' "${resolved}" | sed -n '1p')"
workspace="$(printf '%s\n' "${resolved}" | sed -n '2p')"
branch="$(printf '%s\n' "${resolved}" | sed -n '3p')"
project_id="$(printf '%s\n' "${resolved}" | sed -n '4p')"
delegate_id="$(printf '%s\n' "${resolved}" | sed -n '5p')"
printf 'HERMES_CODER_READY: id=%s profile=%s project=%s branch=%s\n' "${delegate_id}" "${profile_id}" "${project_id}" "${branch}"

if [[ "${mode}" == check ]]; then exit 0; fi

prompt="You are the declared Coder endpoint for a human-authorized ${work_profile} ${workflow} Admin-run assignment. Admin is emulating other roles, but your Coder work is real delegation. Work only in ${workspace} on the current named branch ${branch}; use no temporary directories or worktrees. Follow the Coder role and repository rules. Implement only this bounded assignment: ${assignment}

Do not commit, push, run builds or tests, manage tickets, edit governance rules or ai-commands, or claim independent review or acceptance. Return changed files, implementation evidence, blockers, and checks that remain for Command Runner or independent review."
exec hermes -p "${profile_id}" -t file -z "${prompt}" --in "${workspace}"
