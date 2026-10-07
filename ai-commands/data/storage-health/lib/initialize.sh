#!/usr/bin/env bash
storage_init_ready(){
  local dev="$1" b w test_out latest
  is_disk "$dev" || return 1
  b="$(sudo blkid "$dev" 2>/dev/null || true)"
  w="$(sudo wipefs -n "$dev" 2>/dev/null || true)"
  [[ -z "$b" && -z "$w" ]] || return 1
  test_out="$(smart_capture "$dev" -l selftest 2>/dev/null || true)"
  latest="$(awk '/^# *[0-9]+/ {print; exit}' <<<"$test_out")"
  grep -qi 'Completed without error' <<<"$latest"
}
storage_initialize(){
  local dev="$1" model size serial part uuid mount_root label
  is_disk "$dev" || { echo "ERROR: not a block disk: $dev" >&2; return 2; }
  model="$(lsblk -dn -o MODEL "$dev" | xargs)"; size="$(lsblk -dn -o SIZE "$dev" | xargs)"; serial="$(lsblk -dn -o SERIAL "$dev" | xargs)"
  storage_init_ready "$dev" || { echo "ERROR: drive is not READY FOR INITIALIZATION. Complete inspection and a successful full disk health test first." >&2; return 2; }
  mount_root="${AI_STORAGE_MOUNT:-/srv/ai-storage}"; label="${AI_STORAGE_LABEL:-ai-storage}"
  echo "AI Fleas · Initialize Storage"
  echo "─────────────────────────────"
  echo "Drive:    $model $size"
  echo "Device:   $dev"
  echo "Serial:   $serial"
  echo "Health:   full disk test PASSED"
  echo "Contents: no recognized filesystem/signature"
  echo
  echo "Planned changes:"
  echo "  • Create GPT partition table"
  echo "  • Create one full-size partition"
  echo "  • Format ext4"
  echo "  • Label filesystem: $label"
  echo "  • Configure persistent mount by UUID"
  echo "  • Mount at $mount_root"
  echo "  • Create hermes, memory, artifacts, models, archive directories"
  echo "  • Verify write/read"
  echo
  echo "WARNING: this operation modifies the selected disk."
  [[ -t 0 ]] || { echo "ERROR: initialization requires interactive confirmation." >&2; return 2; }
  printf "Type INITIALIZE to continue: "; local answer; read -r answer
  [[ "$answer" == "INITIALIZE" ]] || { echo "Initialization cancelled. No changes made."; return 0; }

  command -v parted >/dev/null 2>&1 || { echo "ERROR: missing dependency: parted" >&2; return 2; }
  command -v mkfs.ext4 >/dev/null 2>&1 || { echo "ERROR: missing dependency: mkfs.ext4" >&2; return 2; }

  sudo parted -s "$dev" mklabel gpt
  sudo parted -s "$dev" mkpart primary ext4 1MiB 100%
  sudo partprobe "$dev" 2>/dev/null || true
  sleep 2
  part="${dev}1"
  [[ -b "$part" ]] || { echo "ERROR: expected partition $part was not created." >&2; return 2; }
  sudo mkfs.ext4 -F -L "$label" "$part"
  uuid="$(sudo blkid -s UUID -o value "$part")"
  [[ -n "$uuid" ]] || { echo "ERROR: could not read filesystem UUID." >&2; return 2; }
  sudo mkdir -p "$mount_root"
  if ! grep -q "UUID=$uuid" /etc/fstab; then
    printf 'UUID=%s %s ext4 defaults,nofail 0 2\n' "$uuid" "$mount_root" | sudo tee -a /etc/fstab >/dev/null
  fi
  sudo mount "$mount_root" 2>/dev/null || sudo mount -a
  sudo mkdir -p "$mount_root"/{hermes,memory,artifacts,models,archive}
  local probe="$mount_root/.ai-fleas-write-test"
  echo "ai-fleas-storage-ok" | sudo tee "$probe" >/dev/null
  [[ "$(sudo cat "$probe")" == "ai-fleas-storage-ok" ]] || { echo "ERROR: write/read verification failed." >&2; return 2; }
  sudo rm -f "$probe"
  echo
  echo "READY FOR USE"
  echo "Mount: $mount_root"
  echo "UUID:  $uuid"
  echo "Directories: hermes/ memory/ artifacts/ models/ archive/"
}
