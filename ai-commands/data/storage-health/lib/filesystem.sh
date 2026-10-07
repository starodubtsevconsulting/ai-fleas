#!/usr/bin/env bash
filesystem_report(){
  local dev="$1"
  echo "AI Fleas · Filesystem / Signature Evidence"
  echo "─────────────────────────────────────────"
  lsblk -f "$dev"
  echo
  echo "Known signatures (read-only):"
  sudo wipefs -n "$dev" 2>/dev/null || true
  echo
  echo "blkid evidence:"
  sudo blkid "$dev" 2>/dev/null || echo "No filesystem signature reported by blkid."
}
