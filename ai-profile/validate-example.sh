#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROFILE="${ROOT}/example/example-work-profile.yml"

fail() { echo "$1" >&2; exit 1; }

test -r "${PROFILE}" || fail "Missing example work profile"
grep -Fq 'ai_commands_root: ../../ai-commands' "${PROFILE}" || fail "Example must use the AI Commands catalog"
grep -Fq 'ai_workflows_root: ../../ai-workflows' "${PROFILE}" || fail "Example must use the AI Workflows catalog"
grep -Fq 'ai_platforms_root: ../../platforms' "${PROFILE}" || fail "Example must use the platform registry"
grep -Fq 'agent_platforms:' "${PROFILE}" || fail "Example must declare available agent platforms"
grep -Fq '  default: gpt-agents' "${PROFILE}" || fail "Example must declare the default platform"
for platform in gpt-agents hermes sc; do
  grep -Fq "    - ${platform}" "${PROFILE}" || fail "Example must expose platform: ${platform}"
done
test -r "${ROOT}/../platforms/gpt-agents/platform.yml" || fail "Missing GPT Agents platform contract"
test -r "${ROOT}/../platforms/hermes/platform.yml" || fail "Missing Hermes platform contract"
test -r "${ROOT}/../platforms/sc/platform.yml" || fail "Missing SC platform contract"
grep -Fq 'config: agent-identities.yml' "${PROFILE}" || fail "Example must reference agent identity configuration"
python3 "${ROOT}/example/validate-agent-identities.py" "${ROOT}/example/agent-identities.yml" example.com
node "${ROOT}/validate-profile-structure.mjs" "${PROFILE}"
SC_PROFILE="${ROOT}/sc/sc-work-profile.yml"
if [[ -f "${SC_PROFILE}" ]]; then
  node "${ROOT}/validate-profile-structure.mjs" "${SC_PROFILE}"
fi

echo 'AI Profile example: PASS'
