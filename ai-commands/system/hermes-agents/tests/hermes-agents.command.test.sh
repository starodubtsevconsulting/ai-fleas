#!/usr/bin/env bash
set -euo pipefail
readonly TEST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly COMMAND_DIR="$(cd "${TEST_DIR}/.." && pwd)"
readonly SOURCE_DIR="${COMMAND_DIR}/src"
readonly COMMAND="${COMMAND_DIR}/hermes-agents.command.sh"
bash "${TEST_DIR}/migrate-profile-sessions.test.sh" >/dev/null
bash "${TEST_DIR}/resolve-workflow-scope.test.sh" >/dev/null
test_root="$(mktemp -d "${TMPDIR:-/tmp}/hermes-command-test.XXXXXX")"
cleanup() { rm -rf -- "${test_root}"; }
trap cleanup EXIT INT TERM
mkdir -p "${test_root}/bin" "${test_root}/ai-profile/example/projects/dev/service" "${test_root}/ai-profile/example/projects/dev/web" "${test_root}/commands/coding" "${test_root}/commands/hermes-agents" "${test_root}/workflows/dev" "${test_root}/workflows/_common/roles" "${test_root}/workflows/_common/agents/schedules" "${test_root}/workspace" "${test_root}/web-workspace" "${test_root}/platforms/hermes"
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
  aiBinding: profile-default
agents:
  - agentId: coder
    aiBinding: profile-default
YAML
printf '# Coding\n' >"${test_root}/commands/coding/coding.command.md"
printf '# Hermes\n' >"${test_root}/commands/hermes-agents/hermes-agents.command.md"
printf '# Dev\n' >"${test_root}/workflows/dev/dev.workflow.md"
printf '# System\n' >"${test_root}/workflows/_common/roles/system.md"
printf 'instruction: monitor\n' >"${test_root}/workflows/_common/agents/schedules/system-lifecycle-monitor.yml"
printf '# Instructions\n' >"${test_root}/ai-profile/example/AGENTS.md"
cat >"${test_root}/ai-profile/example/example-work-profile.yml" <<YAML
version: 3
name: example
default_workflow: dev.workflow.md
agent_platform: hermes
agent_platforms:
  default: hermes
  available:
    - hermes
governance_rules_repository: example-rules
governance_rules_surface:
  - AGENTS.md
  - README.md
  - why.md
agent_instructions_path: AGENTS.md
ai_commands_root: ../../commands
ai_workflows_root: ../../workflows
ai_platforms_root: ../../platforms
commands:
  - id: hermes-agents
    config: local-ai-providers.yml
system_agent:
  scope: system
  cardinality: one-per-platform
  providers_config: local-ai-providers.yml
  schedule:
    enabled: true
    every: 10m
    instruction: _common/agents/schedules/system-lifecycle-monitor.yml
  platform_bindings:
    hermes:
      title: System
      provider: example-box
      model: example-coder
workflows:
  - path: dev.workflow.md
    harness: hermes
    local_ai: { providers_config: local-ai-providers.yml, provider: example-box, model: example-coder }
    commands:
      - coding
      - hermes-agents
    projects:
      - ref: projects/dev/service/project.yml
      - ref: projects/dev/web/project.yml
  - path: external.workflow.md
    harness: gpt-agents
    projects:
      - ref: projects/dev/service/project.yml
YAML
cat >"${test_root}/ai-profile/example/local-ai-providers.yml" <<'YAML'
schema_version: local-ai-providers.v1
providers:
  - id: example-box
    label: Example box
    protocol: openai-compatible
    endpoint:
      default: local
      connections:
        local:
          url: 'http://192.0.2.10:1234/v1'
        remote:
          url: 'https://example-model.invalid/v1'
          headers:
            CF-Access-Client-Id: { environment_variable: TEST_CF_ACCESS_CLIENT_ID }
            CF-Access-Client-Secret: { environment_variable: TEST_CF_ACCESS_CLIENT_SECRET }
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
cat >"${test_root}/ai-profile/example/projects/dev/web/project.yml" <<YAML
id: web
label: Example web
repo_path: ${test_root}/web-workspace
YAML
cat >"${test_root}/bin/hermes" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
if [[ "$1" == --version ]]; then printf 'Hermes Agent v0.20.5 (2026.8.19) · test\n'; exit 0; fi
if [[ "$1" == profile && "$2" == create ]]; then mkdir -p "${HERMES_HOME}/profiles/$3"; printf '{}\n' >"${HERMES_HOME}/profiles/$3/profile.yaml"; printf '%s\n' "$3" >>"${HERMES_TEST_STATE}"; exit 0; fi
if [[ "$1" == profile && "$2" == list ]]; then printf 'Profile Model\n'; while read -r id; do printf '%s model\n' "$id"; done <"${HERMES_TEST_STATE}"; exit 0; fi
if [[ "$1" == profile && "$2" == show ]]; then printf 'Profile: %s\n' "$3"; exit 0; fi
if [[ "$1" == profile && "$2" == delete ]]; then grep -Fxv "$3" "${HERMES_TEST_STATE}" >"${HERMES_TEST_STATE}.next" || true; mv "${HERMES_TEST_STATE}.next" "${HERMES_TEST_STATE}"; exit 0; fi
if [[ "$1" == -p && "$3" == config && "$4" == set ]]; then
  [[ "${HERMES_TEST_FAIL_PROFILE:-}" != "$2" ]] || exit 42
  if [[ "${5:-}" == --force && "${6:-}" == providers.* ]]; then
    printf '%s\n' "$7" >>"${HERMES_TEST_PROVIDER_LOG}"
  fi
  exit 0
fi
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
if [[ "$*" == *test-client-secret* ]]; then
  printf '%s\n' 'protected header appeared in curl process arguments' >&2
  exit 97
fi
headers="$(cat)"
if [[ "$*" == *example-model.invalid* && "${headers}" != *test-client-secret* ]]; then
  printf '%s\n' 'protected header was not delivered through curl stdin' >&2
  exit 98
fi
printf '{"data":[{"id":"%s"}]}\n' "${HERMES_TEST_ADVERTISED_MODEL:-example-coder-model}"
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
cat >"${test_root}/binding-writer" <<'SH'
#!/usr/bin/env bash
exit 0
SH
chmod +x "${test_root}/bin/hermes" "${test_root}/bin/git" "${test_root}/bin/curl" "${test_root}/group-configurator" "${test_root}/binding-writer"
printf 'default\nthrowaway\n' >"${test_root}/profiles.state"
export HERMES_BIN="${test_root}/bin/hermes" HERMES_TEST_STATE="${test_root}/profiles.state" HERMES_HOME="${test_root}/hermes-home"
export HERMES_TEST_PROVIDER_LOG="${test_root}/provider-config.log"
export HERMES_GROUP_CONFIGURATOR="${test_root}/group-configurator" HERMES_PYTHON_BIN='/bin/bash'
export HERMES_WORKFLOW_BINDING_WRITER="${test_root}/binding-writer" HERMES_BINDING_PYTHON_BIN='/bin/bash'
export HERMES_REINITIALIZE_SYNC_SECONDS=0
mkdir -p "${HERMES_HOME}"
printf '{}\n' >"${HERMES_HOME}/profile.yaml"
export TEST_WORKSPACE="${test_root}/workspace" PATH="${test_root}/bin:${PATH}" AI_CONFIG_PROJECT="${test_root}"
export WORK_PROFILE_ID=example AI_WORK_PROFILE_ID=example AI_FLOW_WORKFLOW=dev.workflow.md
scope="$(node "${SOURCE_DIR}/resolve-workflow-scope.mjs" "${test_root}/ai-profile" example dev service)"
[[ "${scope}" == *$'example-box\tExample box\thttp://192.0.2.10:1234/v1\t'* ]]
system_scope="$(node "${SOURCE_DIR}/resolve-system-scope.mjs" "${test_root}/ai-profile" example)"
[[ "${system_scope}" == *$'\t10m\texample-dev' ]]
[[ "${system_scope}" != *'example-external'* ]]
"${COMMAND}" initialize-system --work-profile example --validate-only >"${test_root}/system-local-preflight-output"
grep -F 'HERMES_SYSTEM_REINITIALIZE_PREFLIGHT_READY: profile=example-system watch=example-dev; no System changes were made.' "${test_root}/system-local-preflight-output" >/dev/null
if node "${SOURCE_DIR}/resolve-system-scope.mjs" "${test_root}/ai-profile" example remote >"${test_root}/system-remote-missing-secret-output" 2>&1; then
  printf '%s\n' 'System resolver unexpectedly accepted a protected remote connection without credentials' >&2
  exit 1
fi
grep -F 'connection requires secret environment variable TEST_CF_ACCESS_CLIENT_ID' "${test_root}/system-remote-missing-secret-output" >/dev/null
export TEST_CF_ACCESS_CLIENT_ID=test-client-id TEST_CF_ACCESS_CLIENT_SECRET=test-client-secret
remote_system_scope="$(node "${SOURCE_DIR}/resolve-system-scope.mjs" "${test_root}/ai-profile" example remote)"
[[ "${remote_system_scope}" == *$'\thttps://example-model.invalid/v1\t'* ]]
remote_headers_b64="$(cut -f7 <<<"${remote_system_scope}")"
[[ "$(printf '%s' "${remote_headers_b64}" | base64 --decode)" == '{"CF-Access-Client-Id":"test-client-id","CF-Access-Client-Secret":"test-client-secret"}' ]]
remote_stored_headers_b64="$(cut -f8 <<<"${remote_system_scope}")"
[[ "$(printf '%s' "${remote_stored_headers_b64}" | base64 --decode)" == '{"CF-Access-Client-Id":"${env:TEST_CF_ACCESS_CLIENT_ID}","CF-Access-Client-Secret":"${env:TEST_CF_ACCESS_CLIENT_SECRET}"}' ]]
"${COMMAND}" initialize-system --work-profile example --instance 2 --connection remote --validate-only >"${test_root}/system-remote-preflight-output"
grep -F 'HERMES_SYSTEM_REINITIALIZE_PREFLIGHT_READY: profile=example-system-2 watch=example-dev; no System changes were made.' "${test_root}/system-remote-preflight-output" >/dev/null
receipt_test_path="${test_root}/system-receipts.yml"
receipt_python="${HERMES_RECEIPT_TEST_PYTHON:-${HOME}/.hermes/hermes-agent/venv/bin/python}"
[[ -x "${receipt_python}" ]] || receipt_python=python3
"${receipt_python}" "${SOURCE_DIR}/write-system-receipt.py" --path "${receipt_test_path}" --profile example-system --title example-system --provider example-box --model example-model --every 10m --scheduler-id canonical-job --watch-group example-dev
"${receipt_python}" "${SOURCE_DIR}/write-system-receipt.py" --path "${receipt_test_path}" --profile example-system-2 --instance 2 --title example-system-2 --provider example-box --model example-model --every 10m --scheduler-id test-job --watch-group example-dev
RECEIPT_PATH="${receipt_test_path}" "${receipt_python}" -c 'import os,yaml; d=yaml.safe_load(open(os.environ["RECEIPT_PATH"])); assert d["system"]["profile_id"] == "example-system"; assert d["system_instances"]["example-system-2"]["profile_id"] == "example-system-2"'
unset AI_FLOW_WORKFLOW
if "${COMMAND}" reinitialize-system --work-profile example >"${test_root}/system-reinitialize-without-confirm" 2>&1; then
  printf '%s\n' 'reinitialize-system unexpectedly succeeded without confirmation' >&2
  exit 1
fi
grep -F 'HERMES_SYSTEM_REINITIALIZE_CONFIRMATION_REQUIRED' "${test_root}/system-reinitialize-without-confirm" >/dev/null
if "${COMMAND}" initialize-system --work-profile example --watch-group other-dev >"${test_root}/cross-profile-watch-output" 2>&1; then
  printf '%s\n' 'initialize-system unexpectedly accepted a cross-profile watch group' >&2
  exit 1
fi
grep -F "HERMES_SYSTEM_WATCH_SCOPE_INVALID: System for work profile 'example' cannot watch 'other-dev'; allowed Hermes workflow groups: example-dev. No System changes were made." "${test_root}/cross-profile-watch-output" >/dev/null
export AI_FLOW_WORKFLOW=dev.workflow.md
export HERMES_TEST_ADVERTISED_MODEL=different-model
profiles_before="$(cat "${HERMES_TEST_STATE}")"
if "${COMMAND}" initialize --work-profile example --workflow dev --project service >"${test_root}/missing-model-output" 2>"${test_root}/missing-model-error"; then
  printf '%s\n' 'initialize unexpectedly succeeded with an unadvertised model' >&2
  exit 1
fi
[[ "$(grep -c '^HERMES_MODEL_NOT_ADVERTISED:' "${test_root}/missing-model-error")" -eq 2 ]]
grep -F 'profile=example-dev-admin provider=example-box model=example-coder-model; advertised=different-model; no profile changes were made.' "${test_root}/missing-model-error" >/dev/null
grep -F 'profile=example-dev-coder provider=example-box model=example-coder-model; advertised=different-model; no profile changes were made.' "${test_root}/missing-model-error" >/dev/null
grep -F 'HERMES_WORKFLOW_PREFLIGHT_FAILED: group=example-dev agents=2 failed_agents=2 failed_profiles=example-dev-admin,example-dev-coder; all provider/model errors are listed above; no workflow profiles were changed.' "${test_root}/missing-model-error" >/dev/null
[[ "$(cat "${HERMES_TEST_STATE}")" == "${profiles_before}" ]]
unset HERMES_TEST_ADVERTISED_MODEL
unset AI_FLOW_WORKFLOW
if "${COMMAND}" status-system --work-profile example >"${test_root}/system-status-output" 2>&1; then
  printf '%s\n' 'status-system unexpectedly succeeded without a System receipt' >&2
  exit 1
fi
grep -F 'HERMES_SYSTEM_NOT_INITIALIZED: example' "${test_root}/system-status-output" >/dev/null
if grep -F 'select a workflow' "${test_root}/system-status-output" >/dev/null; then
  printf '%s\n' 'profile-scoped System command incorrectly required a workflow' >&2
  exit 1
fi
export AI_FLOW_WORKFLOW=dev.workflow.md
"${COMMAND}" check-update >"${test_root}/check-update-output"
grep -F 'Installed: v2026.8.19' "${test_root}/check-update-output" >/dev/null
grep -F 'Latest stable: v2026.8.31' "${test_root}/check-update-output" >/dev/null
grep -F 'HERMES_UPDATE_AVAILABLE' "${test_root}/check-update-output" >/dev/null
"${COMMAND}" initialize --work-profile example --workflow dev --project service >"${test_root}/output"
grep -F 'Hermes bot ready: example-dev-admin' "${test_root}/output" >/dev/null
grep -F 'Hermes bot ready: example-dev-coder' "${test_root}/output" >/dev/null
grep -F 'Hermes provider configured: profile=example-dev-admin provider=example-box endpoint=http://192.0.2.10:1234/v1 headers=none' "${test_root}/output" >/dev/null
grep -F 'Hermes group member ready: example-dev (example-dev-admin as Admin)' "${test_root}/output" >/dev/null
grep -F 'HERMES_WORKFLOW_PREFLIGHT: group=example-dev agents=2' "${test_root}/output" >/dev/null
grep -F 'HERMES_WORKFLOW_READY: group=example-dev agents=2 all_agents_ready=true profiles=example-dev-admin,example-dev-coder' "${test_root}/output" >/dev/null
grep -F 'HERMES_RUNTIME_NOTE: while Hermes Desktop is open, it may run one local Python backend per active profile' "${test_root}/output" >/dev/null
grep -F 'Your complete ordered project scope is:' "${HERMES_HOME}/profiles/example-dev-admin/SOUL.md" >/dev/null
grep -F "${test_root}/workspace" "${HERMES_HOME}/profiles/example-dev-admin/SOUL.md" >/dev/null
grep -F "${test_root}/web-workspace" "${HERMES_HOME}/profiles/example-dev-admin/SOUL.md" >/dev/null
grep -F 'example-dev' "${HERMES_HOME}/profiles/example-dev-admin/profile.yaml" >/dev/null
grep -F 'example-dev' "${HERMES_HOME}/profiles/example-dev-coder/profile.yaml" >/dev/null
"${COMMAND}" initialize --work-profile example --workflow dev --project service --instance remote-log --connection remote >"${test_root}/protected-output"
grep -F 'Hermes provider configured: profile=example-dev-remote-log-admin provider=example-box endpoint=https://example-model.invalid/v1 headers=protected' "${test_root}/protected-output" >/dev/null
grep -F '"CF-Access-Client-Secret": "${env:TEST_CF_ACCESS_CLIENT_SECRET}"' "${HERMES_TEST_PROVIDER_LOG}" >/dev/null || grep -F '"CF-Access-Client-Secret":"${env:TEST_CF_ACCESS_CLIENT_SECRET}"' "${HERMES_TEST_PROVIDER_LOG}" >/dev/null
if grep -F 'test-client-secret' "${HERMES_TEST_PROVIDER_LOG}" >/dev/null; then
  printf '%s\n' 'protected provider secret persisted in Hermes config' >&2
  exit 1
fi
if grep -F 'test-client-secret' "${test_root}/protected-output" >/dev/null; then
  printf '%s\n' 'protected provider secret leaked into initialization output' >&2
  exit 1
fi
export HERMES_TEST_FAIL_PROFILE=example-dev-coder
if "${COMMAND}" reconcile --work-profile example --workflow dev --project service >"${test_root}/partial-output" 2>"${test_root}/partial-error"; then
  printf '%s\n' 'reconcile unexpectedly succeeded after injected profile failure' >&2
  exit 1
fi
grep -F 'HERMES_WORKFLOW_PARTIAL_FAILURE: group=example-dev failed_profile=example-dev-coder completed_profiles=example-dev-admin; binding receipt was not written.' "${test_root}/partial-error" >/dev/null
unset HERMES_TEST_FAIL_PROFILE
"${COMMAND}" reconcile --work-profile example --workflow dev --project service >"${test_root}/reconcile-output"
grep -F 'Hermes bot ready: example-dev-admin' "${test_root}/reconcile-output" >/dev/null
if "${COMMAND}" reinitialize --work-profile example --workflow dev --project service >"${test_root}/reinitialize-without-confirm" 2>&1; then
  printf '%s\n' 'reinitialize unexpectedly succeeded without confirmation' >&2
  exit 1
fi
grep -F 'HERMES_REINITIALIZE_CONFIRMATION_REQUIRED' "${test_root}/reinitialize-without-confirm" >/dev/null
"${COMMAND}" re-init --work-profile example --workflow dev --project service --confirm-reinitialize >"${test_root}/reinitialize-output"
grep -F 'HERMES_WORKFLOW_PREFLIGHT_READY: group=example-dev agents=2 no_profiles_changed=true' "${test_root}/reinitialize-output" >/dev/null
grep -F 'HERMES_WORKFLOW_DELETED: example-dev (service)' "${test_root}/reinitialize-output" >/dev/null
[[ "$(grep -nE 'HERMES_WORKFLOW_PREFLIGHT_READY|HERMES_WORKFLOW_DELETED' "${test_root}/reinitialize-output" | head -n 1)" == *HERMES_WORKFLOW_PREFLIGHT_READY* ]]
grep -F 'Hermes bot ready: example-dev-admin' "${test_root}/reinitialize-output" >/dev/null
grep -F 'Hermes bot ready: example-dev-coder' "${test_root}/reinitialize-output" >/dev/null
[[ "$(grep -Ec '^example-dev-(admin|coder)$' "${HERMES_TEST_STATE}")" -eq 2 ]]
"${COMMAND}" status example-dev-admin | grep -F 'HERMES_READY' >/dev/null
cat >"${HERMES_HOME}/profiles/example-dev-admin/config.yaml" <<'YAML'
providers:
  example-box:
    extra_headers:
      CF-Access-Client-Id: ${env:TEST_CF_ACCESS_CLIENT_ID}
      CF-Access-Client-Secret: ${env:TEST_CF_ACCESS_CLIENT_SECRET}
YAML
if env -u TEST_CF_ACCESS_CLIENT_SECRET HERMES_PYTHON_BIN="${receipt_python}" "${COMMAND}" status example-dev-admin >"${test_root}/status-missing-header" 2>&1; then
  printf '%s\n' 'Protected Hermes status unexpectedly succeeded without its secret' >&2
  exit 1
fi
grep -F 'HERMES_STATUS_HEADER_UNAVAILABLE' "${test_root}/status-missing-header" >/dev/null
HERMES_PYTHON_BIN="${receipt_python}" "${COMMAND}" status example-dev-admin >"${test_root}/status-protected-output" 2>&1
grep -F 'HERMES_READY' "${test_root}/status-protected-output" >/dev/null
if grep -F -e 'test-client-id' -e 'test-client-secret' "${test_root}/status-protected-output" >/dev/null; then
  printf '%s\n' 'Protected Hermes status exposed a header value' >&2
  exit 1
fi
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

# A workflow selecting secrets validates its profile binding before any Hermes mutation.
mkdir -p "${test_root}/commands/connect/secrets" "${test_root}/ai-profile/example/commands-config"
printf '%s\n' '# Secrets command' >"${test_root}/commands/connect/secrets/secrets.command.md"
printf '%s\n' 'provider: none' >"${test_root}/ai-profile/example/commands-config/secrets.yml"
cat >"${test_root}/commands/connect/secrets/secrets.command.sh" <<'SH'
#!/usr/bin/env bash
[[ "${1:-}" == validate && "${HERMES_TEST_SECRETS_FAIL:-}" != 1 ]] || exit 2
printf '%s\n' 'secrets configuration valid'
SH
chmod +x "${test_root}/commands/connect/secrets/secrets.command.sh"
python3 - "${test_root}/ai-profile/example/example-work-profile.yml" <<'PY'
from pathlib import Path
import sys
target = Path(sys.argv[1])
source = target.read_text()
source = source.replace('  - id: hermes-agents\n    config: local-ai-providers.yml\n',
                        '  - id: hermes-agents\n    config: local-ai-providers.yml\n  - id: secrets\n    config: commands-config/secrets.yml\n', 1)
source = source.replace('      - hermes-agents\n', '      - hermes-agents\n      - secrets\n', 1)
target.write_text(source)
PY
profiles_before="$(cat "${HERMES_TEST_STATE}")"
if HERMES_TEST_SECRETS_FAIL=1 "${COMMAND}" initialize --work-profile example --workflow dev --project service --preflight-only >"${test_root}/secrets-failed-output" 2>"${test_root}/secrets-failed-error"; then
  printf '%s\n' 'initialize accepted an invalid secrets binding' >&2
  exit 1
fi
grep -F 'HERMES_SECRETS_PREFLIGHT_FAILED:' "${test_root}/secrets-failed-error" >/dev/null
[[ "$(cat "${HERMES_TEST_STATE}")" == "${profiles_before}" ]]
"${COMMAND}" initialize --work-profile example --workflow dev --project service --preflight-only >"${test_root}/secrets-preflight-output"
grep -F 'HERMES_SECRETS_CONFIG_READY: profile=example workflow=dev; configuration only, provider and consumer access not tested.' "${test_root}/secrets-preflight-output" >/dev/null
[[ "$(cat "${HERMES_TEST_STATE}")" == "${profiles_before}" ]]
printf '%s\n' 'hermes command test passed'
