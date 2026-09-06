#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
hermes_command="$script_dir/../../hermes-app/hermes-app.command.sh"
action="${1:-status}"
shift || true

case "$action" in
  status)
    if command -v hermes >/dev/null 2>&1; then
      hermes --version
    elif [[ -x "${HOME}/.local/bin/hermes" ]]; then
      "${HOME}/.local/bin/hermes" --version
    else
      printf '%s\n' 'HERMES_APP_NOT_INSTALLED'
      exit 1
    fi
    ;;
  check-update|update)
    exec "$hermes_command" check-update "$@"
    ;;
  install|upgrade)
    exec "$hermes_command" install "$@"
    ;;
  uninstall)
    printf '%s\n' 'HERMES_APP_UNINSTALL_UNAVAILABLE: no reviewed adapter-owned uninstaller is available; profiles and conversations were preserved.'
    exit 3
    ;;
  -h|--help|help)
    printf '%s\n' 'Usage: lifecycle.sh {status|install|check-update|update|upgrade|uninstall}'
    ;;
  *)
    printf 'Unknown Hermes App lifecycle action: %s\n' "$action" >&2
    exit 2
    ;;
esac
