#!/usr/bin/env bash
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/../../_runtime/profile" && pwd -P)/command-profile.guard.sh"
ai_command_require_profile "cloudflare-connector" || exit $?
set -euo pipefail

usage() {
  printf '%s\n' \
    'Usage: cloudflare-connector.command.sh status' \
    '       cloudflare-connector.command.sh install --apply'
}

status() {
  if command -v cloudflared >/dev/null 2>&1; then
    printf 'cloudflared installed: path=%s version=%s\n' \
      "$(command -v cloudflared)" "$(cloudflared --version 2>&1 | head -1)"
    return 0
  fi
  printf 'cloudflared missing\n' >&2
  return 1
}

install_connector() {
  if command -v cloudflared >/dev/null 2>&1; then
    status
    return 0
  fi

  if command -v brew >/dev/null 2>&1; then
    brew install cloudflared
  else
    printf '%s\n' \
      'BLOCKED_CLOUDFLARED_INSTALL: no supported package manager was detected' \
      'Install cloudflared from Cloudflare official packages, then rerun status.' >&2
    return 2
  fi

  command -v cloudflared >/dev/null 2>&1 || {
    printf 'BLOCKED_CLOUDFLARED_INSTALL: installation completed but cloudflared is not on PATH\n' >&2
    return 2
  }
  status
}

case "${1:-}" in
  status)
    [[ $# -eq 1 ]] || { usage >&2; exit 2; }
    status
    ;;
  install)
    [[ "${2:-}" == '--apply' && $# -eq 2 ]] || {
      printf 'install requires the exact --apply flag\n' >&2
      exit 2
    }
    install_connector
    ;;
  -h|--help)
    usage
    ;;
  *)
    usage >&2
    exit 2
    ;;
esac
