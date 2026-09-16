#!/usr/bin/env bash
set -euo pipefail
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
source "$script_dir/../../_runtime/profile/command-profile.guard.sh"
ai_command_require_profile infisical || exit $?
source "$script_dir/../scripts/report-log.sh"
REPORT_LOG_DIR="${REPORT_LOG_DIR:-$(dirname "$AI_PROFILE_FILE")/.local/command-logs/infisical}"
export REPORT_LOG_DIR
report_log_init infisical "$script_dir"
# Keep the EXIT logging trap in this shell. Python emits only value-free receipts.
python3 "$script_dir/runner.py" "$@"
