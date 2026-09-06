#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$script_dir/../scripts/require-darwin-arm64.sh"
action="${1:-status}"
shift || true
component="app"
if [[ "${1:-}" == --component ]]; then
  [[ -n "${2:-}" ]] || { printf '%s\n' 'CHATGPT_COMPONENT_REQUIRED' >&2; exit 2; }
  component="$2"
  shift 2
fi
case "$component" in
  app|desktop-app) ;;
  *) printf 'CHATGPT_COMPONENT_UNSUPPORTED: %s\n' "$component" >&2; exit 3 ;;
esac

find_app() {
  local candidate
  for candidate in ${GPT_APP_TEST_PATH:-} /Applications/ChatGPT.app /Applications/Codex.app; do
    [[ -n "$candidate" ]] || continue
    [[ -d "$candidate" ]] && { printf '%s\n' "$candidate"; return 0; }
  done
  return 1
}

case "$action" in
  status)
    require_darwin_arm64
    app="$(find_app || true)"
    if [[ -z "$app" ]]; then
      printf '%s\n' 'GPT_APP_NOT_INSTALLED'
      exit 1
    fi
    version="$(defaults read "$app/Contents/Info" CFBundleShortVersionString 2>/dev/null || true)"
    build="$(defaults read "$app/Contents/Info" CFBundleVersion 2>/dev/null || true)"
    printf 'GPT_APP_INSTALLED: path=%s version=%s build=%s\n' "$app" "${version:-unknown}" "${build:-unknown}"
    ;;
  smoke-test)
    require_darwin_arm64
    app="$(find_app || true)"
    [[ -n "$app" ]] || { printf '%s\n' 'GPT_APP_SMOKE_FAILED: application is not installed.' >&2; exit 1; }
    info="$app/Contents/Info.plist"
    executable_name="$(defaults read "$app/Contents/Info" CFBundleExecutable 2>/dev/null || true)"
    [[ -f "$info" && -n "$executable_name" && -x "$app/Contents/MacOS/$executable_name" ]] || {
      printf '%s\n' 'GPT_APP_SMOKE_FAILED: application bundle is incomplete.' >&2; exit 1;
    }
    codesign --verify --deep --strict "$app" 2>/dev/null || {
      printf '%s\n' 'GPT_APP_SMOKE_FAILED: application signature verification failed.' >&2; exit 1;
    }
    printf '%s\n' 'GPT_APP_SMOKE_PASS: bundle, executable, and signature verified.'
    ;;
  check-update|update)
    require_darwin_arm64
    printf '%s\n' 'GPT_APP_UPDATE_CHECK_UNAVAILABLE: invoke the desktop host trusted update channel.'
    exit 3
    ;;
  install)
    require_darwin_arm64
    printf '%s\n' 'GPT_APP_INSTALL_UNAVAILABLE: use the official platform-appropriate installer at https://chatgpt.com/download/ and verify the installed application.'
    exit 3
    ;;
  upgrade)
    require_darwin_arm64
    printf '%s\n' 'GPT_APP_UPGRADE_UNAVAILABLE: invoke the installed desktop application trusted updater.'
    exit 3
    ;;
  uninstall)
    require_darwin_arm64
    printf '%s\n' 'GPT_APP_UNINSTALL_UNAVAILABLE: no reviewed adapter-owned uninstaller is available; no files were changed.'
    exit 3
    ;;
  -h|--help|help)
    printf '%s\n' 'Usage: lifecycle.sh {status|smoke-test|install|check-update|update|upgrade|uninstall} [--component app]'
    ;;
  *)
    printf 'Unknown ChatGPT lifecycle action: %s\n' "$action" >&2
    exit 2
    ;;
esac
