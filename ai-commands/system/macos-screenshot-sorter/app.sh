#!/usr/bin/env bash
# Purpose: launch the macOS Screenshot Sorter Electron settings UI.
# Caller: macos-screenshot-sorter.command.sh `ui` operation after profile activation.
# Input: the active profile environment, including AI_COMMAND_CONFIG_PATH, and
# an optional --force flag to replace an existing Screenshot Sorter instance.
# Effects: opens a local Electron window; settings writes occur only through its
# narrow IPC handlers, which validate and reload the candidate LaunchAgent.
set -euo pipefail

command_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
case "$#" in
  0) force=false ;;
  1) [[ "$1" == '--force' ]] || { printf '%s\n' 'Usage: app.sh [--force]' >&2; exit 2; }; force=true ;;
  *) printf '%s\n' 'Usage: app.sh [--force]' >&2; exit 2 ;;
esac
electron_bin="${SCREENSHOT_SORTER_ELECTRON_BIN:?profile config must set SCREENSHOT_SORTER_ELECTRON_BIN}"
[[ -x "$electron_bin" ]] || {
  printf '%s\n' "SCREENSHOT_SORTER_ELECTRON_REQUIRED: configured runtime is not executable: $electron_bin" >&2
  exit 2
}
main_script="$command_dir/launcher/electron/main.cjs"
if [[ "$force" == true ]]; then
  # The exact Electron main-script path scopes this to Screenshot Sorter; do
  # not terminate an arbitrary Electron application or a different project.
  pattern='[m]acos-screenshot-sorter/launcher/electron/main\.cjs'
  pids="$(pgrep -f "$pattern" || true)"
  if [[ -n "$pids" ]]; then
    kill -TERM $pids 2>/dev/null || true
    for _ in {1..20}; do
      sleep 0.1
      pgrep -f "$pattern" >/dev/null || break
    done
    pids="$(pgrep -f "$pattern" || true)"
    [[ -z "$pids" ]] || kill -KILL $pids 2>/dev/null || true
  fi
fi
SCREENSHOT_SORTER_COMMAND_DIR="$command_dir" exec "$electron_bin" "$main_script"
