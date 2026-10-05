#!/usr/bin/env bash
# Purpose: launch the macOS Screenshot Sorter Electron settings UI.
# Caller: macos-screenshot-sorter.command.sh `ui` operation after profile activation.
# Input: the active profile environment, including AI_COMMAND_CONFIG_PATH.
# Effects: opens a local Electron window; settings writes occur only through its
# narrow IPC handlers, which validate and reload the candidate LaunchAgent.
set -euo pipefail

command_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
electron_bin="${SCREENSHOT_SORTER_ELECTRON_BIN:?profile config must set SCREENSHOT_SORTER_ELECTRON_BIN}"
[[ -x "$electron_bin" ]] || {
  printf '%s\n' "SCREENSHOT_SORTER_ELECTRON_REQUIRED: configured runtime is not executable: $electron_bin" >&2
  exit 2
}
SCREENSHOT_SORTER_COMMAND_DIR="$command_dir" exec "$electron_bin" "$command_dir/launcher/electron/main.cjs"
