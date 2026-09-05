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
  "example/commands/source-control/config.yml"
  "example/commands/source-control/identity.example.config"
  "example/projects/dev/example-service/project.yml"
  "example/projects/dev/example-service/knowledge/local-development.md"
  "example/projects/dev/example-web/project.yml"
  "example/workflows/dev/commands/jira/ticket-policy.md"
  "example/workflows/dev/commands/jira/description.template.txt"
)

for relative in "${required[@]}"; do
  test -r "${ROOT}/${relative}" || fail "Missing referenced example resource: ${relative}"
done

grep -Fq 'ai_commands_root: ../../ai-commands' "${PROFILE}" || fail "Example must use the sibling AI Commands catalog"
grep -Fq 'ai_workflows_root: ../../ai-workflows' "${PROFILE}" || fail "Example must use the sibling AI Workflows catalog"
grep -Fq 'ai_platforms_root: ../../platforms' "${PROFILE}" || fail "Example must use the sibling platform registry"
grep -Fq 'agent_platform: gpt-app' "${PROFILE}" || fail "Example must select the built-in GPT App platform"
test -r "${ROOT}/../platforms/gpt-app/platform.yml" || fail "Missing built-in GPT App platform contract"
grep -Fq 'config: agent-identities.yml' "${PROFILE}" || fail "Example must reference agent identity configuration"
python3 "${ROOT}/example/validate-agent-identities.py" "${ROOT}/example/agent-identities.yml" example.com
grep -Fq 'policy_references:' "${PROFILE}" || fail "Example tracker context must declare policy references"
grep -Fq 'supported_operations:' "${PROFILE}" || fail "Example tracker context must declare supported operations"

if rg -n -i '(password|token|secret|private[_ -]?key)[[:space:]]*[:=][[:space:]]*[^<[:space:]]+' "${ROOT}/example"; then
  fail "Example appears to contain a populated secret"
fi

echo 'AI Profile example: PASS'
