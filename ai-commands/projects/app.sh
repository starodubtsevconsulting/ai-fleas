#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="${PROJECT_CREATOR_REPO_ROOT:-$(cd -- "$SCRIPT_DIR/../.." && pwd)}"
APP_ROOT="${PROJECT_CREATOR_APP_ROOT:-$REPO_ROOT/ai}"
ELECTRON_BIN="$APP_ROOT/node_modules/.bin/electron"
NPM_BIN="${PROJECT_CREATOR_NPM_BIN:-npm}"
BOOTSTRAP_DRY_RUN="${PROJECT_CREATOR_BOOTSTRAP_DRY_RUN:-0}"
ELECTRON_ARGS=()
if [[ "$(uname -s)" == "Linux" ]]; then
  ELECTRON_ARGS+=("--no-sandbox" "--disable-setuid-sandbox")
fi

bootstrap_node_deps() {
  if [[ -x "$ELECTRON_BIN" && -x "$APP_ROOT/node_modules/.bin/tsx" ]]; then
    return
  fi
  if [[ ! -f "$APP_ROOT/package-lock.json" ]]; then
    echo "Missing Node dependencies and package-lock.json is not available for bootstrap: $APP_ROOT" >&2
    exit 1
  fi
  if ! command -v "$NPM_BIN" >/dev/null 2>&1; then
    echo "Missing Node dependencies and npm is not installed." >&2
    exit 1
  fi
  local npm_command="install"
  if [[ ! -d "$APP_ROOT/node_modules" ]]; then
    npm_command="ci"
  fi
  if [[ "$BOOTSTRAP_DRY_RUN" == "1" ]]; then
    echo "Would run npm $npm_command for Project Creator bootstrap."
    return
  fi
  echo "Installing missing Node dependencies for Project Creator with npm $npm_command..." >&2
  (cd "$APP_ROOT" && "$NPM_BIN" "$npm_command")
}

bootstrap_node_deps

if [[ "$BOOTSTRAP_DRY_RUN" == "1" ]]; then
  exit 0
fi

if [[ ! -x "$ELECTRON_BIN" ]]; then
  echo "Missing Electron after dependency bootstrap: $ELECTRON_BIN" >&2
  exit 1
fi

if [[ "${1:-}" == "--serve-check" ]]; then
  node --check "$SCRIPT_DIR/launcher/electron/main.cjs"
  node --check "$SCRIPT_DIR/launcher/electron/preload.cjs"
  node --check "$SCRIPT_DIR/launcher/electron/project-creator-actions.cjs"
  node --check "$SCRIPT_DIR/launcher/electron/project-creator-actions.test.cjs"
  node --test "$SCRIPT_DIR/launcher/electron/project-creator-actions.test.cjs"
  (cd "$APP_ROOT" && npx tsx ../ai-commands/projects/domain/projects-cli.ts spec-template --name "Serve Check Project" --content-type song --release-type video >/dev/null)
  echo "Project Creator launcher checks passed."
  exit 0
fi

PROJECT_CREATOR_REPO_ROOT="$REPO_ROOT" \
PROJECT_CREATOR_APP_ROOT="$APP_ROOT" \
PROJECT_CREATOR_CONFIG_ROOT="${AI_CONFIG_ROOT:-$REPO_ROOT/ai-config}" \
PROJECT_CREATOR_COMMAND_ROOT="$SCRIPT_DIR" \
"$ELECTRON_BIN" "${ELECTRON_ARGS[@]}" "$SCRIPT_DIR/launcher/electron/main.cjs" "$@"
