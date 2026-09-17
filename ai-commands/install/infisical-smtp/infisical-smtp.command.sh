#!/usr/bin/env bash
set -euo pipefail
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
source "$script_dir/../../_runtime/profile/command-profile.guard.sh"
ai_command_require_profile infisical-smtp || exit $?
PYTHONDONTWRITEBYTECODE=1 python3 "$script_dir/runner.py" "$@"
