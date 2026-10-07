#!/usr/bin/env bash
filesystem_report(){
  local dev="$1"
  local model size tran b w
  model="$(lsblk -dn -o MODEL "$dev" | xargs)"
  size="$(lsblk -dn -o SIZE "$dev" | xargs)"
  tran="$(lsblk -dn -o TRAN "$dev" | xargs)"
  b="$(sudo blkid "$dev" 2>/dev/null || true)"
  w="$(sudo wipefs -n "$dev" 2>/dev/null || true)"

  echo "AI Fleas · Storage Contents"
  echo "───────────────────────────"
  echo "Drive:      $model $size"
  echo "Connection: ${tran:-unknown}"
  echo "Device:     $dev"
  echo
  if [[ -z "$b" && -z "$w" ]]; then
    echo "Filesystem:    None detected"
    echo "Mounted:       No recognized filesystem"
    echo "Existing data: No recognizable storage signature detected"
    echo
    local test_out latest_test
    test_out="$(smart_capture "$dev" -l selftest 2>/dev/null || true)"
    latest_test="$(awk '/^# *[0-9]+/ {print; exit}' <<<"$test_out")"
    if grep -qi 'Completed without error' <<<"$latest_test"; then
      echo "Assessment: READY FOR INITIALIZATION"
      echo
      echo "What this means:"
      echo "The drive appears blank or previously erased, and its latest full disk"
      echo "health test completed without reporting an error."
      echo
      echo "Recommended next step:"
      echo "Initialize the drive for its intended storage role when ready."
    else
      echo "Assessment: READY FOR HEALTH QUALIFICATION"
      echo
      echo "What this means:"
      echo "The drive appears blank or previously erased. Linux found no recognized"
      echo "filesystem or storage signature that needs to be preserved."
      echo
      echo "Recommended next step:"
      echo "Run a full disk health test before initializing it for AI storage."
    fi
  else
    echo "Existing data: Storage metadata detected"
    echo
    echo "Assessment: REVIEW BEFORE INITIALIZATION"
    echo "Review the technical evidence before erasing or formatting this drive."
  fi
  echo
  echo "Technical evidence"
  echo "──────────────────"
  lsblk -f "$dev"
  echo
  echo "wipefs -n:"
  [[ -n "$w" ]] && echo "$w" || echo "No known signatures reported."
  echo
  echo "blkid:"
  [[ -n "$b" ]] && echo "$b" || echo "No filesystem signature reported."
}
