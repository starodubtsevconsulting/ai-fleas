#!/usr/bin/env bash
set -euo pipefail
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
source "$script_dir/../../_runtime/profile/command-profile.guard.sh"
ai_command_require_profile infisical || exit $?
[[ "$#" == 1 && "$1" == --apply ]] || { printf 'Smoke test requires --apply\n' >&2; exit 2; }
python3 "$script_dir/smoke_test.py"
