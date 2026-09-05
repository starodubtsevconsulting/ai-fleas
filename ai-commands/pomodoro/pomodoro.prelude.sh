#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PRELUDE_JS="$SCRIPT_DIR/service/cli/pomodoro.prelude.cli.js"

if ! command -v node >/dev/null 2>&1; then
  exit 0
fi

if [[ ! -f "$PRELUDE_JS" ]]; then
  exit 0
fi

exec node "$PRELUDE_JS" "$@"
