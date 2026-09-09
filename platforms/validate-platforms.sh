#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REGISTRY="$ROOT/platforms/registry.yml"
fail() { echo "platform validation: FAIL: $*" >&2; exit 1; }

test -r "$REGISTRY" || fail "missing registry"
for platform in gpt-agents hermes sc; do
  grep -Fq "id: $platform" "$REGISTRY" || fail "$platform is not registered"
done
test -r "$ROOT/platforms/gpt-agents/platform.yml" || fail "missing GPT Agents platform contract"
test -r "$ROOT/platforms/gpt-agents/agents/initialization.md" || fail "missing GPT Agents initializer"
test -r "$ROOT/platforms/hermes/platform.yml" || fail "missing Hermes contract"
test -r "$ROOT/platforms/hermes/agents/initialization.md" || fail "missing Hermes initializer"
test -r "$ROOT/platforms/sc/platform.yml" || fail "missing SC platform contract"
grep -Fq 'id: gpt-agents' "$ROOT/platforms/gpt-agents/platform.yml" || fail "GPT Agents platform ID mismatch"
grep -Fq 'id: hermes' "$ROOT/platforms/hermes/platform.yml" || fail "Hermes platform ID mismatch"
grep -Fq 'id: sc' "$ROOT/platforms/sc/platform.yml" || fail "SC platform ID mismatch"

echo "platform validation: PASS"
