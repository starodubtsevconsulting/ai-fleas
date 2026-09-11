#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VERSION_FILE="$SCRIPT_DIR/version.json"

if grep -q '"ready": false' "$VERSION_FILE"; then
  echo "SNAPSHOT_NOT_RUNNABLE: install-ai-local-provider is not implemented and tested yet." >&2
  exit 2
fi

echo "install-ai-local-provider implementation is not available." >&2
exit 2
