#!/usr/bin/env bash
smart_timeout(){
  local seconds="${SMARTCTL_TIMEOUT_SECONDS:-8}"
  if command -v timeout >/dev/null 2>&1; then
    timeout --signal=TERM --kill-after=2s "${seconds}s" "$@"
  else
    "$@"
  fi
}
smart_type(){
  smart_timeout smartctl --scan-open 2>/dev/null | awk -v d="$1" '$1==d && $2=="-d" {print $3; exit}'
}
smart_probe_type(){
  local dev="$1" dtype candidate out
  dtype="$(smart_probe_type "$dev" || true)"
  local candidates=()
  [[ -n "$dtype" ]] && candidates+=("$dtype")
  candidates+=("__default__" "sat" "sat,12")
  local seen=" "
  for candidate in "${candidates[@]}"; do
    [[ "$seen" == *" $candidate "* ]] && continue
    seen+="$candidate "
    if [[ "$candidate" == "__default__" ]]; then
      out="$(smart_timeout sudo smartctl -i "$dev" 2>&1)" || true
    else
      out="$(smart_timeout sudo smartctl -d "$candidate" -i "$dev" 2>&1)" || true
    fi
    if grep -Eqi 'Device Model:|Model Family:|Product:|Serial Number:|SMART support is:' <<<"$out" &&
       ! grep -Eqi 'Unknown USB bridge|Please specify device type|Unable to detect device type|Read Device Identity failed' <<<"$out"; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done
  return 1
}
smart_capture(){
  local dev="$1"; shift
  is_disk "$dev" || { echo "ERROR: not a block disk: $dev" >&2; return 2; }
  local dtype
  dtype="$(smart_probe_type "$dev" || true)"
  [[ -n "$dtype" ]] || { echo "ERROR: SMART access unavailable: no supported device transport worked for $dev" >&2; return 3; }
  if [[ "$dtype" == "__default__" ]]; then
    smart_timeout sudo smartctl "$@" "$dev"
  else
    smart_timeout sudo smartctl -d "$dtype" "$@" "$dev"
  fi
}
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
 record_test_start "$dev" "$kind"
}

smart_long_estimate(){
  local dev="$1" dtype out mins
  dtype="$(smart_type "$dev" || true)"
  if [[ -n "$dtype" ]]; then out="$(smart_timeout sudo smartctl -d "$dtype" -c "$dev" 2>/dev/null || true)"; else out="$(smart_timeout sudo smartctl -c "$dev" 2>/dev/null || true)"; fi
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

storage_state_root(){
  printf '%s\n' "${XDG_STATE_HOME:-$HOME/.local/state}/ai-fleas/storage-health"
}
drive_key(){
  local dev="$1" serial model
  serial="$(lsblk -dn -o SERIAL "$dev" | xargs)"
  model="$(lsblk -dn -o MODEL "$dev" | xargs | tr ' /' '__')"
  [[ -n "$serial" ]] && printf '%s\n' "$serial" || printf '%s\n' "$model"
}
test_state_file(){
  local root key
  root="$(storage_state_root)"; key="$(drive_key "$1")"
  mkdir -p "$root/$key"
  printf '%s/tests.log\n' "$root/$key"
}
record_test_start(){
  local dev="$1" kind="$2" file
  file="$(test_state_file "$dev")"
  printf '%s|STARTED|%s|%s\n' "$(date -Is)" "$kind" "$dev" >> "$file"
}
smart_test_history(){
  local dev="$1" file out
  file="$(test_state_file "$dev")"
  echo "AI Fleas · SMART Test History"
  echo "─────────────────────────────"
  echo "Drive: $(lsblk -dn -o MODEL "$dev" | xargs) $(lsblk -dn -o SIZE "$dev" | xargs)"
  echo "Stable key: $(drive_key "$dev")"
  echo
  if [[ -f "$file" ]]; then
    echo "AI Fleas local starts:"
    tail -n 10 "$file"
  else
    echo "AI Fleas local starts: none recorded."
  fi
  echo
  echo "Drive-retained SMART self-test log:"
  out="$(smart_capture "$dev" -l selftest 2>/dev/null || true)"
  [[ -n "$out" ]] && echo "$out" || echo "No SMART self-test history reported by drive."
}

smart_last_summary(){
  local dev="$1" out line
  out="$(smart_capture "$dev" -l selftest 2>/dev/null || true)"
  line="$(awk '/^# *[0-9]+/ {print; exit}' <<<"$out")"
  if [[ -n "$line" ]]; then
    echo "Last SMART test: $line"
  else
    echo "Last SMART test: none reported by drive"
  fi
}
