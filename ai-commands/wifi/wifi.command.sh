#!/usr/bin/env bash
#
# wifi.command.sh manages Wi-Fi on this machine through NetworkManager (`nmcli`).
# It does not install packages; it expects the required Wi-Fi tools to already
# be present, and it tries to put the Wi-Fi interface into a usable managed state.
# The script can:
#   - connect to the configured Wi-Fi network
#   - disconnect the Wi-Fi interface
#   - show current Wi-Fi status
#   - list nearby Wi-Fi networks
#
# Configuration is read from a `wifi.command.config` file next to this script.
# Expected keys:
#   ssid=your_wifi_name
#   password=your_wifi_password
#
# If a single SSID is set there, running `wifi.command.sh` with no arguments will try to
# connect to that SSID automatically.

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
IFACE="wlp4s0"
CONFIG_FILE="${SCRIPT_DIR}/wifi.command.config"
ACTION="${1:-connect}"

if ! command -v nmcli >/dev/null 2>&1; then
  echo "nmcli is not installed."
  exit 1
fi

disconnect_wifi() {
  local active_ssid
  active_ssid="$(nmcli -t -f GENERAL.CONNECTION device show "${IFACE}" 2>/dev/null | sed 's/^GENERAL.CONNECTION://')"

  if [[ -n "${active_ssid}" && "${active_ssid}" != "--" ]]; then
    echo "Disconnecting Wi-Fi SSID '${active_ssid}' on ${IFACE}..."
  else
    echo "Disconnecting Wi-Fi interface ${IFACE}..."
  fi

  nmcli connection down "${CON_NAME}" >/dev/null 2>&1 || true
  nmcli device disconnect "${IFACE}" >/dev/null 2>&1 || true
  echo
  nmcli -f DEVICE,TYPE,STATE,CONNECTION device status
}

show_status() {
  nmcli -f GENERAL.STATE,GENERAL.CONNECTION,IP4.ADDRESS,IP4.GATEWAY device show "${IFACE}"
  echo
  nmcli -f IN-USE,SSID,CHAN,RATE,SIGNAL,SECURITY dev wifi list ifname "${IFACE}"
}

list_wifi() {
  nmcli radio wifi on
  nmcli device set "${IFACE}" managed yes >/dev/null 2>&1 || true
  nmcli device wifi rescan ifname "${IFACE}" >/dev/null 2>&1 || true
  sleep 2
  nmcli -f IN-USE,SSID,CHAN,RATE,SIGNAL,SECURITY dev wifi list ifname "${IFACE}"
}

show_help() {
  cat <<'EOF'
Usage: wifi.command.sh [connect|disconnect|status|list|--help]

Actions:
  connect      Connect to the configured Wi-Fi network (default)
  disconnect   Disconnect Wi-Fi on wlp4s0
  status       Show current Wi-Fi connection and scan stats
  list         Show nearby Wi-Fi networks
  --help, -h   Show this help text
EOF
}

if [[ ! -f "${CONFIG_FILE}" ]]; then
  echo "Missing config file: ${CONFIG_FILE}"
  exit 1
fi

# shellcheck source=/dev/null
source "${CONFIG_FILE}"

SSID="${ssid:-}"
PASSWORD="${password:-}"
CON_NAME="${SSID}"
CURRENT_CONNECTION="$(nmcli -t -f GENERAL.CONNECTION device show "${IFACE}" 2>/dev/null | sed 's/^GENERAL.CONNECTION://')"

if [[ -z "${SSID}" ]]; then
  echo "Set ssid=... in ${CONFIG_FILE} first."
  exit 1
fi

if [[ -z "${PASSWORD}" ]]; then
  echo "Set password=... in ${CONFIG_FILE} first."
  exit 1
fi

if [[ "${CURRENT_CONNECTION}" == "${SSID}" ]]; then
  CONNECTED_IP="$(nmcli -t -f IP4.ADDRESS device show "${IFACE}" | sed -n 's/^IP4.ADDRESS\[[0-9]\+\]://p' | head -n 1)"
  CONNECTED_GATEWAY="$(nmcli -t -f IP4.GATEWAY device show "${IFACE}" | sed 's/^IP4.GATEWAY://')"
  echo "Connected to '${CURRENT_CONNECTION}' on ${IFACE}${CONNECTED_IP:+ with ${CONNECTED_IP}}${CONNECTED_GATEWAY:+ via ${CONNECTED_GATEWAY}}."
  exit 0
fi

case "${ACTION}" in
  connect)
    ;;
  disconnect)
    disconnect_wifi
    exit 0
    ;;
  status|--status)
    show_status
    exit 0
    ;;
  list|--list)
    list_wifi
    exit 0
    ;;
  --help|-h)
    show_help
    exit 0
    ;;
  *)
    echo "Usage: $0 [connect|disconnect|status|list|--help]"
    exit 1
    ;;
esac

nmcli radio wifi on
nmcli device set "${IFACE}" managed yes >/dev/null 2>&1 || true
nmcli device connect "${IFACE}" >/dev/null 2>&1 || true
nmcli device wifi rescan ifname "${IFACE}" >/dev/null 2>&1 || true
sleep 2

if ! nmcli -t -f SSID dev wifi list ifname "${IFACE}" | grep -Fxq "${SSID}"; then
  echo "SSID '${SSID}' was not found in the current scan."
  exit 1
fi

if nmcli -t -f NAME connection show | grep -Fxq "${CON_NAME}"; then
  nmcli connection delete "${CON_NAME}" >/dev/null 2>&1 || true
fi

nmcli dev wifi connect "${SSID}" password "${PASSWORD}" ifname "${IFACE}" name "${CON_NAME}" >/dev/null

CONNECTED_NAME="$(nmcli -t -f GENERAL.CONNECTION device show "${IFACE}" | sed 's/^GENERAL.CONNECTION://')"
CONNECTED_IP="$(nmcli -t -f IP4.ADDRESS device show "${IFACE}" | sed -n 's/^IP4.ADDRESS\[[0-9]\+\]://p' | head -n 1)"
CONNECTED_GATEWAY="$(nmcli -t -f IP4.GATEWAY device show "${IFACE}" | sed 's/^IP4.GATEWAY://')"

echo "Connected to '${CONNECTED_NAME}' on ${IFACE}${CONNECTED_IP:+ with ${CONNECTED_IP}}${CONNECTED_GATEWAY:+ via ${CONNECTED_GATEWAY}}."
