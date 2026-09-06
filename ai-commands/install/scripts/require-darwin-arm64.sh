#!/usr/bin/env bash

require_darwin_arm64() {
  local operating_system architecture
  operating_system="$(uname -s)"
  architecture="$(uname -m)"
  if [[ "$operating_system" != Darwin || "$architecture" != arm64 ]]; then
    printf 'LOCAL_INSTALL_PLATFORM_UNSUPPORTED: expected Darwin/arm64, found %s/%s.\n' "$operating_system" "$architecture" >&2
    return 4
  fi
}
