#!/usr/bin/env bash
set -euo pipefail

action="${1:-status}"
shift || true

find_app() {
  local candidate
  for candidate in /Applications/ChatGPT.app /Applications/Codex.app; do
    [[ -d "$candidate" ]] && { printf '%s\n' "$candidate"; return 0; }
  done
  return 1
}

case "$action" in
  status)
    app="$(find_app || true)"
    if [[ -z "$app" ]]; then
      printf '%s\n' 'GPT_APP_NOT_INSTALLED'
      exit 1
    fi
    version="$(defaults read "$app/Contents/Info" CFBundleShortVersionString 2>/dev/null || true)"
    build="$(defaults read "$app/Contents/Info" CFBundleVersion 2>/dev/null || true)"
    printf 'GPT_APP_INSTALLED: path=%s version=%s build=%s\n' "$app" "${version:-unknown}" "${build:-unknown}"
    ;;
  check-update|update)
    printf '%s\n' 'GPT_APP_UPDATE_CHECK_UNAVAILABLE: invoke the desktop host trusted update channel.'
    exit 3
    ;;
  install)
    printf '%s\n' 'GPT_APP_INSTALL_UNAVAILABLE: use the official platform-appropriate installer at https://chatgpt.com/download/ and verify the installed application.'
    exit 3
    ;;
  upgrade)
    printf '%s\n' 'GPT_APP_UPGRADE_UNAVAILABLE: invoke the installed desktop application trusted updater.'
    exit 3
    ;;
  uninstall)
    printf '%s\n' 'GPT_APP_UNINSTALL_UNAVAILABLE: no reviewed adapter-owned uninstaller is available; no files were changed.'
    exit 3
    ;;
  -h|--help|help)
    printf '%s\n' 'Usage: lifecycle.sh {status|install|check-update|update|upgrade|uninstall}'
    ;;
  *)
    printf 'Unknown GPT App lifecycle action: %s\n' "$action" >&2
    exit 2
    ;;
esac
