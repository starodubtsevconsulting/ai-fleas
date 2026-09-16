#!/usr/bin/env bash
set -euo pipefail
exec node "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)/lodgify.command.mjs" "$@"
