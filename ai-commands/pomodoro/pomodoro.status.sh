#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STATUS_JS="$SCRIPT_DIR/service/cli/pomodoro.status.cli.js"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required for pomodoro status" >&2
  exit 2
fi

if [[ ! -f "$STATUS_JS" ]]; then
  echo "Pomodoro status service is missing: $STATUS_JS" >&2
  exit 2
fi

exec node "$STATUS_JS" "$@"
