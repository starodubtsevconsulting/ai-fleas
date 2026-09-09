#!/usr/bin/env bash
set -euo pipefail
readonly COMMAND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly COMMAND="${COMMAND_DIR}/hermes-agents.command.sh"
test_root="$(mktemp -d "${TMPDIR:-/tmp}/hermes-command-test.XXXXXX")"
cleanup() { rm -rf -- "${test_root}"; }
trap cleanup EXIT INT TERM
mkdir -p "${test_root}/bin" "${test_root}/ai-profile/example/projects/dev/service" "${test_root}/commands/coding" "${test_root}/commands/hermes-agents" "${test_root}/workflows/dev" "${test_root}/workspace" "${test_root}/platforms/hermes"
touch "${test_root}/AGENTS.md" "${test_root}/README.md" "${test_root}/why.md"
cat >"${test_root}/platforms/registry.yml" <<'YAML'
platforms:
  - id: hermes
    contract: hermes/platform.yml
YAML
printf 'id: hermes\n' >"${test_root}/platforms/hermes/platform.yml"
cat >"${test_root}/workflows/dev/agents.yml" <<'YAML'
schemaVersion: workflow-logical-agents.v1
workflowId: dev
initializer:
  agentId: admin
  aiProvider: profile-default
agents:
  - agentId: coder
    aiProvider: profile-default
YAML
printf '# Coding\n' >"${test_root}/commands/coding/coding.command.md"
printf '# Hermes\n' >"${test_root}/commands/hermes-agents/hermes-agents.command.md"
printf '# Dev\n' >"${test_root}/workflows/dev/dev.workflow.md"
printf '# Instructions\n' >"${test_root}/ai-profile/example/AGENTS.md"
cat >"${test_root}/ai-profile/example/example-work-profile.yml" <<YAML
version: 3
name: example
default_workflow: dev.workflow.md
agent_platform: hermes
governance_rules_repository: example-rules
governance_rules_surface:
  - AGENTS.md
  - README.md
  - why.md
agent_instructions_path: AGENTS.md
ai_commands_root: ../../commands
ai_workflows_root: ../../workflows
ai_platforms_root: ../../platforms
commands:\n  - id: hermes-agents
    config: local-ai-providers.yml
workflows:
  - path: dev.workflow.md
    harness: hermes
    local_ai: { providers_config: local-ai-providers.yml, provider: example-box, model: example-coder }
    commands:
      - coding\n      - hermes-agents
    projects:
      - ref: projects/dev/service/project.yml
YAML
cat >"${test_root}/ai-profile/example/local-ai-providers.yml" <<'YAML'
schema_version: local-ai-providers.v1
providers:
  - id: example-box
    label: Example box
    protocol: openai-compatible
    endpoint: { url: 'http://192.0.2.10:1234/v1' }
    models:
      - id: example-coder
        provider_model: example-coder-model
        hermes: { context_window_tokens: 65536, compression_threshold: 0.25, compression_target: 0.15, protect_last_messages: 8 }
YAML
cat >"${test_root}/ai-profile/example/projects/dev/service/project.yml" <<YAML
id: service
label: Example service
repo_path: ${test_root}/workspace
YAML
cat >"${test_root}/bin/hermes" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
if [[ "$1" == --version ]]; then printf 'Hermes Agent v0.20.5 (2026.8.19) · test\n'; exit 0; fi
if [[ "$1" == profile && "$2" == create ]]; then mkdir -p "${HERMES_HOME}/profiles/$3"; printf '{}\n' >"${HERMES_HOME}/profiles/$3/profile.yaml"; printf '%s\n' "$3" >>"${HERMES_TEST_STATE}"; exit 0; fi
if [[ "$1" == profile && "$2" == list ]]; then printf 'Profile Model\n'; while read -r id; do printf '%s model\n' "$id"; done <"${HERMES_TEST_STATE}"; exit 0; fi
if [[ "$1" == profile && "$2" == show ]]; then printf 'Profile: %s\n' "$3"; exit 0; fi
if [[ "$1" == profile && "$2" == delete ]]; then grep -Fxv "$3" "${HERMES_TEST_STATE}" >"${HERMES_TEST_STATE}.next" || true; mv "${HERMES_TEST_STATE}.next" "${HERMES_TEST_STATE}"; exit 0; fi
if [[ "$1" == -p && "$3" == config && "$4" == set ]]; then exit 0; fi
if [[ "$1" == -p && "$3" == config && "$4" == get ]]; then
  case "$5" in
    model.provider) printf 'example-box\n';; model.default) printf 'example-coder-model\n';; model.base_url) printf 'http://192.0.2.10:1234/v1\n';;
    model.context_length) printf '65536\n';; compression.threshold) printf '0.25\n';; compression.target_ratio) printf '0.15\n';;
    compression.protect_last_n) printf '8\n';; terminal.cwd) printf '%s\n' "${TEST_WORKSPACE}";;
  esac
  exit 0
fi
exit 1
SH
cat >"${test_root}/bin/git" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
if [[ "$1" == ls-remote ]]; then
  printf '%s\t%s\n' deadbeef refs/tags/v2026.8.19
  printf '%s\t%s\n' feedface refs/tags/v2026.8.31
  exit 0
fi
exec /usr/bin/git "$@"
SH
cat >"${test_root}/bin/curl" <<'SH'
#!/usr/bin/env bash
printf '%s\n' '{"data":[{"id":"example-coder-model"}]}'
SH
cat >"${test_root}/group-configurator" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
group=''
member=''
title=''
hide_only=false
delete_group=false
while (($#)); do
  case "$1" in
    --group) group="$2"; shift 2;;
    --member) member="$2"; shift 2;;
    --title) title="$2"; shift 2;;
    --hide-only) hide_only=true; shift;;
    --delete-group) delete_group=true; shift;;
    *) shift;;
  esac
done
if [[ "${delete_group}" == true ]]; then
  printf 'Hermes group deleted: %s\n' "$group"
  exit 0
fi
if [[ "${hide_only}" == true ]]; then
  printf 'Hermes top-level profile hidden: %s\n' "$member"
  exit 0
fi
printf 'Hermes group member ready: %s (%s as %s)\n' "$group" "$member" "$title"
printf '%s\n' 'example-dev' >>"${HERMES_HOME}/profiles/${member}/profile.yaml"
SH
chmod +x "${test_root}/bin/hermes" "${test_root}/bin/git" "${test_root}/bin/curl" "${test_root}/group-configurator"
printf 'default\nthrowaway\n' >"${test_root}/profiles.state"
export HERMES_BIN="${test_root}/bin/hermes" HERMES_TEST_STATE="${test_root}/profiles.state" HERMES_HOME="${test_root}/hermes-home"
export HERMES_GROUP_CONFIGURATOR="${test_root}/group-configurator" HERMES_PYTHON_BIN='/bin/bash'
export HERMES_REINITIALIZE_SYNC_SECONDS=0
mkdir -p "${HERMES_HOME}"
printf '{}\n' >"${HERMES_HOME}/profile.yaml"
export TEST_WORKSPACE="${test_root}/workspace" PATH="${test_root}/bin:${PATH}" AI_CONFIG_PROJECT="${test_root}"
export WORK_PROFILE_ID=example AI_WORK_PROFILE_ID=example AI_FLOW_WORKFLOW=dev.workflow.md
scope="$(node "${COMMAND_DIR}/resolve-profile-scope.mjs" "${test_root}/ai-profile" example dev service)"
[[ "${scope}" == *$'example-box\tExample box\thttp://192.0.2.10:1234/v1\texample-coder-model\t65536\t0.25\t0.15\t8'* ]]
"${COMMAND}" check-update >"${test_root}/check-update-output"
grep -F 'Installed: v2026.8.19' "${test_root}/check-update-output" >/dev/null
grep -F 'Latest stable: v2026.8.31' "${test_root}/check-update-output" >/dev/null
grep -F 'HERMES_UPDATE_AVAILABLE' "${test_root}/check-update-output" >/dev/null
"${COMMAND}" initialize --work-profile example --workflow dev --project service >"${test_root}/output"
grep -F 'Hermes bot ready: example-dev-admin' "${test_root}/output" >/dev/null
grep -F 'Hermes bot ready: example-dev-coder' "${test_root}/output" >/dev/null
grep -F 'Hermes group member ready: example-dev (example-dev-admin as Admin)' "${test_root}/output" >/dev/null
grep -F 'example-dev' "${HERMES_HOME}/profiles/example-dev-admin/profile.yaml" >/dev/null
grep -F 'example-dev' "${HERMES_HOME}/profiles/example-dev-coder/profile.yaml" >/dev/null
"${COMMAND}" reconcile --work-profile example --workflow dev --project service >"${test_root}/reconcile-output"
grep -F 'Hermes bot ready: example-dev-admin' "${test_root}/reconcile-output" >/dev/null
if "${COMMAND}" reinitialize --work-profile example --workflow dev --project service >"${test_root}/reinitialize-without-confirm" 2>&1; then
  printf '%s\n' 'reinitialize unexpectedly succeeded without confirmation' >&2
  exit 1
fi
grep -F 'HERMES_REINITIALIZE_CONFIRMATION_REQUIRED' "${test_root}/reinitialize-without-confirm" >/dev/null
"${COMMAND}" re-init --work-profile example --workflow dev --project service --confirm-reinitialize >"${test_root}/reinitialize-output"
grep -F 'HERMES_WORKFLOW_DELETED: example-dev (service)' "${test_root}/reinitialize-output" >/dev/null
grep -F 'Hermes bot ready: example-dev-admin' "${test_root}/reinitialize-output" >/dev/null
grep -F 'Hermes bot ready: example-dev-coder' "${test_root}/reinitialize-output" >/dev/null
[[ "$(grep -Ec '^example-dev-(admin|coder)$' "${HERMES_TEST_STATE}")" -eq 2 ]]
"${COMMAND}" status example-dev-admin | grep -F 'HERMES_READY' >/dev/null
"${COMMAND}" delete throwaway --confirm-delete | grep -F 'HERMES_PROFILE_DELETED: throwaway' >/dev/null
if "${COMMAND}" delete-workflow --work-profile example --workflow dev --project service >"${test_root}/delete-without-confirm" 2>&1; then
  printf '%s\n' 'delete-workflow unexpectedly succeeded without confirmation' >&2
  exit 1
fi
grep -F 'HERMES_DELETE_CONFIRMATION_REQUIRED' "${test_root}/delete-without-confirm" >/dev/null
"${COMMAND}" delete-workflow --work-profile example --workflow dev --project service --confirm-delete >"${test_root}/delete-workflow-output"
grep -F 'HERMES_PROFILE_DELETED: example-dev-admin' "${test_root}/delete-workflow-output" >/dev/null
grep -F 'HERMES_PROFILE_DELETED: example-dev-coder' "${test_root}/delete-workflow-output" >/dev/null
grep -F 'HERMES_WORKFLOW_DELETED: example-dev (service)' "${test_root}/delete-workflow-output" >/dev/null
grep -Fx 'default' "${HERMES_TEST_STATE}" >/dev/null
if grep -E '^example-dev-(admin|coder)$' "${HERMES_TEST_STATE}" >/dev/null; then
  printf '%s\n' 'delete-workflow left a declared role profile behind' >&2
  exit 1
fi
printf '%s\n' 'hermes command test passed'
