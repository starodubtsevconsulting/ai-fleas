#!/usr/bin/env bash
set -euo pipefail

action="${1:-status}"
shift || true
allowed_cidr=""
disable_auto_login=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    --allowed-cidr) allowed_cidr="${2:-}"; shift 2 ;;
    --disable-auto-login) disable_auto_login=true; shift ;;
    *) printf 'Unknown remote-login option: %s\n' "$1" >&2; exit 2 ;;
  esac
done

cert_dir="/etc/gnome-remote-desktop"
cert_file="$cert_dir/rdp-tls.crt"
key_file="$cert_dir/rdp-tls.key"

require_ubuntu() {
  [[ "$(uname -s)" == Linux && -r /etc/os-release ]] && grep -q '^ID=ubuntu$' /etc/os-release || {
    printf '%s\n' 'REMOTE_DESKTOP_PLATFORM_UNSUPPORTED: reviewed adapter supports Ubuntu GNOME only.' >&2
    exit 3
  }
}

case "$action" in
  status)
    require_ubuntu
    sudo -n grdctl --system status
    ;;
  smoke-test)
    require_ubuntu
    systemctl is-enabled --quiet gnome-remote-desktop.service
    systemctl is-active --quiet gnome-remote-desktop.service
    sudo -n grdctl --system status | grep -q 'Status: enabled'
    sudo -n test -s "$cert_file"
    sudo -n test -s "$key_file"
    sudo -n ufw status | grep -Fq '3389/tcp'
    printf '%s\n' 'REMOTE_DESKTOP_SMOKE_PASS: boot-level GNOME remote login, TLS, and LAN firewall rule verified.'
    ;;
  install)
    require_ubuntu
    [[ "$allowed_cidr" =~ ^[0-9]{1,3}(\.[0-9]{1,3}){3}/[0-9]{1,2}$ ]] || {
      printf '%s\n' 'REMOTE_DESKTOP_ALLOWED_CIDR_REQUIRED: pass --allowed-cidr with the trusted private network.' >&2; exit 2;
    }
    [[ "$disable_auto_login" == true ]] || {
      printf '%s\n' 'REMOTE_DESKTOP_AUTO_LOGIN_DECISION_REQUIRED: pass --disable-auto-login to prevent duplicate GNOME sessions.' >&2; exit 2;
    }
    sudo -n apt-get update
    sudo -n env DEBIAN_FRONTEND=noninteractive apt-get install -y gnome-remote-desktop openssl
    systemctl --user disable --now gnome-remote-desktop.service 2>/dev/null || true
    grdctl rdp disable 2>/dev/null || true
    sudo -n install -o gnome-remote-desktop -g gnome-remote-desktop -m 0700 -d "$cert_dir"
    if ! sudo -n test -s "$cert_file" || ! sudo -n test -s "$key_file"; then
      temp_dir="$(mktemp -d)"
      trap 'rm -rf -- "$temp_dir"' EXIT
      openssl req -new -newkey rsa:3072 -days 825 -nodes -x509 -subj "/CN=$(hostname)" \
        -keyout "$temp_dir/rdp-tls.key" -out "$temp_dir/rdp-tls.crt" >/dev/null 2>&1
      sudo -n install -o gnome-remote-desktop -g gnome-remote-desktop -m 0600 "$temp_dir/rdp-tls.key" "$key_file"
      sudo -n install -o gnome-remote-desktop -g gnome-remote-desktop -m 0644 "$temp_dir/rdp-tls.crt" "$cert_file"
    fi
    sudo -n chown gnome-remote-desktop:gnome-remote-desktop "$cert_dir" "$cert_file" "$key_file"
    sudo -n chmod 0700 "$cert_dir"
    sudo -n chmod 0600 "$key_file"
    sudo -n chmod 0644 "$cert_file"
    sudo -n grdctl --system rdp set-tls-cert "$cert_file"
    sudo -n grdctl --system rdp set-tls-key "$key_file"
    sudo -n grdctl --system rdp set-auth-methods credentials
    sudo -n grdctl --system rdp disable-port-negotiation
    sudo -n grdctl --system rdp enable
    sudo -n ufw allow 22/tcp
    sudo -n ufw allow from "$allowed_cidr" to any port 3389 proto tcp
    sudo -n ufw --force enable
    sudo -n cp -n /etc/gdm3/custom.conf /etc/gdm3/custom.conf.before-rdp-remote-login
    sudo -n sed -i -E 's/^AutomaticLoginEnable=.*/AutomaticLoginEnable=false/; s/^AutomaticLogin=.*/# AutomaticLogin disabled for system RDP/' /etc/gdm3/custom.conf
    sudo -n systemctl enable --now gnome-remote-desktop.service
    printf '%s\n' 'REMOTE_DESKTOP_REMOTE_LOGIN_READY: system RDP is enabled; reboot if automatic login was previously active.'
    ;;
  *) printf 'REMOTE_DESKTOP_%s_UNAVAILABLE\n' "${action^^}" >&2; exit 3 ;;
esac
