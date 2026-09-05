#!/usr/bin/env sh
set -e

# Synology discovery script with final summary
# Usage:
#   ./find-synology-ip.sh        -> quiet
#   ./find-synology-ip.sh -v     -> verbose

VERBOSE=1
[ "$1" = "-v" ] && VERBOSE=1

log() {
  [ "$VERBOSE" -eq 1 ] && echo "$@"
}

# Ask for sudo once
if [ "$(id -u)" -ne 0 ]; then
  log "[*] Requesting sudo..."
  sudo -v
fi

# Ensure nmap
if ! command -v nmap >/dev/null 2>&1; then
  log "[*] Installing nmap..."
  sudo apt update
  sudo apt install -y nmap
fi

# Detect network
GW="$(ip route | awk '/default/ {print $3}')"
NET="$(echo "$GW" | awk -F. '{print $1"."$2"."$3".0/24"}')"

log "[*] Gateway: $GW"
log "[*] Network: $NET"
log "[*] Scanning..."

FOUND_IPS=""

# Run scan once, capture output
SCAN_OUTPUT="$(sudo nmap -sn "$NET")"

# Print full scan if verbose
[ "$VERBOSE" -eq 1 ] && echo "$SCAN_OUTPUT"

# Extract Synology entries
FOUND_IPS="$(printf "%s\n" "$SCAN_OUTPUT" | awk '
  /Nmap scan report for/ { ip=$NF }
  /Synology Incorporated/ { print ip }
')"

# Final result (always printed)
if [ -n "$FOUND_IPS" ]; then
  echo "Synology IP:"
  echo "$FOUND_IPS"
else
  echo "Synology IP: not found"
  exit 1
fi
