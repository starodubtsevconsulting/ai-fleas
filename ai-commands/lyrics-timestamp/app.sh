#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="${LYRICS_TIMESTAMP_REPO_ROOT:-$(cd -- "$SCRIPT_DIR/../../.." && pwd)}"
APP_ROOT="${LYRICS_TIMESTAMP_APP_ROOT:-$REPO_ROOT/ai}"
ELECTRON_BIN="$APP_ROOT/node_modules/.bin/electron"
NPM_BIN="${LYRICS_TIMESTAMP_NPM_BIN:-npm}"
BOOTSTRAP_DRY_RUN="${LYRICS_TIMESTAMP_BOOTSTRAP_DRY_RUN:-0}"
ELECTRON_ARGS=()
if [[ "$(uname -s)" == "Linux" ]]; then
  ELECTRON_ARGS+=("--no-sandbox" "--disable-setuid-sandbox")
fi

bootstrap_node_deps() {
  if [[ -x "$ELECTRON_BIN" ]]; then
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
    echo "Would run npm $npm_command for Lyrics Timestamp bootstrap."
    return
  fi
  echo "Installing missing Node dependencies for Lyrics Timestamp with npm $npm_command..." >&2
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
  node --check "$SCRIPT_DIR/launcher/electron/lyrics-timestamp-actions.cjs"
  node --check "$SCRIPT_DIR/launcher/electron/lyrics-timestamp-actions.test.cjs"
  node --check "$SCRIPT_DIR/launcher/renderer/lyrics-timestamp-timing.js"
  node --check "$SCRIPT_DIR/launcher/renderer/lyrics-timestamp-timing.test.cjs"
  node --test "$SCRIPT_DIR/launcher/electron/lyrics-timestamp-actions.test.cjs"
  node --test "$SCRIPT_DIR/launcher/renderer/lyrics-timestamp-timing.test.cjs"
  node - "$SCRIPT_DIR/launcher/panel/index.html" <<'NODE'
const fs = require('node:fs');
const html = fs.readFileSync(process.argv[2], 'utf8');
const scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map((match) => match[1]);
for (const script of scripts) {
  new Function(script);
}
NODE
  node - "$SCRIPT_DIR/launcher/electron/main.cjs" <<'NODE'
const fs = require('node:fs');
const main = fs.readFileSync(process.argv[2], 'utf8');
for (const expected of ['setMenuBarVisibility(false)', 'setAutoHideMenuBar(true)']) {
  if (!main.includes(expected)) {
    throw new Error(`Electron main is missing expected menu setting: ${expected}`);
  }
}
NODE
  LYRICS_TIMESTAMP_PANEL_HTML="$SCRIPT_DIR/launcher/panel/index.html" NODE_PATH="$APP_ROOT/node_modules" node "$SCRIPT_DIR/launcher/renderer/lyrics-timestamp-renderer.e2e.cjs"
  node - "$SCRIPT_DIR/launcher/panel/index.html" <<'NODE'
const fs = require('node:fs');
const html = fs.readFileSync(process.argv[2], 'utf8');
for (const expected of ['Lyrics Timestamp', 'Lyrics file', 'Audio file', 'Timing hints file', 'Mapped lyrics', 'Raw JSON', 'Save', 'Play', 'playbackProgress', 'waveform', 'waveform-canvas', 'loadExisting', 'Loaded existing mapped file', 'loadedExistingMapping', 'data-line-index', 'lyrics-timestamp-timing.js', 'timestamp-time-editor', 'timestamp-sync-button', 'Use current playback time for start', 'Synced and saved', 'Start s', 'End s', 'Seek to']) {
  if (!html.includes(expected)) {
    throw new Error(`Renderer is missing expected text: ${expected}`);
  }
}
NODE
  echo "Lyrics Timestamp launcher checks passed."
  exit 0
fi

LYRICS_TIMESTAMP_REPO_ROOT="$REPO_ROOT" \
LYRICS_TIMESTAMP_APP_ROOT="$APP_ROOT" \
LYRICS_TIMESTAMP_COMMAND_DIR="$SCRIPT_DIR" \
"$ELECTRON_BIN" "${ELECTRON_ARGS[@]}" "$SCRIPT_DIR/launcher/electron/main.cjs" "$@"
