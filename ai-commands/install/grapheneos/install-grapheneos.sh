#!/usr/bin/env bash
set -euo pipefail

COMMAND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUNTIME="$COMMAND_DIR/../../commands/command-runtime.sh"

if [[ ! -f "$RUNTIME" ]]; then
  echo "ERROR: shared AI Commands runtime not found: $RUNTIME" >&2
  exit 2
fi

# shellcheck source=/dev/null
source "$RUNTIME"
ai_command_require_runnable "$COMMAND_DIR/version.json" || exit $?

# Execution below this line is reachable only for runnable command versions.
# GrapheneOS implementation will be added from install-grapheneos.spec.md.

echo "GrapheneOS installer implementation is not available yet."
exit 2
