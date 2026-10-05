# Shared synthetic Hermes installation for hermes-agents.command.test.sh.
# Sourced once by the runner; prepares an isolated home and does not call a model.
readonly COMMAND_DIR="$(cd "${TEST_DIR}/.." && pwd)"
readonly SOURCE_DIR="${COMMAND_DIR}/src"
readonly COMMAND="${COMMAND_DIR}/hermes-agents.command.sh"
bash "${TEST_DIR}/migrate-profile-sessions.test.sh" >/dev/null
bash "${TEST_DIR}/resolve-workflow-scope.test.sh" >/dev/null
bash "${TEST_DIR}/verify-auxiliary-usage.test.sh" >/dev/null
test_root="$(mktemp -d "${TMPDIR:-/tmp}/hermes-command-test.XXXXXX")"
cleanup() { rm -rf -- "${test_root}"; }
trap cleanup EXIT INT TERM
mkdir -p "${test_root}/bin" "${test_root}/ai-profile/example/commands-config/hermes-agents" "${test_root}/ai-profile/example/projects/dev/service" "${test_root}/ai-profile/example/projects/dev/web" "${test_root}/commands/coding" "${test_root}/commands/hermes-agents" "${test_root}/workflows/dev" "${test_root}/workflows/_common/roles" "${test_root}/workflows/_common/agents/schedules" "${test_root}/workspace" "${test_root}/web-workspace" "${test_root}/platforms/hermes"
touch "${test_root}/AGENTS.md" "${test_root}/README.md" "${test_root}/why.md"
cat >"${test_root}/platforms/registry.yml" <<'YAML'
platforms:
  - id: hermes-cli
    contract: hermes/platform.yml
YAML
printf 'id: hermes-cli\n' >"${test_root}/platforms/hermes/platform.yml"
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
platforms:
  default: hermes-cli
  available:
    - hermes-cli
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
    config: commands-config/hermes-agents/config.yml
system_agent:
  scope: system
  cardinality: one-per-platform
  providers_config: local-ai-providers.yml
  schedule:
    enabled: true
    every: 10m
    instruction: _common/agents/schedules/system-lifecycle-monitor.yml
  platform_bindings:
    hermes-cli:
      title: System
      provider: example-box
      model: example-coder
workflows:
  - path: dev.workflow.md
    platform: hermes-cli
    local_ai: { providers_config: local-ai-providers.yml, provider: example-box, model: example-coder }
    commands:
      - coding
      - hermes-agents
    projects:
      - ref: projects/dev/service/project.yml
      - ref: projects/dev/web/project.yml
  - path: external.workflow.md
    platform: codex-app
    projects:
      - ref: projects/dev/service/project.yml
YAML
cat >"${test_root}/ai-profile/example/commands-config/hermes-agents/config.yml" <<'YAML'
schema_version: hermes-agents-command-config.v1
capability: hermes-agents
platform: hermes-cli
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
        hermes: { context_window_tokens: 65536, compression_threshold: 0.25, compression_threshold_tokens: 32768, compression_target: 0.15, protect_last_messages: 8 }
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
    model.context_length) printf '65536\n';; compression.threshold) printf '0.25\n';; compression.threshold_tokens) printf '32768\n';; compression.target_ratio) printf '0.15\n';;
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
