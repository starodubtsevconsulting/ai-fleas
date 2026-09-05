#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="${VHE_REPO_ROOT:-$(cd -- "$SCRIPT_DIR/../../.." && pwd)}"
LAUNCHER_DIR="$SCRIPT_DIR/launcher"
NG_BIN="$REPO_ROOT/node_modules/.bin/ng"
ELECTRON_BIN="$REPO_ROOT/node_modules/.bin/electron"
NPM_BIN="${VHE_NPM_BIN:-npm}"
BOOTSTRAP_DRY_RUN="${VHE_BOOTSTRAP_DRY_RUN:-0}"
ELECTRON_ARGS=()
if [[ "$(uname -s)" == "Linux" ]]; then
  ELECTRON_ARGS+=("--no-sandbox" "--disable-setuid-sandbox")
fi
HOST="127.0.0.1"
PORT="${VHE_UI_PORT:-4307}"
URL="http://$HOST:$PORT/"
NG_PID=""
STARTED_SERVER=0

bootstrap_node_deps() {
  local missing=0
  if [[ ! -x "$NG_BIN" ]]; then
    missing=1
  fi
  if [[ ! -x "$ELECTRON_BIN" ]]; then
    missing=1
  fi
  if [[ "$missing" -eq 0 ]]; then
    return
  fi
  if [[ ! -f "$REPO_ROOT/package-lock.json" ]]; then
    echo "Missing Node dependencies and package-lock.json is not available for bootstrap." >&2
    exit 1
  fi
  if ! command -v "$NPM_BIN" >/dev/null 2>&1; then
    echo "Missing Node dependencies and npm is not installed." >&2
    exit 1
  fi

  local npm_command="install"
  if [[ ! -d "$REPO_ROOT/node_modules" ]]; then
    npm_command="ci"
  fi

  if [[ "$BOOTSTRAP_DRY_RUN" == "1" ]]; then
    echo "Would run npm $npm_command for Handwriting Render launcher bootstrap."
    return
  fi

  echo "Installing missing Node dependencies for Handwriting Render launcher with npm $npm_command..." >&2
  # Fresh clones get a clean npm ci. Existing installs are repaired with npm
  # install so launching this command from the already-running Electron app does
  # not delete repo-level node_modules mid-launch.
  (cd "$REPO_ROOT" && "$NPM_BIN" "$npm_command")
}

bootstrap_node_deps

if [[ "$BOOTSTRAP_DRY_RUN" == "1" ]]; then
  exit 0
fi

if [[ ! -x "$NG_BIN" ]]; then
  echo "Missing Angular CLI after dependency bootstrap: $NG_BIN" >&2
  exit 1
fi

if [[ ! -x "$ELECTRON_BIN" ]]; then
  echo "Missing Electron after dependency bootstrap: $ELECTRON_BIN" >&2
  exit 1
fi

if [[ "${1:-}" == "--build-only" ]]; then
  echo "--build-only is deprecated for this local launcher; use --serve-check to validate the no-build dev-server path." >&2
  exit 2
fi

# --focus is passed to Electron to trigger the single-instance focus path.
if [[ "${1:-}" == "--focus" ]]; then
  :
fi

cleanup() {
  if [[ "$STARTED_SERVER" -eq 1 && -n "$NG_PID" ]]; then
    kill "$NG_PID" >/dev/null 2>&1 || true
    wait "$NG_PID" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT INT TERM

if ! curl -fsS "$URL" >/dev/null 2>&1; then
  (cd "$LAUNCHER_DIR" && "$NG_BIN" serve video-handwriting-effect-ui --configuration development --host="$HOST" --port="$PORT") &
  NG_PID="$!"
  STARTED_SERVER=1
fi

for _ in {1..90}; do
  if curl -fsS "$URL" >/dev/null 2>&1; then
    break
  fi
  if [[ "$STARTED_SERVER" -eq 1 ]] && ! kill -0 "$NG_PID" >/dev/null 2>&1; then
    echo "Angular dev server stopped before Electron could start." >&2
    exit 1
  fi
  sleep 0.5
done

if ! curl -fsS "$URL" >/dev/null 2>&1; then
  echo "Timed out waiting for Angular dev server: $URL" >&2
  exit 1
fi

if [[ "${1:-}" == "--serve-check" ]]; then
  if [[ ! -d "$REPO_ROOT/node_modules/playwright" ]]; then
    echo "Missing Playwright dependency for --serve-check: $REPO_ROOT/node_modules/playwright" >&2
    exit 1
  fi
  node - "$URL" "$REPO_ROOT" <<'NODE'
const [url, repoRoot] = process.argv.slice(2);
const { chromium } = require(`${repoRoot}/node_modules/playwright`);
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(url, { waitUntil: 'networkidle' });
  const text = await page.locator('body').innerText();
  await browser.close();
  for (const expected of ['Handwriting Render', 'Ink color', 'Resolution', 'HD 16:9', 'Width', 'Height', 'Output folder']) {
    if (!text.includes(expected)) {
      throw new Error(`Launcher UI did not render expected control: ${expected}`);
    }
  }
  if (errors.length > 0) {
    throw new Error(errors.join('\n'));
  }
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
NODE
  echo "Angular dev server rendered launcher UI: $URL"
  exit 0
fi

VHE_RENDERER_URL="$URL" "$ELECTRON_BIN" "${ELECTRON_ARGS[@]}" "$LAUNCHER_DIR/electron/main.cjs" "$@"
