#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
action="${1:-status}"
shift || true

platform="$(uname -s)"

docker_status() {
  if ! command -v docker >/dev/null 2>&1; then
    printf '%s\n' 'DOCKER_NOT_INSTALLED'
    return 1
  fi
  version="$(docker --version 2>/dev/null || true)"
  compose="$(docker compose version 2>/dev/null || true)"
  printf 'DOCKER_INSTALLED: version=%s compose=%s\n' "${version:-unknown}" "${compose:-unavailable}"
}

docker_smoke_test() {
  docker_status >/dev/null || { printf '%s\n' 'DOCKER_SMOKE_FAILED: Docker CLI is not installed.' >&2; return 1; }
  docker info >/dev/null 2>&1 || { printf '%s\n' 'DOCKER_SMOKE_FAILED: Docker daemon is unavailable.' >&2; return 1; }
  docker compose version >/dev/null 2>&1 || { printf '%s\n' 'DOCKER_SMOKE_FAILED: Compose plugin is unavailable.' >&2; return 1; }
  printf '%s\n' 'DOCKER_SMOKE_PASS: CLI, daemon, and Compose plugin verified.'
}

case "$action" in
  status)
    docker_status
    ;;
  smoke-test)
    docker_smoke_test
    ;;
  install)
    if [[ "$platform" != Linux ]] || [[ ! -r /etc/os-release ]] || ! grep -q '^ID=ubuntu$' /etc/os-release; then
      printf 'DOCKER_INSTALL_UNAVAILABLE: reviewed installer supports Ubuntu only; detected %s.\n' "$platform" >&2
      exit 3
    fi
    bash "$script_dir/install.sh"
    docker_smoke_test
    ;;
  check-update|update)
    printf '%s\n' 'DOCKER_UPDATE_CHECK_UNAVAILABLE: no reviewed stable-channel comparison is available.'
    exit 3
    ;;
  upgrade)
    printf '%s\n' 'DOCKER_UPGRADE_UNAVAILABLE: no reviewed upgrade adapter is available; no packages were changed.' >&2
    exit 3
    ;;
  uninstall)
    printf '%s\n' 'DOCKER_UNINSTALL_UNAVAILABLE: no reviewed adapter-owned uninstaller is available; no packages were changed.' >&2
    exit 3
    ;;
  -h|--help|help)
    printf '%s\n' 'Usage: install.sh docker {status|smoke-test|install|check-update|update|upgrade|uninstall}'
    ;;
  *)
    printf 'Unknown Docker lifecycle action: %s\n' "$action" >&2
    exit 2
    ;;
esac
