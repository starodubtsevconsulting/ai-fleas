#!/usr/bin/env bash
set -euo pipefail
readonly COMMAND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly COMMAND="${COMMAND_DIR}/hermes-app.command.sh"
test_root="$(mktemp -d "${TMPDIR:-/tmp}/hermes-command-test.XXXXXX")"
cleanup() { rm -rf -- "${test_root}"; }
trap cleanup EXIT INT TERM
mkdir -p "${test_root}/bin" "${test_root}/ai-profile/example/projects/dev/service" "${test_root}/commands/coding" "${test_root}/commands/hermes-app" "${test_root}/workflows/dev" "${test_root}/workspace" "${test_root}/platforms/hermes/workflows/dev"
touch "${test_root}/AGENTS.md" "${test_root}/README.md" "${test_root}/why.md"
cat >"${test_root}/platforms/registry.yml" <<'YAML'
platforms:
  - id: hermes
    contract: hermes/platform.yml
YAML
printf 'id: hermes\n' >"${test_root}/platforms/hermes/platform.yml"
cat >"${test_root}/platforms/hermes/workflows/dev/agents.yml" <<'YAML'
platform: hermes
workflow: dev
bindings:
  - { role: admin, profile_suffix: admin }
  - { role: coder, profile_suffix: coder }
YAML
printf '# Coding\n' >"${test_root}/commands/coding/coding.command.md"
printf '# Hermes\n' >"${test_root}/commands/hermes-app/hermes-app.command.md"
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
commands:
  - id: hermes-app
    config: local-ai-providers.yml
workflows:
  - path: dev.workflow.md
    harness: hermes
    local_ai: { providers_config: local-ai-providers.yml, provider: example-box, model: example-coder }
    commands:
      - coding
      - hermes-app
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
while (($#)); do
  case "$1" in
    --group) group="$2"; shift 2;;
    --member) member="$2"; shift 2;;
    --title) title="$2"; shift 2;;
    --hide-only) hide_only=true; shift;;
    *) shift;;
  esac
done
if [[ "${hide_only}" == true ]]; then
  printf 'Hermes top-level profile hidden: %s\n' "$member"
  exit 0
fi
printf 'Hermes group member ready: %s (%s as %s)\n' "$group" "$member" "$title"
printf '%s\n' 'example-dev' >>"${HERMES_HOME}/profiles/${member}/profile.yaml"
SH
chmod +x "${test_root}/bin/hermes" "${test_root}/bin/curl" "${test_root}/group-configurator"
printf 'default\nthrowaway\n' >"${test_root}/profiles.state"
export HERMES_BIN="${test_root}/bin/hermes" HERMES_TEST_STATE="${test_root}/profiles.state" HERMES_HOME="${test_root}/hermes-home"
export HERMES_GROUP_CONFIGURATOR="${test_root}/group-configurator" HERMES_PYTHON_BIN='/bin/bash'
mkdir -p "${HERMES_HOME}"
printf '{}\n' >"${HERMES_HOME}/profile.yaml"
export TEST_WORKSPACE="${test_root}/workspace" PATH="${test_root}/bin:${PATH}" AI_CONFIG_PROJECT="${test_root}"
export WORK_PROFILE_ID=example AI_WORK_PROFILE_ID=example AI_FLOW_WORKFLOW=dev.workflow.md
scope="$(node "${COMMAND_DIR}/resolve-profile-scope.mjs" "${test_root}/ai-profile" example dev service)"
[[ "${scope}" == *$'example-box\tExample box\thttp://192.0.2.10:1234/v1\texample-coder-model\t65536\t0.25\t0.15\t8'* ]]
"${COMMAND}" initialize --work-profile example --workflow dev --project service >"${test_root}/output"
grep -F 'Hermes bot ready: example-dev-service-admin' "${test_root}/output" >/dev/null
grep -F 'Hermes bot ready: example-dev-service-coder' "${test_root}/output" >/dev/null
grep -F 'Hermes group member ready: example-dev (example-dev-service-admin as Admin)' "${test_root}/output" >/dev/null
grep -F 'example-dev' "${HERMES_HOME}/profiles/example-dev-service-admin/profile.yaml" >/dev/null
grep -F 'example-dev' "${HERMES_HOME}/profiles/example-dev-service-coder/profile.yaml" >/dev/null
"${COMMAND}" reconcile --work-profile example --workflow dev --project service >"${test_root}/reconcile-output"
grep -F 'Hermes bot ready: example-dev-service-admin' "${test_root}/reconcile-output" >/dev/null
"${COMMAND}" status example-dev-service-admin | grep -F 'HERMES_READY' >/dev/null
"${COMMAND}" delete throwaway --confirm-delete | grep -F 'HERMES_PROFILE_DELETED: throwaway' >/dev/null
printf '%s\n' 'hermes command test passed'
