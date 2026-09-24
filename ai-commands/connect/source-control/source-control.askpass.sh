#!/usr/bin/env bash
set -euo pipefail

case "${1:-}" in
  *sername*) printf '%s\n' "${SOURCE_CONTROL_USERNAME:?}" ;;
  *assword*) printf '%s\n' "${SOURCE_CONTROL_TOKEN:?}" ;;
  *) exit 1 ;;
esac
