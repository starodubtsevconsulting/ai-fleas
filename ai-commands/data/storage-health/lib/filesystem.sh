#!/usr/bin/env bash
filesystem_report(){
  local dev="$1"
  echo "AI Fleas · Storage Contents"
  echo "───────────────────────────"
  local model size tran\n  model="$(lsblk -dn -o MODEL "$dev" | xargs)"\n  size="$(lsblk -dn -o SIZE "$dev" | xargs)"\n  tran="$(lsblk -dn -o TRAN "$dev" | xargs)"\n  echo "Drive:      $model $size"\n  echo "Connection: ${tran:-unknown}"\n  echo "Device:     $dev"\n  echo\n  lsblk -f "$dev"
  echo
  echo "Known signatures (read-only):"
  sudo wipefs -n "$dev" 2>/dev/null || true
  echo
  echo "blkid evidence:"
  local b w\n  b="$(sudo blkid "$dev" 2>/dev/null || true)"\n  w="$(sudo wipefs -n "$dev" 2>/dev/null || true)"\n  [[ -n "$b" ]] && echo "$b" || echo "No filesystem signature reported by blkid."\n  echo\n  if [[ -z "$b" && -z "$w" ]]; then\n    echo "Assessment: READY FOR HEALTH QUALIFICATION"\n    echo\n    echo "What this means:"\n    echo "No recognized filesystem or storage signature was found. The drive appears"\n    echo "blank or previously erased; there is no recognized structure to preserve."\n    echo\n    echo "Recommended next step:"\n    echo "Run a long SMART self-test before initializing it for AI storage."\n  else\n    echo "Assessment: REVIEW BEFORE INITIALIZATION"\n    echo "Storage metadata was detected. Review it before erasing or formatting."\n  fi
}
