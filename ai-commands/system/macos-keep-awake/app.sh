#!/usr/bin/env bash
set -euo pipefail
[[ $# -le 1 ]] || { printf 'Usage: app.sh [--dev]\n' >&2; exit 64; }
configuration=production
case "${1:-}" in
  '') ;;
  --dev) configuration=development ;;
  *) printf 'Usage: app.sh [--dev]\n' >&2; exit 64 ;;
esac
[[ "$(uname -s)" == Darwin ]] || { printf 'MACOS_REQUIRED\n' >&2; exit 1; }
command_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
cd "$command_dir/launcher"
command -v npm >/dev/null || { printf 'NPM_REQUIRED\n' >&2; exit 1; }
if [[ ! -x node_modules/.bin/ng || ! -x node_modules/.bin/electron ]]; then
  if [[ -f package-lock.json ]]; then npm ci; else npm install; fi
fi
# npm security policy may leave the wrapper installed without its vendor binary.
if [[ ! -x node_modules/electron/dist/Electron.app/Contents/MacOS/Electron ]]; then
  printf 'ELECTRON_BINARY_REQUIRED: from launcher run node node_modules/electron/install.js, then retry. No global npm policy change is needed.\n' >&2
  exit 1
fi
npm run build -- --configuration "$configuration"
exec "$command_dir/launcher/node_modules/.bin/electron" "$command_dir/launcher/electron/main.cjs"
