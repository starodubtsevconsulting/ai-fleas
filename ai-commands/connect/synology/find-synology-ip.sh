#!/usr/bin/env sh
set -eu

verbose=false
[ "${1:-}" = "-v" ] && verbose=true
[ "$#" -le 1 ] || { printf '%s\n' 'Usage: find-synology-ip.sh [-v]' >&2; exit 2; }

log() { [ "$verbose" = true ] && printf '%s\n' "$*" >&2 || true; }

probe_candidate() {
  candidate="$1"
  [ -n "$candidate" ] || return 1
  for port in 5001 5000 445 6690; do
    if nc -z -w 2 "$candidate" "$port" >/dev/null 2>&1; then
      log "[*] Synology candidate ready: $candidate (port $port)"
      printf '%s\n' "$candidate"
      return 0
    fi
  done
  log "[*] Synology candidate unavailable: $candidate"
  return 1
}

discover_from_arp() {
  # Synology owns OUI 00:11:32. macOS shortens a leading 00 octet to 0.
  arp -a 2>/dev/null | awk '
    BEGIN { IGNORECASE=1 }
    /\(.*\)/ && ($0 ~ / at (00:11:32|0:11:32):/ || tolower($0) ~ /synology/) {
      value=$0
      sub(/^.*\(/, "", value)
      sub(/\).*$/, "", value)
      if (value ~ /^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$/) print value
    }
  '
}

discover_from_nmap() {
  command -v nmap >/dev/null 2>&1 || return 0
  gateway=''
  if command -v ip >/dev/null 2>&1; then
    gateway="$(ip route 2>/dev/null | awk '/default/ { print $3; exit }')"
  elif command -v route >/dev/null 2>&1; then
    gateway="$(route -n get default 2>/dev/null | awk '/gateway:/ { print $2; exit }')"
  fi
  [ -n "$gateway" ] || return 0
  network="$(printf '%s\n' "$gateway" | awk -F. 'NF == 4 { print $1 "." $2 "." $3 ".0/24" }')"
  [ -n "$network" ] || return 0
  log "[*] Scanning $network with installed nmap"
  nmap -sn "$network" 2>/dev/null | awk '
    /Nmap scan report for/ { value=$NF; gsub(/[()]/, "", value) }
    /Synology Incorporated|00:11:32/ { if (value != "") print value }
  '
}

candidates="$( { discover_from_arp; discover_from_nmap; } | awk '!seen[$0]++')"
[ -n "$candidates" ] || {
  printf '%s\n' 'SYNOLOGY_NOT_FOUND: no Synology identity was discovered on the local network.' >&2
  exit 1
}

found=''
for candidate in $candidates; do
  if ready="$(probe_candidate "$candidate")"; then
    found="${found}${found:+
}${ready}"
  fi
done

[ -n "$found" ] || {
  printf '%s\n' 'SYNOLOGY_UNREACHABLE: Synology identity found, but DSM, SMB, and Drive ports are unavailable.' >&2
  exit 1
}

printf '%s\n' "$found"
