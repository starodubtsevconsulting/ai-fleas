#!/usr/bin/env bash
# Purpose: launch the macOS Screenshot Sorter Electron settings UI.
# Caller: macos-screenshot-sorter.command.sh `ui` operation after profile activation.
# Input: the active profile environment, including AI_COMMAND_CONFIG_PATH, and
# an optional --force flag to replace an existing Screenshot Sorter instance.
# Effects: opens a local Electron window; settings writes occur only through its
# narrow IPC handlers, which validate and reload the candidate LaunchAgent.
set -euo pipefail

command_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
export AI_COMMAND_CONFIG_PATH="${AI_COMMAND_CONFIG_PATH:-$command_dir/macos-screenshot-sorter.default.config}"
force=false
dev=false
case "$#" in
  0) ;;
  1)
    case "$1" in
      --force) force=true ;;
      --dev) dev=true; force=true ;;
      *) printf '%s\n' 'Usage: app.sh [--dev|--force]' >&2; exit 2 ;;
    esac
    ;;
  *) printf '%s\n' 'Usage: app.sh [--dev|--force]' >&2; exit 2 ;;
esac
electron_bin="${SCREENSHOT_SORTER_ELECTRON_BIN:-}"
if [[ "$dev" == true ]]; then
  repo_root="$(git -C "$command_dir" rev-parse --show-toplevel 2>/dev/null || true)"
  if [[ -n "$repo_root" ]]; then
    printf 'Updating development branch...\n'
    git -C "$repo_root" pull --ff-only
  fi
  export AI_COMMAND_CONFIG_PATH="$command_dir/macos-screenshot-sorter.default.config"
  unset SCREENSHOT_SORTER_ELECTRON_BIN || true
  electron_bin=""
fi
if [[ -z "$electron_bin" ]]; then
  if [[ ! -x "$command_dir/launcher/node_modules/.bin/electron" ]]; then
    command -v npm >/dev/null 2>&1 || { printf '%s\n' 'npm is required to bootstrap the Screenshot Sorter UI.' >&2; exit 2; }
    (cd "$command_dir/launcher" && npm install)
  fi
  electron_bin="$command_dir/launcher/node_modules/.bin/electron"
fi
[[ -x "$electron_bin" ]] || {
  printf '%s\n' "SCREENSHOT_SORTER_ELECTRON_REQUIRED: configured runtime is not executable: $electron_bin" >&2
  exit 2
}
main_script="$command_dir/launcher/electron/main.cjs"
if [[ "$dev" == true ]]; then
  export ANGULAR_DEV=1
  printf 'Starting Angular dev server...\n'
  cd "$command_dir/launcher/renderer-angular"
  npx ng serve --port 4200 --host 127.0.0.1 > /tmp/ng-serve.log 2>&1 &
  printf 'Waiting for Angular dev server to be ready...\n'
  for _ in {1..30}; do
    if curl -s http://127.0.0.1:4200/ > /dev/null 2>&1; then
      printf 'Angular dev server is ready.\n'
      break
    fi
    sleep 1
  done
  printf 'Starting Electron with Angular dev server...\n'
fi
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
SCREENSHOT_SORTER_COMMAND_DIR="$command_dir" exec "$electron_bin" "$main_script" "$@"
