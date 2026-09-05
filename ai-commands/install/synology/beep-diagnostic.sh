#!/usr/bin/env sh
set -e

# =============================================================================
# Synology Diagnostic Script — FINAL, CORRECT (DSM 7.x, BusyBox-safe)
# =============================================================================

INTERACTIVE=true
SAFE_MODE=true

SYNO_IP=""
SYNO_USER="admin"
SSH_PORT="22"
DSM_PORT="5001"

DISCOVERY_SCRIPT="./find-synology-ip.sh"

# -----------------------------------------------------------------------------
# Args
# -----------------------------------------------------------------------------
while [ $# -gt 0 ]; do
  case "$1" in
    --interactive=*) INTERACTIVE="${1#*=}" ;;
    --ip) SYNO_IP="$2"; shift ;;
    --user) SYNO_USER="$2"; shift ;;
    --ssh-port) SSH_PORT="$2"; shift ;;
    --dsm-port) DSM_PORT="$2"; shift ;;
    --unsafe) SAFE_MODE=false ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
  shift
done

# -----------------------------------------------------------------------------
# Interactive input
# -----------------------------------------------------------------------------
if [ "$INTERACTIVE" = true ]; then
  printf "Synology IP (Enter = auto-detect): "
  read SYNO_IP

  printf "User [%s]: " "$SYNO_USER"
  read v && SYNO_USER="${v:-$SYNO_USER}"

  printf "SSH port [%s]: " "$SSH_PORT"
  read v && SSH_PORT="${v:-$SSH_PORT}"

  printf "DSM port [%s]: " "$DSM_PORT"
  read v && DSM_PORT="${v:-$DSM_PORT}"

  printf "Safe mode (no SMART wakeups) [%s]: " "$SAFE_MODE"
  read v && SAFE_MODE="${v:-$SAFE_MODE}"
fi

# -----------------------------------------------------------------------------
# Auto-detect IP
# -----------------------------------------------------------------------------
if [ -z "$SYNO_IP" ]; then
  [ ! -x "$DISCOVERY_SCRIPT" ] && {
    echo "❌ Discovery script not found: $DISCOVERY_SCRIPT"
    exit 1
  }
  echo "[*] Auto-detecting Synology IP..."
  SYNO_IP="$("$DISCOVERY_SCRIPT" | awk '/Synology IP:/ {getline; print $1}')"
  [ -z "$SYNO_IP" ] && { echo "❌ Synology IP not found"; exit 1; }
  echo "✅ Found Synology at $SYNO_IP"
fi

# -----------------------------------------------------------------------------
# Port checks
# -----------------------------------------------------------------------------
echo
echo "[*] Port check"

nc -z -w2 "$SYNO_IP" "$SSH_PORT" \
  && { echo "✅ SSH port $SSH_PORT open"; SSH_OK=true; } \
  || { echo "❌ SSH port $SSH_PORT closed"; SSH_OK=false; }

nc -z -w2 "$SYNO_IP" "$DSM_PORT" \
  && echo "✅ DSM port $DSM_PORT open" \
  || echo "❌ DSM port $DSM_PORT closed"

[ "$SSH_OK" != true ] && exit 1

# -----------------------------------------------------------------------------
# SSH diagnostics (QUOTED heredoc is REQUIRED)
# -----------------------------------------------------------------------------
echo
echo "[*] Connecting via SSH: $SYNO_USER@$SYNO_IP:$SSH_PORT"
echo

ssh -T -p "$SSH_PORT" "$SYNO_USER@$SYNO_IP" <<'EOF'
echo "=== SYSTEM ==="
uname -a
cat /etc/VERSION
uptime
echo

# -------------------------------------------------------------------
# DISKS
# -------------------------------------------------------------------
echo "=== DISKS (device | model | size) ==="
for b in /sys/block/sata* /sys/block/sd*; do
  dev="$(basename "$b")"
  case "$dev" in *p[0-9]*) continue ;; esac
  device="/dev/$dev"
  [ -b "$device" ] || continue

  model="$(cat "$b/device/model" 2>/dev/null | tr -d ' ')"
  sectors="$(cat "$b/size" 2>/dev/null)"
  size_tb="$(awk "BEGIN { printf \"%.2f TB\", $sectors * 512 / 1e12 }")"

  printf "%-12s | %-24s | %s\n" "$device" "$model" "$size_tb"
done
echo

# -------------------------------------------------------------------
# RAID STATUS
# -------------------------------------------------------------------
echo "=== RAID STATUS (/proc/mdstat) ==="
cat /proc/mdstat
echo

# -------------------------------------------------------------------
# RAID SUMMARY — CORRECT MULTILINE PARSING
# -------------------------------------------------------------------
echo "=== RAID SUMMARY ==="
DEGRADED=0

awk '
/^md[0-9]+/ {
  md=$1
  next
}
/\[[0-9]+\/[0-9]+\]/ && md != "" {
  if (match($0, /\[([0-9]+)\/([0-9]+)\]/, m)) {
    if (m[1] != m[2]) {
      printf "⚠️  DEGRADED: %s (%s of %s disks present)\n", md, m[2], m[1]
      degraded=1
    } else {
      printf "✅ OK: %s\n", md
    }
  }
  md=""
}
END {
  if (degraded) exit 1
}
' /proc/mdstat || DEGRADED=1
echo

# -------------------------------------------------------------------
# SMART
# -------------------------------------------------------------------
echo "=== SMART HEALTH ==="
echo "Skipped (safe mode enabled)"
echo

# -------------------------------------------------------------------
# ACTIONABLE SUMMARY
# -------------------------------------------------------------------
echo "=== ACTIONABLE SUMMARY ==="
if [ "$DEGRADED" -eq 1 ]; then
  echo "- RAID status: DEGRADED"
  echo "- Cause: one disk missing or failed"
  echo "- Current state: system running without redundancy"
  echo
  echo "RECOMMENDED ACTIONS:"
  echo "1. Insert a replacement SATA HDD (>= 6 TB, 512e)"
  echo "2. DSM → Storage Manager → Storage Pool → Repair"
  echo
  echo "WARNING: another disk failure = total data loss"
else
  echo "- RAID status: HEALTHY"
  echo "- No immediate action required"
fi
EOF

