#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
repo_root="$(cd "$script_dir/../../.." && pwd -P)"
electron_bin="${CLOUDFLARE_ELECTRON_BIN:-}"
launcher_root="$script_dir/launcher"

if [[ ! -x "$launcher_root/node_modules/.bin/ng" ]]; then
  command -v npm >/dev/null 2>&1 || {
    printf 'npm is required to build the Cloudflare tunnel UI.\n' >&2
    exit 1
  }
  (cd "$launcher_root" && npm ci)
fi
(cd "$launcher_root" && npm run build:panel >/dev/null)

if [[ -z "$electron_bin" ]]; then
  for candidate in \
    "$launcher_root/node_modules/.bin/electron" \
    "$repo_root/node_modules/.bin/electron" \
    "$repo_root/ai/node_modules/.bin/electron"
  do
    if [[ -x "$candidate" ]]; then
      electron_bin="$candidate"
      break
    fi
  done
fi

if [[ "${1:-}" != '--serve-check' && -z "$electron_bin" && -f "$launcher_root/package-lock.json" ]]; then
  command -v npm >/dev/null 2>&1 || {
    printf 'npm is required to bootstrap the Cloudflare tunnel UI.\n' >&2
    exit 1
  }
  (cd "$launcher_root" && npm ci)
  electron_bin="$launcher_root/node_modules/.bin/electron"
fi

if [[ "${1:-}" == '--serve-check' ]]; then
  bash -n "$script_dir/controller-service.sh" "$script_dir/service-runner.sh"
  "$script_dir/cloudflare.command.test.sh"
  "$script_dir/controller-service.test.sh"
  node --check "$script_dir/launcher/electron/main.cjs"
  grep -q 'requestSingleInstanceLock' "$script_dir/launcher/electron/main.cjs" || {
    printf 'Cloudflare controller must enforce a single application instance.\n' >&2
    exit 1
  }
  node --check "$script_dir/launcher/electron/preload.cjs"
  node --test "$script_dir/launcher/electron/"*.test.cjs
  node - "$script_dir/launcher/panel-dist/browser/index.html" <<'NODE'
const fs = require('node:fs');
const html = fs.readFileSync(process.argv[2], 'utf8');
if (!html.includes('app-root')) throw new Error('Angular panel root is missing.');
NODE
  printf 'Cloudflare tunnel UI checks passed.\n'
  exit 0
fi

[[ -n "$electron_bin" && -x "$electron_bin" ]] || {
  printf '%s\n' \
    'Electron is not installed for the Cloudflare tunnel UI.' \
    'Set CLOUDFLARE_ELECTRON_BIN or install Electron in the host application runtime.' >&2
  exit 1
}

if [[ "$(uname -s)" == 'Linux' ]]; then
  CLOUDFLARE_COMMAND_DIR="$script_dir" \
    exec "$electron_bin" --no-sandbox --disable-setuid-sandbox "$script_dir/launcher/electron/main.cjs" "$@"
fi

CLOUDFLARE_COMMAND_DIR="$script_dir" \
  exec "$electron_bin" "$script_dir/launcher/electron/main.cjs" "$@"
