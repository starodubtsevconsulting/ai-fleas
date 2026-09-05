#!/usr/bin/env bash
set -euo pipefail

report_log_wrapper_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$report_log_wrapper_dir/report.step.sh"
