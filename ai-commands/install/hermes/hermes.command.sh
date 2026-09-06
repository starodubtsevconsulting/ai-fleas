#!/usr/bin/env bash
set -euo pipefail
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$(cd "$script_dir/../.." && pwd -P)/_runtime/profile/command-profile.guard.sh"
ai_command_require_profile "hermes" || exit $?
exec "$script_dir/lifecycle.sh" "$@"
