#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROFILE="${ROOT}/example/example-work-profile.yml"

fail() {
  echo "$1" >&2
  exit 1
}

test -r "${PROFILE}" || fail "Missing example work profile"

required=(
  "example/agent-identities.yml"
  "example/validate-agent-identities.py"
  "example/validate-agent-identities.test.sh"
  "example/commands-config/source-control/config.yml"
  "example/commands-config/source-control/identity.example.config"
  "example/commands-config/hermes/config.yml"
  "example/commands-config/lodgify/config.example.env"
  "example/projects/dev/example-service/project.yml"
  "example/projects/dev/example-service/knowledge/local-development.md"
  "example/projects/dev/example-web/project.yml"
  "example/workflows-config/dev/commands/jira/ticket-policy.md"
  "example/workflows-config/dev/commands/jira/description.template.txt"
)

for relative in "${required[@]}"; do
  test -r "${ROOT}/${relative}" || fail "Missing referenced example resource: ${relative}"
done

grep -Fq 'ai_commands_root: ../../ai-commands' "${PROFILE}" || fail "Example must use the AI Commands catalog"
grep -Fq 'ai_workflows_root: ../../ai-workflows' "${PROFILE}" || fail "Example must use the AI Workflows catalog"
grep -Fq 'ai_platforms_root: ../../platforms' "${PROFILE}" || fail "Example must use the platform registry"
grep -Fq 'agent_platform: gpt-app' "${PROFILE}" || fail "Example must select the built-in GPT App platform"
test -r "${ROOT}/../platforms/gpt-app/platform.yml" || fail "Missing built-in GPT App platform contract"
grep -Fq 'config: agent-identities.yml' "${PROFILE}" || fail "Example must reference agent identity configuration"
python3 "${ROOT}/example/validate-agent-identities.py" "${ROOT}/example/agent-identities.yml" example.com
grep -Fq 'policy_references:' "${PROFILE}" || fail "Example tracker context must declare policy references"
grep -Fq 'supported_operations:' "${PROFILE}" || fail "Example tracker context must declare supported operations"
grep -Fq '      logs:' "${PROFILE}" || fail "Example workflow context must declare the logs adapter binding"
grep -Fq '          registered_command: datadog' "${PROFILE}" || fail "Example logs adapter must bind the Datadog provider command"
grep -Fq '          command_path: datadog/datadog.sh' "${PROFILE}" || fail "Example logs adapter must bind the Datadog executable"
grep -Fq '    config: commands-config/hermes/config.yml' "${PROFILE}" || fail "Example must reference sanitized Hermes configuration"
grep -Fq '  root: ${AI_COMMANDS_ROOT}' "${ROOT}/example/commands-config/hermes/config.yml" || fail "Hermes example must use the resolved command root"
grep -Fq 'schema_version: local-ai-providers.v1' "${ROOT}/example/commands-config/hermes/config.yml" || fail "Hermes example must declare the provider-map schema"
grep -Fq '      url: http://192.0.2.10:1234/v1' "${ROOT}/example/commands-config/hermes/config.yml" || fail "Hermes example must use the documented non-operational endpoint"
grep -Fq '        hermes:' "${ROOT}/example/commands-config/hermes/config.yml" || fail "Hermes example must map per-model Hermes settings"
grep -Fq 'EXAMPLE ONLY:' "${ROOT}/example/commands-config/hermes/config.yml" || fail "Hermes config must be labeled as example-only"
grep -Fq 'EXAMPLE ONLY:' "${ROOT}/example/commands-config/lodgify/config.example.env" || fail "Lodgify config must be labeled as example-only"

if rg -n -i '(password|token|secret|private[_ -]?key)[[:space:]]*[:=][[:space:]]*[^<[:space:]]+' "${ROOT}/example"; then
  fail "Example appears to contain a populated secret"
fi

if find "${ROOT}/example" -maxdepth 1 -type d \( -name commands -o -name workflows \) | grep -q .; then
  fail "Legacy profile configuration folders commands/ or workflows/ still exist"
fi

echo 'AI Profile example: PASS'
