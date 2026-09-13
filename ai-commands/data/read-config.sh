#!/bin/bash

set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
if [ $# -lt 1 ]; then
  echo "Usage: read-config.sh <command-name>"
  exit 1
fi

COMMAND_NAME="$1"
CONFIG_PATH="${AI_COMMAND_CONFIG_PATH:-}"
if [[ -z "$CONFIG_PATH" || ! -f "$CONFIG_PATH" ]]; then
  echo "Profile-owned config required for '$COMMAND_NAME' (AI_COMMAND_CONFIG_PATH)." >&2
  exit 2
fi
# shellcheck disable=SC1090
. "$CONFIG_PATH"
