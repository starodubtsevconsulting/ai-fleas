#!/usr/bin/env bash
set -euo pipefail
usage(){ echo "usage: $0 inspect | health DEVICE|--all [--json] | report DEVICE|--all [--json] | test DEVICE --short|--long | test-status DEVICE"; }
need(){ command -v "$1" >/dev/null 2>&1 || { echo "ERROR: missing dependency: $1" >&2; exit 2; }; }
is_disk(){ [[ -b "$1" ]] && [[ "$(lsblk -dn -o TYPE "$1" 2>/dev/null)" == "disk" ]]; }
inspect(){ need lsblk; lsblk -d -o NAME,PATH,SIZE,MODEL,SERIAL,TRAN,TYPE,FSTYPE,MOUNTPOINTS; }
smart_type(){ smartctl --scan-open 2>/dev/null | awk -v d="$1" '$1==d && $2=="-d" {print $3; exit}'; }
smart_capture(){ local dev="$1"; shift; is_disk "$dev" || { echo "ERROR: not a block disk: $dev" >&2; return 2; }; local dtype; dtype="$(smart_type "$dev" || true)"; if [[ -n "$dtype" ]]; then sudo smartctl -d "$dtype" "$@" "$dev"; else sudo smartctl "$@" "$dev"; fi; }
attr_raw(){ awk -v n="$2" '$0 ~ n {for(i=NF;i>=1;i--) if($i ~ /^[0-9]+$/){print $i; exit}}' <<<"$1"; }
assess(){
 local dev="$1" json="$2" out status="HEALTHY" reason="" overall="" temp="" poh="" realloc="" pending="" uncorr="" reported=""
 if ! out="$(smart_capture "$dev" -a 2>&1)"; then status="WARN"; reason="SMART data unavailable or incomplete"; else
  overall="$(grep -Ei 'SMART overall-health self-assessment test result:|SMART Health Status:' <<<"$out" | head -1 | sed 's/.*: *//' || true)"
  temp="$(grep -Ei 'Temperature_Celsius|Current Drive Temperature:|Temperature:' <<<"$out" | head -1 | grep -Eo '[0-9]+' | tail -1 || true)"
  poh="$(attr_raw "$out" 'Power_On_Hours|Power on hours' || true)"; realloc="$(attr_raw "$out" 'Reallocated_Sector_Ct|Reallocated Sector' || true)"
  pending="$(attr_raw "$out" 'Current_Pending_Sector|Current Pending Sector' || true)"; uncorr="$(attr_raw "$out" 'Offline_Uncorrectable|Offline Uncorrectable' || true)"
  reported="$(attr_raw "$out" 'Reported_Uncorrect|Reported Uncorrectable' || true)"
  if grep -Eqi 'SMART overall-health.*FAILED|SMART Health Status:.*(BAD|FAILED)' <<<"$out"; then status="FAIL"; reason="SMART overall health failed"; fi
  if [[ "$pending" =~ ^[0-9]+$ ]] && (( pending > 0 )); then status="FAIL"; reason="pending sectors are non-zero"; fi
  if [[ "$uncorr" =~ ^[0-9]+$ ]] && (( uncorr > 0 )); then status="FAIL"; reason="offline uncorrectable sectors are non-zero"; fi
  if [[ "$status" == "HEALTHY" && "$realloc" =~ ^[0-9]+$ ]] && (( realloc > 0 )); then status="WARN"; reason="reallocated sectors are non-zero"; fi
 fi
 local model serial size tran; model="$(lsblk -dn -o MODEL "$dev" | xargs)"; serial="$(lsblk -dn -o SERIAL "$dev" | xargs)"; size="$(lsblk -dn -o SIZE "$dev" | xargs)"; tran="$(lsblk -dn -o TRAN "$dev" | xargs)"
 if [[ "$json" == 1 ]]; then printf '{"device":"%s","model":"%s","serial":"%s","size":"%s","transport":"%s","assessment":"%s","overall":"%s","temperature_c":"%s","power_on_hours":"%s","reallocated":"%s","pending":"%s","offline_uncorrectable":"%s","reason":"%s"}\n' "$dev" "$model" "$serial" "$size" "$tran" "$status" "$overall" "$temp" "$poh" "$realloc" "$pending" "$uncorr" "$reason"; else printf '%s %s\nDevice: %s\nSerial: %s\nTransport: %s\nSMART: %s\nTemperature: %s C\nPower-on: %s h\nReallocated: %s\nPending: %s\nUncorrectable: %s\n\nAssessment: %s\n' "$model" "$size" "$dev" "$serial" "$tran" "${overall:-unknown}" "${temp:-unknown}" "${poh:-unknown}" "${realloc:-unknown}" "${pending:-unknown}" "${uncorr:-unknown}" "$status"; [[ -n "$reason" ]] && echo "Reason: $reason"; fi
}
external_disks(){ lsblk -dn -p -o NAME,TYPE,TRAN | awk '$2=="disk" && ($3=="usb" || $3=="sata"){print $1}'; }
main(){ [[ $# -ge 1 ]] || { usage; exit 2; }; local action="$1"; shift; case "$action" in inspect) inspect;; health|report) need smartctl; local target="${1:-}" json=0; [[ -n "$target" ]] || { usage; exit 2; }; shift || true; [[ "${1:-}" == "--json" ]] && json=1; if [[ "$target" == "--all" ]]; then while read -r d; do assess "$d" "$json"; [[ "$json" == 1 ]] || echo; done < <(external_disks); else assess "$target" "$json"; fi;; test) need smartctl; local dev="${1:-}" kind="${2:-}"; [[ "$kind" == "--short" || "$kind" == "--long" ]] || { usage; exit 2; }; smart_capture "$dev" -t "${kind#--}";; test-status) need smartctl; local dev="${1:-}"; [[ -n "$dev" ]] || { usage; exit 2; }; smart_capture "$dev" -a | grep -Ei 'Self-test|remaining|progress|SMART overall-health|SMART Health Status' || true;; *) usage; exit 2;; esac; }
main "$@"
