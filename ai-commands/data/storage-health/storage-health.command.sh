#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$ROOT/lib/discovery.sh"
source "$ROOT/lib/filesystem.sh"
source "$ROOT/lib/ai-suitability.sh"
source "$ROOT/lib/smart.sh"

usage(){ echo "usage: $0 inspect | filesystem DEVICE|--all | health DEVICE|--all [--json] | report DEVICE|--all [--json] | ai-report DEVICE|--all [--json] | qualify DEVICE|--all | test DEVICE --short|--long | test-status DEVICE"; }
need(){ command -v "$1" >/dev/null 2>&1 || { echo "ERROR: missing dependency: $1" >&2; exit 2; }; }
ensure_smartctl(){
 command -v smartctl >/dev/null 2>&1 && return 0
 echo; echo "AI Fleas storage-health needs smartctl to inspect disk health."; echo "Dependency: smartmontools"; echo "Purpose: SMART health evidence and non-destructive disk self-tests."
 [[ -t 0 ]] || { echo "ERROR: non-interactive session; install smartmontools or rerun interactively." >&2; exit 2; }
 printf "Install smartmontools now? [y/N] "; read -r answer
 [[ "$answer" =~ ^[Yy]([Ee][Ss])?$ ]] || { echo "Installation skipped."; exit 2; }
 if command -v apt-get >/dev/null 2>&1; then sudo apt-get update && sudo apt-get install -y smartmontools
 elif command -v dnf >/dev/null 2>&1; then sudo dnf install -y smartmontools
 elif command -v yum >/dev/null 2>&1; then sudo yum install -y smartmontools
 elif command -v pacman >/dev/null 2>&1; then sudo pacman -S --needed smartmontools
 else echo "ERROR: unsupported package manager; install smartmontools manually." >&2; exit 2; fi
 echo "✓ smartctl available"
}
is_disk(){ [[ -b "$1" ]] && [[ "$(lsblk -dn -o TYPE "$1" 2>/dev/null)" == "disk" ]]; }
inspect(){ need lsblk; echo "AI Fleas · Storage Discovery"; echo "────────────────────────────"; storage_inventory; }
attr_raw(){ awk -v n="$2" '$0 ~ n {for(i=NF;i>=1;i--) if($i ~ /^[0-9]+$/){print $i; exit}}' <<<"$1"; }
assess(){
 local dev="$1" json="$2" out status="HEALTHY" reason="" overall="" temp="" poh="" realloc="" pending="" uncorr=""
 if ! out="$(smart_capture "$dev" -a 2>&1)"; then status="WARN"; reason="SMART data unavailable or incomplete"; else
  overall="$(grep -Ei 'SMART overall-health self-assessment test result:|SMART Health Status:' <<<"$out" | head -1 | sed 's/.*: *//' || true)"
  temp="$(awk '/Temperature_Celsius/ {print $10; exit} /Current Drive Temperature:/ {for(i=1;i<=NF;i++) if($i ~ /^[0-9]+$/){print $i; exit}} /Temperature:/ {for(i=1;i<=NF;i++) if($i ~ /^[0-9]+$/){print $i; exit}}' <<<"$out" || true)"
  poh="$(awk '/Power_On_Hours/ {v=$10; sub(/h.*/, "", v); print v; exit} /Power on hours/ {for(i=NF;i>=1;i--) if($i ~ /^[0-9]+([.][0-9]+)?$/){print $i; exit}}' <<<"$out" || true)"
  realloc="$(attr_raw "$out" 'Reallocated_Sector_Ct|Reallocated Sector' || true)"; pending="$(attr_raw "$out" 'Current_Pending_Sector|Current Pending Sector' || true)"; uncorr="$(attr_raw "$out" 'Offline_Uncorrectable|Offline Uncorrectable' || true)"
  if grep -Eqi 'SMART overall-health.*FAILED|SMART Health Status:.*(BAD|FAILED)' <<<"$out"; then status="FAIL"; reason="SMART overall health failed"; fi
  if [[ "$pending" =~ ^[0-9]+$ ]] && (( pending > 0 )); then status="FAIL"; reason="pending sectors are non-zero"; fi
  if [[ "$uncorr" =~ ^[0-9]+$ ]] && (( uncorr > 0 )); then status="FAIL"; reason="offline uncorrectable sectors are non-zero"; fi
  if [[ "$status" == "HEALTHY" && "$realloc" =~ ^[0-9]+$ ]] && (( realloc > 0 )); then status="WARN"; reason="reallocated sectors are non-zero"; fi
 fi
 local model serial size tran; model="$(lsblk -dn -o MODEL "$dev" | xargs)"; serial="$(lsblk -dn -o SERIAL "$dev" | xargs)"; size="$(lsblk -dn -o SIZE "$dev" | xargs)"; tran="$(lsblk -dn -o TRAN "$dev" | xargs)"
 if [[ "$json" == 1 ]]; then printf '{"device":"%s","model":"%s","serial":"%s","size":"%s","transport":"%s","assessment":"%s","overall":"%s","temperature_c":"%s","power_on_hours":"%s","reallocated":"%s","pending":"%s","offline_uncorrectable":"%s","reason":"%s"}\n' "$dev" "$model" "$serial" "$size" "$tran" "$status" "$overall" "$temp" "$poh" "$realloc" "$pending" "$uncorr" "$reason"
 else printf 'AI Fleas · Storage Health\n─────────────────────────\n%s %s\nDevice: %s\nSerial: %s\nTransport: %s\nSMART: %s\nTemperature: %s C\nPower-on: %s h\nReallocated: %s\nPending: %s\nUncorrectable: %s\n\nAssessment: %s\n' "$model" "$size" "$dev" "$serial" "$tran" "${overall:-unknown}" "${temp:-unknown}" "${poh:-unknown}" "${realloc:-unknown}" "${pending:-unknown}" "${uncorr:-unknown}" "$status"; [[ -n "$reason" ]] && echo "Reason: $reason"; fi
 return 0
}
interactive(){
  [[ -t 0 ]] || { usage; exit 2; }
  echo "AI Fleas · Storage Health"
  echo "─────────────────────────"
  echo
  local disks=()
  while read -r d; do disks+=("$d"); done < <(external_disks)
  echo "Found ${#disks[@]} external drive(s)."
  local d
  for d in "${disks[@]}"; do
    printf "  - %s  %s  %s\n" "$d" "$(lsblk -dn -o SIZE "$d" | xargs)" "$(lsblk -dn -o MODEL "$d" | xargs)"
  done
  echo
  echo "What would you like to do?"
  echo "  [1] Full AI storage assessment"
  echo "  [2] Check physical health"
  echo "  [3] Run SMART self-test"
  echo "  [4] Show storage inventory"
  echo "  [5] Check previous test status"\n  echo "  [6] Inspect filesystem/signatures"\n  echo "  [7] Qualify storage for AI use"
  echo "  [q] Quit"
  printf "Choice: "; read -r choice
  case "$choice" in
    1) main ai-report --all ;;
    2) main health --all ;;
    3)
      [[ ${#disks[@]} -gt 0 ]] || { echo "No external drives found."; return; }
      echo "Select drive:"
      local i=1
      for d in "${disks[@]}"; do echo "  [$i] $d $(lsblk -dn -o MODEL "$d" | xargs)"; ((i++)); done
      printf "Drive: "; read -r n
      [[ "$n" =~ ^[0-9]+$ ]] && (( n>=1 && n<=${#disks[@]} )) || { echo "Invalid selection."; return 2; }
      printf "Test [s]hort or [l]ong? "; read -r kind
      [[ "$kind" =~ ^[Ll] ]] && main test "${disks[n-1]}" --long || main test "${disks[n-1]}" --short
      ;;
    4) main inspect ;;
    5)
      [[ ${#disks[@]} -gt 0 ]] || { echo "No external drives found."; return; }
      local i=1
      for d in "${disks[@]}"; do echo "  [$i] $d $(lsblk -dn -o MODEL "$d" | xargs)"; ((i++)); done
      printf "Drive: "; read -r n
      [[ "$n" =~ ^[0-9]+$ ]] && (( n>=1 && n<=${#disks[@]} )) || { echo "Invalid selection."; return 2; }
      main test-status "${disks[n-1]}"
      ;;
    6) main filesystem --all ;;
    7) main qualify --all ;;
    q|Q) echo "No changes made." ;;
    *) echo "Invalid choice."; return 2 ;;
  esac
}

main(){ [[ $# -ge 1 ]] || { interactive; return; }; local action="$1"; shift; case "$action" in inspect) inspect;; filesystem) local target="${1:-}"; [[ -n "$target" ]] || { usage; exit 2; }; if [[ "$target" == "--all" ]]; then while read -r d; do filesystem_report "$d"; echo; done < <(external_disks); else filesystem_report "$target"; fi;; qualify) ensure_smartctl; local target="${1:-}"; [[ -n "$target" ]] || { usage; exit 2; }; if [[ "$target" == "--all" ]]; then while read -r d; do filesystem_report "$d"; echo; assess "$d" 0; echo; ai_suitability "$d" 0; echo; done < <(external_disks); else filesystem_report "$target"; echo; assess "$target" 0; echo; ai_suitability "$target" 0; fi;; health|report) ensure_smartctl; local target="${1:-}" json=0; [[ -n "$target" ]] || { usage; exit 2; }; shift || true; [[ "${1:-}" == "--json" ]] && json=1; if [[ "$target" == "--all" ]]; then while read -r d; do assess "$d" "$json"; [[ "$json" == 1 ]] || echo; done < <(external_disks); else assess "$target" "$json"; fi;; ai-report) ensure_smartctl; local target="${1:-}" json=0; [[ -n "$target" ]] || { usage; exit 2; }; shift || true; [[ "${1:-}" == "--json" ]] && json=1; if [[ "$target" == "--all" ]]; then while read -r d; do assess "$d" "$json"; ai_suitability "$d" "$json"; [[ "$json" == 1 ]] || echo; done < <(external_disks); else assess "$target" "$json"; [[ "$json" == 0 ]] && echo; ai_suitability "$target" "$json"; fi;; test) ensure_smartctl; local dev="${1:-}" kind="${2:-}"; [[ "$kind" == "--short" || "$kind" == "--long" ]] || { usage; exit 2; }; smart_test "$dev" "${kind#--}";; test-status) ensure_smartctl; local dev="${1:-}"; [[ -n "$dev" ]] || { usage; exit 2; }; smart_capture "$dev" -a | grep -Ei 'Self-test|remaining|progress|SMART overall-health|SMART Health Status' || true;; *) usage; exit 2;; esac; }
main "$@"
