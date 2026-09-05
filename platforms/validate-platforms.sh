#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REGISTRY="$ROOT/platforms/registry.yml"

fail() {
  echo "platform validation: FAIL: $*" >&2
  exit 1
}

test -r "$REGISTRY" || fail "missing registry"
grep -Fq 'id: gpt-app' "$REGISTRY" || fail "gpt-app is not registered"
test -r "$ROOT/platforms/gpt-app/platform.yml" || fail "missing gpt-app contract"
test -r "$ROOT/platforms/gpt-app/agents/initialization.md" || fail "missing gpt-app initializer"
test -r "$ROOT/platforms/gpt-app/workflows/dev/agents.yml" || fail "missing gpt-app Dev roster"
test -r "$ROOT/ai-workflows/dev/agents.yml" || fail "missing portable Dev logical-agent manifest"
test -r "$ROOT/ai-workflows/dev/agents/team.md" || fail "missing portable Dev Team policy"

for role in admin designer-reviewer judge manager coder command-runner ui-acceptance-tester; do
  test -r "$ROOT/ai-workflows/_common/roles/$role.md" || fail "missing portable role: $role"
  grep -Fq "  - role: $role" "$ROOT/platforms/gpt-app/workflows/dev/agents.yml" || fail "missing GPT role binding: $role"
  if test "$role" = admin; then
    grep -Fq '  agentId: admin' "$ROOT/ai-workflows/dev/agents.yml" || fail "missing portable initializer: admin"
  else
    grep -Fq "  - agentId: $role" "$ROOT/ai-workflows/dev/agents.yml" || fail "missing portable logical agent: $role"
  fi
done

if rg -n '^[[:space:]]+(title|model|reasoning):' "$ROOT/ai-workflows/dev/agents.yml" >/dev/null; then
  fail "portable Dev manifest contains platform runtime settings"
fi

echo "platform validation: PASS"
