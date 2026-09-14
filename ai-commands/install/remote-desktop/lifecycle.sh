#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
action="${1:-status}"
shift || true
allowed_cidr="${REMOTE_DESKTOP_ALLOWED_CIDR:-}"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --allowed-cidr) [[ $# -ge 2 ]] || { printf '%s\n' 'REMOTE_DESKTOP_ALLOWED_CIDR_REQUIRED' >&2; exit 2; }; allowed_cidr="$2"; shift 2 ;;
    *) printf 'Unknown remote-desktop option: %s\n' "$1" >&2; exit 2 ;;
  esac
done
cert_dir="${REMOTE_DESKTOP_CERT_DIR:-/etc/gnome-remote-desktop}"
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
  sudo -n grdctl --system status
}

smoke_test() {
  command -v grdctl >/dev/null 2>&1 || { printf '%s\n' 'REMOTE_DESKTOP_SMOKE_FAILED: grdctl is unavailable.' >&2; return 1; }
  systemctl is-enabled --quiet gnome-remote-desktop.service || { printf '%s\n' 'REMOTE_DESKTOP_SMOKE_FAILED: system service is not enabled for boot.' >&2; return 1; }
  systemctl is-active --quiet gnome-remote-desktop.service || { printf '%s\n' 'REMOTE_DESKTOP_SMOKE_FAILED: system service is inactive.' >&2; return 1; }
  sudo -n grdctl --system status | grep -q 'Status: enabled' || { printf '%s\n' 'REMOTE_DESKTOP_SMOKE_FAILED: system RDP is disabled.' >&2; return 1; }
  sudo -n test -s "$cert_file" && sudo -n test -s "$key_file" || { printf '%s\n' 'REMOTE_DESKTOP_SMOKE_FAILED: TLS material is missing.' >&2; return 1; }
  sudo -n ufw status | grep -Fq '3389/tcp' || { printf '%s\n' 'REMOTE_DESKTOP_SMOKE_FAILED: LAN firewall rule is missing.' >&2; return 1; }
  printf '%s\n' 'REMOTE_DESKTOP_SMOKE_PASS: boot-persistent GNOME RDP, TLS, and LAN firewall rule verified.'
}

case "$action" in
  status) require_ubuntu; status ;;
  smoke-test) require_ubuntu; smoke_test ;;
  install)
    require_ubuntu
    [[ "$allowed_cidr" =~ ^[0-9]{1,3}(\.[0-9]{1,3}){3}/[0-9]{1,2}$ ]] || {
      printf '%s\n' 'REMOTE_DESKTOP_ALLOWED_CIDR_REQUIRED: pass --allowed-cidr with the trusted private network.' >&2
      exit 2
    }
    sudo -n apt-get update
    sudo -n env DEBIAN_FRONTEND=noninteractive apt-get install -y gnome-remote-desktop openssl
    sudo -n install -o root -g gnome-remote-desktop -m 0750 -d "$cert_dir"
    if ! sudo -n test -s "$cert_file" || ! sudo -n test -s "$key_file"; then
      temp_dir="$(mktemp -d)"
      trap 'rm -rf -- "$temp_dir"' EXIT
      openssl req -new -newkey rsa:3072 -days 825 -nodes -x509 \
        -subj "/CN=$(hostname)" -keyout "$temp_dir/rdp-tls.key" -out "$temp_dir/rdp-tls.crt" >/dev/null 2>&1
      sudo -n install -o root -g gnome-remote-desktop -m 0640 "$temp_dir/rdp-tls.key" "$key_file"
      sudo -n install -o root -g gnome-remote-desktop -m 0644 "$temp_dir/rdp-tls.crt" "$cert_file"
    fi
    sudo -n grdctl --system rdp set-tls-cert "$cert_file"
    sudo -n grdctl --system rdp set-tls-key "$key_file"
    sudo -n grdctl --system rdp set-auth-methods credentials
    sudo -n grdctl --system rdp disable-view-only
    sudo -n grdctl --system rdp disable-port-negotiation
    sudo -n grdctl --system rdp enable
    sudo -n ufw allow 22/tcp
    sudo -n ufw allow from "$allowed_cidr" to any port 3389 proto tcp
    sudo -n ufw --force enable
    sudo -n systemctl enable --now gnome-remote-desktop.service
    printf '%s\n' 'REMOTE_DESKTOP_CREDENTIALS_REQUIRED: run sudo grdctl --system rdp set-credentials, then run smoke-test.'
    ;;
  check-update|update|upgrade|uninstall)
    printf 'REMOTE_DESKTOP_%s_UNAVAILABLE: no reviewed lifecycle adapter is available.\n' "${action^^}" >&2
    exit 3
    ;;
  -h|--help|help)
    printf '%s\n' 'Usage: install.sh remote-desktop install --allowed-cidr <private-cidr>'
    ;;
  *) printf 'Unknown remote-desktop lifecycle action: %s\n' "$action" >&2; exit 2 ;;
esac
