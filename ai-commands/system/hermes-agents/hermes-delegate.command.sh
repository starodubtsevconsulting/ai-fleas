#!/usr/bin/env bash
# Purpose: validate and invoke the configured Hermes Coder with its target-model strategy and extracted expertise.
# Caller: the workflow Admin's profile launcher; inputs are check/run, project ID, and a bounded assignment.
# Effects: check is read-only; run sends one assignment through the configured CLI or A2A transport and may edit its authorized checkout.
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
import base64
import json
import os
import re
import subprocess
from pathlib import Path
import yaml

work_profile_id = os.environ['HERMES_DELEGATE_WORK_PROFILE']
workflow_id = os.environ['HERMES_DELEGATE_WORKFLOW'].removesuffix('.workflow.md')
root = Path(os.environ['HERMES_DELEGATE_PROFILE_ROOT']) / work_profile_id
work_profile = yaml.safe_load((root / f'{work_profile_id}-work-profile.yml').read_text()) or {}

# Find exactly one gpt-agents command entry in work_profile.commands
gpt_commands = [cmd for cmd in work_profile.get('commands', []) if isinstance(cmd, dict) and cmd.get('id') == 'gpt-agents']
if len(gpt_commands) != 1:
    raise SystemExit('HERMES_CODER_BLOCKED: exactly one gpt-agents command entry is required.')
gpt_command = gpt_commands[0]
config_path = gpt_command.get('config')
if not isinstance(config_path, str) or not config_path:
    raise SystemExit('HERMES_CODER_BLOCKED: gpt-agents config path must be a nonempty string.')

# Validate config path is relative and safe
path_parts = Path(config_path).parts
if Path(config_path).is_absolute():
    raise SystemExit('HERMES_CODER_BLOCKED: gpt-agents config path must be relative.')
if '..' in path_parts:
    raise SystemExit('HERMES_CODER_BLOCKED: gpt-agents config path must not escape profile root.')

# Resolve profile root and config target to real paths to detect symlink escapes
try:
    real_profile_root = root.resolve()
    resolved_config_path = (root / config_path).resolve()
except (OSError, RuntimeError) as e:
    raise SystemExit('HERMES_CODER_BLOCKED: failed to resolve paths for config validation.')

# Ensure config file is inside the real profile root (not the root itself)
if real_profile_root == resolved_config_path:
    raise SystemExit('HERMES_CODER_BLOCKED: gpt-agents config path must point to a file, not the profile root.')
if not str(resolved_config_path).startswith(str(real_profile_root) + os.sep):
    raise SystemExit('HERMES_CODER_BLOCKED: gpt-agents config path escapes profile root via symlink or other path manipulation.')

# Verify the resolved path is a regular file
if not resolved_config_path.is_file():
    raise SystemExit('HERMES_CODER_BLOCKED: gpt-agents config file does not exist or is not a regular file.')

gpt_config = yaml.safe_load(resolved_config_path.read_text()) or {}
binding = ((gpt_config.get('execution_delegates') or {}).get(workflow_id) or {}).get('coder') or {}
required = {
    'platform': 'hermes-cli',
    'route': 'admin-to-real-coder',
    'preferred': True,
    'authorization': 'direct-delegation-or-admin-dev-run',
    'toolsets': ['file'],
}
if any(binding.get(key) != value for key, value in required.items()) or binding.get('routing_policy') not in ('all-coder-work', 'explicit-only'):
    raise SystemExit('HERMES_CODER_BLOCKED: declared Coder route is missing or invalid.')
if not re.fullmatch(r'[a-z0-9][a-z0-9-]*', str(binding.get('id') or '')):
    raise SystemExit('HERMES_CODER_BLOCKED: delegate ID is invalid.')
transport = binding.get('transport')
if transport not in ('cli-oneshot', 'a2a'):
    raise SystemExit('HERMES_CODER_BLOCKED: transport must be cli-oneshot or a2a.')
profile_id = binding.get('profile')
if not isinstance(profile_id, str) or not re.fullmatch(r'[a-z0-9][a-z0-9-]*-coder', profile_id):
    raise SystemExit('HERMES_CODER_BLOCKED: Hermes Coder profile ID is invalid.')
if transport == 'a2a':
    if not isinstance(binding.get('a2a'), dict):
        raise SystemExit('HERMES_CODER_BLOCKED: a2a binding must be a dict.')
    endpoint = binding['a2a'].get('endpoint')
    agent_name = binding['a2a'].get('agent_name')
    if not isinstance(endpoint, str) or not endpoint:
        raise SystemExit('HERMES_CODER_BLOCKED: a2a endpoint must be a nonempty string.')
    # The profile is the canonical Hermes identity. An explicit A2A name remains supported for
    # compatibility, but omission keeps CLI and A2A routes linked to the one configurable value.
    if agent_name is None:
        agent_name = profile_id
    elif not isinstance(agent_name, str) or not agent_name:
        raise SystemExit('HERMES_CODER_BLOCKED: a2a agent_name must be a nonempty string or omitted.')
    if agent_name != profile_id:
        raise SystemExit('HERMES_CODER_BLOCKED: a2a agent_name must equal profile_id.')
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
strategy_ref = ((models[0].get('delegation') or {}).get('strategy_config'))
workflows_ref = work_profile.get('ai_workflows_root')
if not isinstance(strategy_ref, str) or not strategy_ref or Path(strategy_ref).is_absolute() or '..' in Path(strategy_ref).parts:
    raise SystemExit('HERMES_CODER_BLOCKED: target-model strategy is missing or unsafe.')
if not isinstance(workflows_ref, str) or not workflows_ref:
    raise SystemExit('HERMES_CODER_BLOCKED: workflow catalog root is missing.')
workflows_root = (root / workflows_ref).resolve()
strategy_path = (workflows_root / strategy_ref).resolve()
if workflows_root == strategy_path or not str(strategy_path).startswith(str(workflows_root) + os.sep) or not strategy_path.is_file():
    raise SystemExit('HERMES_CODER_BLOCKED: target-model strategy is outside the workflow catalog.')
strategy = yaml.safe_load(strategy_path.read_text()) or {}
if (strategy.get('applies_to') or {}).get('provider_model') != expected_model:
    raise SystemExit('HERMES_CODER_BLOCKED: target-model strategy does not match the selected model.')
expertise_ref = strategy.get('expertise_profile')
if not isinstance(expertise_ref, str) or not expertise_ref or Path(expertise_ref).is_absolute():
    raise SystemExit('HERMES_CODER_BLOCKED: target-model expertise profile is missing or unsafe.')
repo_root = workflows_root.parent
models_root = (repo_root / 'models').resolve()
expertise_path = (strategy_path.parent / expertise_ref).resolve()
if models_root == expertise_path or not str(expertise_path).startswith(str(models_root) + os.sep) or not expertise_path.is_file():
    raise SystemExit('HERMES_CODER_BLOCKED: target-model expertise profile is outside the canonical model catalog.')
expertise = yaml.safe_load(expertise_path.read_text()) or {}
communication = expertise.get('communication') or {}
required_lists = ('direct_starting_language', 'translate_first')
required_strings = ('handoff_rule', 'verification_rule')
provider_models = (expertise.get('applies_to') or {}).get('provider_models')
if expertise.get('schema_version') != 'ai-fleas-model-expertise.v1' or not isinstance(expertise.get('model_family'), str) or not expertise['model_family'].strip():
    raise SystemExit('HERMES_CODER_BLOCKED: target-model expertise identity is invalid.')
if not isinstance(provider_models, list) or expected_model not in provider_models or any(not isinstance(item, str) or not item.strip() for item in provider_models):
    raise SystemExit('HERMES_CODER_BLOCKED: target-model expertise does not apply to the selected model.')
if any(not isinstance(communication.get(key), list) or not communication[key] or any(not isinstance(item, str) or not item.strip() for item in communication[key]) for key in required_lists):
    raise SystemExit('HERMES_CODER_BLOCKED: target-model expertise communication lists are invalid.')
if any(not isinstance(communication.get(key), str) or not communication[key].strip() for key in required_strings):
    raise SystemExit('HERMES_CODER_BLOCKED: target-model expertise communication rules are invalid.')
expertise_contract = {
    'model_family': expertise['model_family'],
    'observed_scope': communication.get('observed_scope', ''),
    'direct_starting_language': communication['direct_starting_language'],
    'translate_first': communication['translate_first'],
    'handoff_rule': communication['handoff_rule'],
    'verification_rule': communication['verification_rule'],
}
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
print(transport)
print(endpoint if transport == 'a2a' else '')
print(agent_name if transport == 'a2a' else '')
print(strategy_path)
print(expertise_path)
print(base64.urlsafe_b64encode(json.dumps(expertise_contract, ensure_ascii=True).encode()).decode())
PY
)"

profile_id="$(printf '%s\n' "${resolved}" | sed -n '1p')"
workspace="$(printf '%s\n' "${resolved}" | sed -n '2p')"
branch="$(printf '%s\n' "${resolved}" | sed -n '3p')"
project_id="$(printf '%s\n' "${resolved}" | sed -n '4p')"
delegate_id="$(printf '%s\n' "${resolved}" | sed -n '5p')"
transport="$(printf '%s\n' "${resolved}" | sed -n '6p')"
endpoint="$(printf '%s\n' "${resolved}" | sed -n '7p')"
agent_name="$(printf '%s\n' "${resolved}" | sed -n '8p')"
strategy_path="$(printf '%s\n' "${resolved}" | sed -n '9p')"
expertise_path="$(printf '%s\n' "${resolved}" | sed -n '10p')"
expertise_encoded="$(printf '%s\n' "${resolved}" | sed -n '11p')"
expertise_contract="$("${hermes_python}" -c 'import base64, json, sys; data=json.loads(base64.urlsafe_b64decode(sys.argv[1]).decode()); print("Target-model expertise contract (apply throughout this assignment):\n- Model family: " + data["model_family"] + "\n- Observed scope: " + data["observed_scope"] + "\n- Direct language: " + " ".join(data["direct_starting_language"]) + "\n- Translate first: " + " ".join(data["translate_first"]) + "\n- Handoff rule: " + data["handoff_rule"] + "\n- Verification rule: " + data["verification_rule"])' "${expertise_encoded}")"

if [[ "${transport}" == a2a && "${mode}" == check ]]; then
  if ! node "$(dirname "$0")/a2a-client.mjs" check "${endpoint}" "${agent_name}"; then exit 1; fi
  printf 'HERMES_CODER_READY: id=%s profile=%s project=%s branch=%s strategy=%s expertise=%s\n' "${delegate_id}" "${profile_id}" "${project_id}" "${branch}" "${strategy_path}" "${expertise_path}"
  exit 0
fi

printf 'HERMES_CODER_READY: id=%s profile=%s project=%s branch=%s strategy=%s expertise=%s\n' "${delegate_id}" "${profile_id}" "${project_id}" "${branch}" "${strategy_path}" "${expertise_path}"

if [[ "${mode}" == check ]]; then exit 0; fi

prompt="You are the declared Coder endpoint for a human-authorized ${work_profile} ${workflow} Admin-run assignment. Admin is emulating other roles, but your Coder work is real delegation. Write only in ${workspace} on the current named branch ${branch}; you may inspect explicitly authorized read-only reference roots named in the assignment. Use no temporary directories or worktrees. Follow the Coder role and repository rules.

${expertise_contract}

Investigate related files within the assignment's read scope and implement only within its write scope: ${assignment}

Do not commit, push, run builds or tests, manage tickets, edit governance rules, or claim independent review or acceptance. Edit ai-commands only when the assignment explicitly includes its target directory in the allowed write scope; otherwise do not edit ai-commands. If another write root is needed, report it instead of expanding scope. Return changed files, implementation evidence, blockers, and checks that remain for Command Runner or independent review."

if [[ "${transport}" == a2a ]]; then
  printf '%s\n' "${prompt}" | node "$(dirname "$0")/a2a-client.mjs" run "${endpoint}" "${agent_name}"
  exit $?
fi

if [[ -z "${HERMES_WRITE_SAFE_ROOT:-}" ]]; then
  printf '%s\n' 'HERMES_CODER_BLOCKED: HERMES_WRITE_SAFE_ROOT is required for CLI run.' >&2
  exit 1
fi

# Enforce wall-clock timeout for the CLI run
timeout_env="${HERMES_CODER_TIMEOUT_SECONDS-240}"

python_script="$(dirname "$0")/src/run-installer-with-timeout.py"
exec "${python_script}" "${timeout_env}" hermes -p "${profile_id}" chat -Q -t file --query "${prompt}" --in "${workspace}"
