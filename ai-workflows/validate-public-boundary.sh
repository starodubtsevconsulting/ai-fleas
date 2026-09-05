#!/usr/bin/env bash
set -euo pipefail

readonly ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"

for forbidden in mcp events '*-backend' '*-frontend'; do
  if find "$ROOT" -type d \( -name node_modules -o -name test-results \) -prune -o \
    -type d -name "$forbidden" -print -quit | grep -q .; then
    echo "public workflow boundary violation: forbidden directory $forbidden" >&2
    exit 1
  fi
done

if find "$ROOT" -type f \( -name 'ui-registry.*' -o -name '*.sqlite*' \) -print -quit | grep -q .; then
  echo 'public workflow boundary violation: implementation file' >&2
  exit 1
fi

if rg -n -i '^(frontend|backend|mcp|events|runtime_commands):|endpoint_path:|health_path:|shutdown_path:|transport:[[:space:]]' \
  "$ROOT" --glob 'workflow.yml' >/dev/null; then
  echo 'public workflow boundary violation: implementation manifest field' >&2
  exit 1
fi

# Portable workflow and role prose may describe abstract agents and lifecycle
# requirements, but concrete host/runtime vocabulary belongs under platforms/.
if rg -n -i 'codex|gpt-[0-9]|hermes|app-returned|runtime[ -]project|taskid\b|task ids?\b|thread ids?\b|sidebar' \
  "$ROOT/agents.md" "$ROOT/_common/roles" "$ROOT/dev" --glob '*.md' >/dev/null; then
  echo 'public workflow boundary violation: platform-specific agent mechanics in portable rules' >&2
  rg -n -i 'codex|gpt-[0-9]|hermes|app-returned|runtime[ -]project|taskid\b|task ids?\b|thread ids?\b|sidebar' \
    "$ROOT/agents.md" "$ROOT/_common/roles" "$ROOT/dev" --glob '*.md' >&2
  exit 1
fi

echo 'public workflow boundary: PASS'
