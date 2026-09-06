#!/usr/bin/env bash
set -euo pipefail
# Provider implementation is intentionally kept in resolve-profile-scope.mjs and the Hermes role mapping.
# This command remains on the established lifecycle implementation until the focused tests are updated
# to consume the per-role provider payload without changing unrelated lifecycle behavior.
exec "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/hermes-app.command.sh.base" "$@"
