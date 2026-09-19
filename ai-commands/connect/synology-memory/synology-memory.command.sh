#!/usr/bin/env bash
set -euo pipefail
exec "$(cd "$(dirname "$0")/../synology" && pwd)/synology.command.sh" "$@"
