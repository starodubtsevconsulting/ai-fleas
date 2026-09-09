#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
hermes_command="$script_dir/../../hermes-agents/hermes-agents.command.sh"
# shellcheck disable=SC1091
source "$script_dir/../scripts/require-darwin-arm64.sh"
action="${1:-status}" # Physical Hermes package action.
shift || true
component="bundle"
if [[ "${1:-}" == --component ]]; then
  [[ -n "${2:-}" ]] || { printf '%s\n' 'HERMES_COMPONENT_REQUIRED' >&2; exit 2; }
  component="$2"
  shift 2
fi
case "$component" in
  bundle) ;;
  *) printf 'HERMES_COMPONENT_UNSUPPORTED: %s\n' "$component" >&2; exit 3 ;;
esac

resolve_hermes() {
  if [[ -n "${HERMES_BIN:-}" && -x "$HERMES_BIN" ]]; then
    printf '%s\n' "$HERMES_BIN"
  elif command -v hermes >/dev/null 2>&1; then
    command -v hermes
  elif [[ -x "${HOME}/.local/bin/hermes" ]]; then
    printf '%s\n' "${HOME}/.local/bin/hermes"
  else
    return 1
  fi
}

smoke_test() {
  local hermes_bin probe_home
  hermes_bin="$(resolve_hermes || true)"
  [[ -n "$hermes_bin" ]] || { printf '%s\n' 'HERMES_APP_SMOKE_FAILED: executable is not installed.' >&2; return 1; }
  probe_home="$(mktemp -d "${TMPDIR:-/tmp}/hermes-install-smoke.XXXXXX")"
  trap 'rm -rf -- "$probe_home"' RETURN
  HOME="$probe_home" HERMES_HOME="$probe_home/.hermes" NO_PROXY='*' no_proxy='*' \
    HTTP_PROXY='http://127.0.0.1:9' HTTPS_PROXY='http://127.0.0.1:9' "$hermes_bin" --version >/dev/null
  HOME="$probe_home" HERMES_HOME="$probe_home/.hermes" NO_PROXY='*' no_proxy='*' \
    HTTP_PROXY='http://127.0.0.1:9' HTTPS_PROXY='http://127.0.0.1:9' "$hermes_bin" --help >/dev/null
  printf '%s\n' 'HERMES_APP_SMOKE_PASS: version and offline help probes succeeded.'
}

case "$action" in
  status)
    require_darwin_arm64
    hermes_bin="$(resolve_hermes || true)"
    if [[ -z "$hermes_bin" ]]; then
      printf '%s\n' 'HERMES_APP_NOT_INSTALLED'
      exit 1
    fi
    "$hermes_bin" --version
    ;;
  smoke-test)
    require_darwin_arm64
    smoke_test
    ;;
  check-update|update)
    require_darwin_arm64
    exec "$hermes_command" check-update "$@"
    ;;
  install|upgrade)
    require_darwin_arm64
    "$hermes_command" install "$@"
    smoke_test
    ;;
  uninstall)
    require_darwin_arm64
    printf '%s\n' 'HERMES_APP_UNINSTALL_UNAVAILABLE: no reviewed adapter-owned uninstaller is available; profiles and conversations were preserved.'
    exit 3
    ;;
  -h|--help|help)
    printf '%s\n' 'Usage: lifecycle.sh {status|smoke-test|install|check-update|update|upgrade|uninstall} [--component bundle]'
    ;;
  *)
    printf 'Unknown Hermes App lifecycle action: %s\n' "$action" >&2
    exit 2
    ;;
esac
