#!/usr/bin/env bash
set -euo pipefail

install_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
bash -n "$install_dir/remote-desktop/remote-desktop.command.sh" "$install_dir/remote-desktop/lifecycle.sh" "$install_dir/remote-desktop/remote-login.sh"
bash -n "$install_dir/remote-desktop/launcher/install-macos-app.sh"
grep -Fq 'rdp enable-port-negotiation' "$install_dir/remote-desktop/remote-login.sh"
grep -Fq 'port 3389:3398 proto tcp' "$install_dir/remote-desktop/remote-login.sh"
grep -Fq "journalctl -b --since '10 minutes ago'" "$install_dir/remote-desktop/remote-login.sh"
npm --prefix "$install_dir/remote-desktop/launcher" test
grep -Fq 'Fullscreen — use client display' "$install_dir/remote-desktop/launcher/renderer/index.html"
grep -Fq 'Window — use selected size' "$install_dir/remote-desktop/launcher/renderer/index.html"
grep -Fq 'Window size is not applied' "$install_dir/remote-desktop/launcher/renderer/index.html"

set +e
guard_output="$("$install_dir/install.sh" remote-desktop status 2>&1)"
guard_status=$?
set -e
[[ $guard_status -eq 64 ]]
grep -Fq 'PROFILE_REQUIRED' <<<"$guard_output"

if [[ "$(uname -s)" != Linux ]]; then
  set +e
  platform_output="$("$install_dir/remote-desktop/lifecycle.sh" status 2>&1)"
  platform_status=$?
  set -e
  [[ $platform_status -eq 3 ]]
  grep -Fq 'REMOTE_DESKTOP_PLATFORM_UNSUPPORTED' <<<"$platform_output"
fi

printf '%s\n' 'remote desktop command lifecycle: PASS'
