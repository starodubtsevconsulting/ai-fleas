#!/usr/bin/env bash
set -euo pipefail
COMMAND_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
exec node "$COMMAND_DIR/pi-agents.mjs" "$@"
