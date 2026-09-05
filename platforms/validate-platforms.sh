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

for role in admin designer-reviewer judge manager coder command-runner ui-acceptance-tester; do
  test -r "$ROOT/ai-workflows/_common/roles/$role.md" || fail "missing portable role: $role"
  grep -Fq "  - role: $role" "$ROOT/platforms/gpt-app/workflows/dev/agents.yml" || fail "missing GPT role binding: $role"
done

echo "platform validation: PASS"
