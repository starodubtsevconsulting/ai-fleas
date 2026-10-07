#!/usr/bin/env bash
smart_type(){ smartctl --scan-open 2>/dev/null | awk -v d="$1" '$1==d && $2=="-d" {print $3; exit}'; }
smart_capture(){ local dev="$1"; shift; is_disk "$dev" || { echo "ERROR: not a block disk: $dev" >&2; return 2; }; local dtype; dtype="$(smart_type "$dev" || true)"; if [[ -n "$dtype" ]]; then sudo smartctl -d "$dtype" "$@" "$dev"; else sudo smartctl "$@" "$dev"; fi; }
smart_test(){
 local dev="$1" kind="$2"
 if [[ "$kind" == "long" ]]; then
   echo "Long SMART self-test is non-destructive but can increase I/O activity on the selected disk."
   smart_long_estimate "$dev"
   if lsblk -nr -o MOUNTPOINTS "$dev" | grep -q '/'; then echo "WARNING: this device appears mounted/in use. Prefer a maintenance window."; fi
   [[ -t 0 ]] || { echo "ERROR: long test requires interactive confirmation." >&2; return 2; }
   printf "Start long test on %s now? [y/N] " "$dev"; read -r a
   [[ "$a" =~ ^[Yy]([Ee][Ss])?$ ]] || { echo "Test cancelled."; return 0; }
 fi
 smart_capture "$dev" -t "$kind"
}

smart_long_estimate(){
  local dev="$1" dtype out mins
  dtype="$(smart_type "$dev" || true)"
  if [[ -n "$dtype" ]]; then out="$(sudo smartctl -d "$dtype" -c "$dev" 2>/dev/null || true)"; else out="$(sudo smartctl -c "$dev" 2>/dev/null || true)"; fi
  mins="$(awk '/Extended self-test routine/ && /minutes/ {for(i=1;i<=NF;i++) if($i ~ /^[0-9]+$/){n=$i}} END{if(n) print n}' <<<"$out")"
  if [[ "$mins" =~ ^[0-9]+$ ]]; then
    local h=$(( (mins + 59) / 60 ))
    echo "Drive-reported long-test estimate: about $h hour(s) ($mins minutes)."
  else
    local bytes tb h
    bytes="$(lsblk -bdn -o SIZE "$dev" | xargs)"
    tb=$(( bytes / 1000000000000 ))
    (( tb < 1 )) && tb=1
    h=$(( (tb + 1) / 2 + 3 ))
    echo "Approximate long-test estimate: roughly $h+ hours (drive did not report a duration)."
  fi
}
