#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
action="${1:-status}"
shift || true
cert_dir="${REMOTE_DESKTOP_CERT_DIR:-$HOME/.local/share/gnome-remote-desktop}"
cert_file="$cert_dir/rdp-tls.crt"
key_file="$cert_dir/rdp-tls.key"

require_ubuntu() {
  [[ "$(uname -s)" == Linux && -r /etc/os-release ]] && grep -q '^ID=ubuntu$' /etc/os-release || {
    printf '%s\n' 'REMOTE_DESKTOP_PLATFORM_UNSUPPORTED: reviewed adapter supports Ubuntu GNOME only.' >&2
    exit 3
  }
}

status() {
  command -v grdctl >/dev/null 2>&1 || { printf '%s\n' 'REMOTE_DESKTOP_NOT_INSTALLED'; return 1; }
  grdctl status
}

smoke_test() {
  command -v grdctl >/dev/null 2>&1 || { printf '%s\n' 'REMOTE_DESKTOP_SMOKE_FAILED: grdctl is unavailable.' >&2; return 1; }
  systemctl --user is-active --quiet gnome-remote-desktop.service || { printf '%s\n' 'REMOTE_DESKTOP_SMOKE_FAILED: user service is inactive.' >&2; return 1; }
  grdctl status | grep -q 'Status: enabled' || { printf '%s\n' 'REMOTE_DESKTOP_SMOKE_FAILED: RDP is disabled.' >&2; return 1; }
  [[ -s "$cert_file" && -s "$key_file" ]] || { printf '%s\n' 'REMOTE_DESKTOP_SMOKE_FAILED: TLS material is missing.' >&2; return 1; }
  printf '%s\n' 'REMOTE_DESKTOP_SMOKE_PASS: GNOME RDP and TLS are enabled for the current desktop session.'
}

case "$action" in
  status) require_ubuntu; status ;;
  smoke-test) require_ubuntu; smoke_test ;;
  install)
    require_ubuntu
    sudo -n apt-get update
    sudo -n env DEBIAN_FRONTEND=noninteractive apt-get install -y gnome-remote-desktop openssl
    install -m 0700 -d "$cert_dir"
    if [[ ! -s "$cert_file" || ! -s "$key_file" ]]; then
      openssl req -new -newkey rsa:3072 -days 825 -nodes -x509 \
        -subj "/CN=$(hostname)" -keyout "$key_file" -out "$cert_file" >/dev/null 2>&1
      chmod 0600 "$key_file"
      chmod 0644 "$cert_file"
    fi
    grdctl rdp set-tls-cert "$cert_file"
    grdctl rdp set-tls-key "$key_file"
    grdctl rdp set-auth-methods credentials
    grdctl rdp disable-view-only
    grdctl rdp disable-port-negotiation
    grdctl rdp enable
    systemctl --user enable --now gnome-remote-desktop.service
    printf '%s\n' 'REMOTE_DESKTOP_CREDENTIALS_REQUIRED: run grdctl rdp set-credentials in the Ubuntu user session, then run smoke-test.'
    ;;
  check-update|update|upgrade|uninstall)
    printf 'REMOTE_DESKTOP_%s_UNAVAILABLE: no reviewed lifecycle adapter is available.\n' "${action^^}" >&2
    exit 3
    ;;
  -h|--help|help)
    printf '%s\n' 'Usage: install.sh remote-desktop {status|smoke-test|install}'
    ;;
  *) printf 'Unknown remote-desktop lifecycle action: %s\n' "$action" >&2; exit 2 ;;
esac
