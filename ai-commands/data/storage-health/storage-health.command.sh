#!/usr/bin/env bash
set -euo pipefail
usage(){ echo "usage: $0 inspect | health DEVICE|--all [--json] | report DEVICE|--all [--json] | ai-report DEVICE|--all [--json] | test DEVICE --short|--long | test-status DEVICE"; }
need(){ command -v "$1" >/dev/null 2>&1 || { echo "ERROR: missing dependency: $1" >&2; exit 2; }; }
ensure_smartctl(){
  command -v smartctl >/dev/null 2>&1 && return 0
  echo
  echo "AI Fleas storage-health needs smartctl to inspect disk health."
  echo "Dependency: smartmontools"
  echo "Purpose: SMART health evidence and non-destructive disk self-tests."
  if [[ ! -t 0 ]]; then
    echo "ERROR: non-interactive session; install smartmontools or rerun interactively." >&2
    exit 2
  fi
  printf "Install smartmontools now? [y/N] "
  read -r answer
  [[ "$answer" =~ ^[Yy]([Ee][Ss])?$ ]] || { echo "Installation skipped."; exit 2; }
  if command -v apt-get >/dev/null 2>&1; then sudo apt-get update && sudo apt-get install -y smartmontools
  elif command -v dnf >/dev/null 2>&1; then sudo dnf install -y smartmontools
  elif command -v yum >/dev/null 2>&1; then sudo yum install -y smartmontools
  elif command -v pacman >/dev/null 2>&1; then sudo pacman -S --needed smartmontools
  else echo "ERROR: unsupported package manager; install smartmontools manually." >&2; exit 2; fi
  command -v smartctl >/dev/null 2>&1 || { echo "ERROR: smartctl still unavailable after installation." >&2; exit 2; }
  echo "✓ smartctl available"
}
is_disk(){ [[ -b "$1" ]] && [[ "$(lsblk -dn -o TYPE "$1" 2>/dev/null)" == "disk" ]]; }
inspect(){
  need lsblk
  echo "AI Fleas · Storage Discovery"
  echo "────────────────────────────"
  lsblk -d -o NAME,PATH,SIZE,MODEL,SERIAL,TRAN,TYPE,FSTYPE,MOUNTPOINTS
}
smart_type(){ smartctl --scan-open 2>/dev/null | awk -v d="$1" '$1==d && $2=="-d" {print $3; exit}'; }
smart_capture(){ local dev="$1"; shift; is_disk "$dev" || { echo "ERROR: not a block disk: $dev" >&2; return 2; }; local dtype; dtype="$(smart_type "$dev" || true)"; if [[ -n "$dtype" ]]; then sudo smartctl -d "$dtype" "$@" "$dev"; else sudo smartctl "$@" "$dev"; fi; }
attr_raw(){ awk -v n="$2" '$0 ~ n {for(i=NF;i>=1;i--) if($i ~ /^[0-9]+$/){print $i; exit}}' <<<"$1"; }
assess(){
 local dev="$1" json="$2" out status="HEALTHY" reason="" overall="" temp="" poh="" realloc="" pending="" uncorr="" reported=""
 if ! out="$(smart_capture "$dev" -a 2>&1)"; then status="WARN"; reason="SMART data unavailable or incomplete"; else
  overall="$(grep -Ei 'SMART overall-health self-assessment test result:|SMART Health Status:' <<<"$out" | head -1 | sed 's/.*: *//' || true)"
  temp="$(awk '/Temperature_Celsius/ {print $10; exit} /Current Drive Temperature:/ {for(i=1;i<=NF;i++) if($i ~ /^[0-9]+$/){print $i; exit}} /Temperature:/ {for(i=1;i<=NF;i++) if($i ~ /^[0-9]+$/){print $i; exit}}' <<<"$out" || true)"
  poh="$(awk '/Power_On_Hours/ {v=$10; sub(/h.*/, "", v); print v; exit} /Power on hours/ {for(i=NF;i>=1;i--) if($i ~ /^[0-9]+([.][0-9]+)?$/){print $i; exit}}' <<<"$out" || true)"; realloc="$(attr_raw "$out" 'Reallocated_Sector_Ct|Reallocated Sector' || true)"
  pending="$(attr_raw "$out" 'Current_Pending_Sector|Current Pending Sector' || true)"; uncorr="$(attr_raw "$out" 'Offline_Uncorrectable|Offline Uncorrectable' || true)"
  reported="$(attr_raw "$out" 'Reported_Uncorrect|Reported Uncorrectable' || true)"
  if grep -Eqi 'SMART overall-health.*FAILED|SMART Health Status:.*(BAD|FAILED)' <<<"$out"; then status="FAIL"; reason="SMART overall health failed"; fi
  if [[ "$pending" =~ ^[0-9]+$ ]] && (( pending > 0 )); then status="FAIL"; reason="pending sectors are non-zero"; fi
  if [[ "$uncorr" =~ ^[0-9]+$ ]] && (( uncorr > 0 )); then status="FAIL"; reason="offline uncorrectable sectors are non-zero"; fi
  if [[ "$status" == "HEALTHY" && "$realloc" =~ ^[0-9]+$ ]] && (( realloc > 0 )); then status="WARN"; reason="reallocated sectors are non-zero"; fi
 fi
 local model serial size tran; model="$(lsblk -dn -o MODEL "$dev" | xargs)"; serial="$(lsblk -dn -o SERIAL "$dev" | xargs)"; size="$(lsblk -dn -o SIZE "$dev" | xargs)"; tran="$(lsblk -dn -o TRAN "$dev" | xargs)"
 if [[ "$json" == 1 ]]; then printf '{"device":"%s","model":"%s","serial":"%s","size":"%s","transport":"%s","assessment":"%s","overall":"%s","temperature_c":"%s","power_on_hours":"%s","reallocated":"%s","pending":"%s","offline_uncorrectable":"%s","reason":"%s"}\n' "$dev" "$model" "$serial" "$size" "$tran" "$status" "$overall" "$temp" "$poh" "$realloc" "$pending" "$uncorr" "$reason"; else printf 'AI Fleas · Storage Health\n─────────────────────────\n%s %s\nDevice: %s\nSerial: %s\nTransport: %s\nSMART: %s\nTemperature: %s C\nPower-on: %s h\nReallocated: %s\nPending: %s\nUncorrectable: %s\n\nAssessment: %s\n' "$model" "$size" "$dev" "$serial" "$tran" "${overall:-unknown}" "${temp:-unknown}" "${poh:-unknown}" "${realloc:-unknown}" "${pending:-unknown}" "${uncorr:-unknown}" "$status"; if [[ -n "$reason" ]]; then echo "Reason: $reason"; fi; fi
 return 0
}
ai_suitability(){
 local dev="$1" json="$2"
 local rota tran size model
 rota="$(lsblk -dn -o ROTA "$dev" | xargs)"; tran="$(lsblk -dn -o TRAN "$dev" | xargs)"
 size="$(lsblk -dn -o SIZE "$dev" | xargs)"; model="$(lsblk -dn -o MODEL "$dev" | xargs)"
 local persistent="GOOD" documents="GOOD" archive="GOOD" model_library="GOOD" vector="CONDITIONAL" active_inference="POOR" workspace="POOR"
 local reason="Rotational storage favors capacity and sequential/archive workloads; latency-sensitive random I/O should use SSD/NVMe."
 if [[ "$rota" == "0" ]]; then
   persistent="GOOD"; documents="GOOD"; archive="GOOD"; model_library="GOOD"; vector="GOOD"; active_inference="GOOD"; workspace="GOOD"
   reason="Non-rotational storage is generally suitable for both persistent AI data and latency-sensitive random I/O; benchmark when throughput is critical."
 fi
 if [[ "$json" == 1 ]]; then
   printf '{"device":"%s","model":"%s","size":"%s","transport":"%s","rotational":%s,"ai_suitability":{"agent_persistent_memory":"%s","knowledge_documents":"%s","backup_archive":"%s","cold_model_library":"%s","vector_search":"%s","active_inference_storage":"%s","agent_workspace_builds":"%s"},"reason":"%s"}\n' "$dev" "$model" "$size" "$tran" "$rota" "$persistent" "$documents" "$archive" "$model_library" "$vector" "$active_inference" "$workspace" "$reason"
 else
   printf 'AI Fleas · AI Workload Suitability\n───────────────────────────────────\nAgent persistent memory: %s\nKnowledge/document store: %s\nBackup/archive: %s\nCold model library: %s\nVector/search storage: %s\nActive inference storage: %s\nAgent workspace/builds: %s\n\nReason: %s\n' "$persistent" "$documents" "$archive" "$model_library" "$vector" "$active_inference" "$workspace" "$reason"
 fi
 return 0
}
external_disks(){ lsblk -dn -p -o NAME,TYPE,TRAN | awk '$2=="disk" && ($3=="usb" || $3=="sata"){print $1}'; }
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
  echo "  [5] Check previous test status"
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
    q|Q) echo "No changes made." ;;
    *) echo "Invalid choice."; return 2 ;;
  esac
}

main(){ [[ $# -ge 1 ]] || { interactive; return; }; local action="$1"; shift; case "$action" in inspect) inspect;; health|report) ensure_smartctl; local target="${1:-}" json=0; [[ -n "$target" ]] || { usage; exit 2; }; shift || true; [[ "${1:-}" == "--json" ]] && json=1; if [[ "$target" == "--all" ]]; then while read -r d; do assess "$d" "$json"; [[ "$json" == 1 ]] || echo; done < <(external_disks); else assess "$target" "$json"; fi;; ai-report) ensure_smartctl; local target="${1:-}" json=0; [[ -n "$target" ]] || { usage; exit 2; }; shift || true; [[ "${1:-}" == "--json" ]] && json=1; if [[ "$target" == "--all" ]]; then while read -r d; do assess "$d" "$json"; ai_suitability "$d" "$json"; [[ "$json" == 1 ]] || echo; done < <(external_disks); else assess "$target" "$json"; [[ "$json" == 0 ]] && echo; ai_suitability "$target" "$json"; fi;; test) ensure_smartctl; local dev="${1:-}" kind="${2:-}"; [[ "$kind" == "--short" || "$kind" == "--long" ]] || { usage; exit 2; }; smart_capture "$dev" -t "${kind#--}";; test-status) ensure_smartctl; local dev="${1:-}"; [[ -n "$dev" ]] || { usage; exit 2; }; smart_capture "$dev" -a | grep -Ei 'Self-test|remaining|progress|SMART overall-health|SMART Health Status' || true;; *) usage; exit 2;; esac; }
main "$@"
