#!/usr/bin/env bash
set -euo pipefail

report_log_init() {
  local script_label="$1"
  local root_dir="${2:-}"
  local log_dir
  local log_file

  if [ -z "$root_dir" ]; then
    root_dir="$(pwd)"
  fi

  log_dir="${REPORT_LOG_DIR:-$root_dir/logs}"
  mkdir -p "$log_dir"
  log_file="${REPORT_LOG_FILE:-$log_dir/install.log}"

  REPORT_LOG_LABEL="$script_label"
  REPORT_LOG_FILE="$log_file"
  REPORT_LOG_EXISTING_EXIT_TRAP="$(trap -p EXIT | sed -nE "s/^trap -- '(.*)' EXIT$/\1/p")"

  __report_log_on_exit() {
    local ec="$?"
    local ts
    local status
    ts="$(date +%Y-%m-%dT%H:%M:%S%z)"
    if [ "$ec" -eq 0 ]; then
      status=OK
    else
      status=FAIL
    fi
    printf "%s %s %s (%s)\n" "$ts" "${REPORT_LOG_LABEL:-unknown}" "$status" "$ec" >>"${REPORT_LOG_FILE:-report.log}"
    if [ -n "${REPORT_LOG_EXISTING_EXIT_TRAP:-}" ]; then
      eval "${REPORT_LOG_EXISTING_EXIT_TRAP}"
    fi
    return "$ec"
  }

  trap __report_log_on_exit EXIT
}
