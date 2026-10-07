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
  # Full assessments must not experiment with multiple USB/SATA bridge modes.
  # Trust smartctl's own scan result when available; otherwise use default access.
  # Explicit transport troubleshooting belongs in a deliberate diagnostic action,
  # not the normal health/AI assessment path.
  local dev="$1" dtype
  dtype="$(smart_type "$dev" || true)"
  if [[ -n "$dtype" ]]; then printf '%s\n' "$dtype"; else printf '%s\n' "__default__"; fi
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
 local dev="$1" kind="$2" start_out
 if [[ "$kind" == "long" ]]; then
   echo "Long SMART self-test is non-destructive but can increase I/O activity on the selected disk."
   smart_long_estimate "$dev"
   if lsblk -nr -o MOUNTPOINTS "$dev" | grep -q '/'; then echo "WARNING: this device appears mounted/in use. Prefer a maintenance window."; fi
   [[ -t 0 ]] || { echo "ERROR: long test requires interactive confirmation." >&2; return 2; }
   printf "Start long test on %s now? [y/N] " "$dev"; read -r a
   [[ "$a" =~ ^[Yy]([Ee][Ss])?$ ]] || { echo "Test cancelled."; return 0; }
 fi
 start_out="$(smart_capture "$dev" -t "$kind" 2>&1)"
 echo "$start_out"
 record_test_start "$dev" "$kind" "$start_out"
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
  local dev="$1" kind="$2" start_out="${3:-}" file mins=""
  file="$(test_state_file "$dev")"
  mins="$(awk '/Please wait [0-9]+ minutes/ {for(i=1;i<=NF;i++) if($i=="wait" && $(i+1) ~ /^[0-9]+$/){print $(i+1); exit}}' <<<"$start_out")"
  if [[ "$mins" =~ ^[0-9]+$ ]]; then
    printf '%s|STARTED|%s|%s|drive_estimate_minutes=%s\n' "$(date -Is)" "$kind" "$dev" "$mins" >> "$file"
  else
    printf '%s|STARTED|%s|%s\n' "$(date -Is)" "$kind" "$dev" >> "$file"
  fi
}
smart_test_history(){
  local dev="$1" file out line status remaining lifetime lba model size
  file="$(test_state_file "$dev")"
  model="$(lsblk -dn -o MODEL "$dev" | xargs)"
  size="$(lsblk -dn -o SIZE "$dev" | xargs)"
  out="$(smart_capture "$dev" -l selftest 2>/dev/null || true)"
  line="$(awk '/^# *[0-9]+/ {print; exit}' <<<"$out")"
  local cap progress_line remaining_pct complete_pct
  cap="$(smart_capture "$dev" -c 2>/dev/null || true)"
  progress_line="$(grep -Ei 'Self-test routine in progress|self-test.*remaining|Self-test execution status' <<<"$cap" | head -1 || true)"
  remaining_pct="$(grep -Eio '[0-9]+%.*remaining|[0-9]+% of test remaining' <<<"$cap" | grep -Eo '[0-9]+%' | head -1 | tr -d '%' || true)"
  if [[ "$remaining_pct" =~ ^[0-9]+$ ]]; then complete_pct=$((100-remaining_pct)); else complete_pct=""; fi

  echo "AI Fleas · SMART Test History"
  echo "─────────────────────────────"
  echo "$model $size"
  echo

  if [[ "$remaining_pct" =~ ^[0-9]+$ && "$remaining_pct" -gt 0 ]]; then
    echo "Current SMART self-test"
    echo "─────────────────────────────"
    echo "Result:       IN PROGRESS"
    echo "Progress:     ${complete_pct}% complete"
    echo "Remaining:    ${remaining_pct}%"
    [[ -n "$progress_line" ]] && echo "Drive status: $progress_line"
    if [[ -f "$file" ]]; then
      local latest_start estmins
      latest_start="$(tail -n 1 "$file")"
      estmins="$(sed -nE 's/.*drive_estimate_minutes=([0-9]+).*/\1/p' <<<"$latest_start")"
      [[ "$estmins" =~ ^[0-9]+$ ]] && echo "Drive estimate at start: $estmins minutes (~$(( (estmins+59)/60 )) hours)"
    fi
    echo
  fi

  if [[ -n "$line" ]]; then
    status="$(sed -E 's/^# *[0-9]+ +[^ ]+( +[^ ]+)? +//' <<<"$line" | sed -E 's/ +[0-9]+% +[0-9]+ +.*$//' | xargs)"
    remaining="$(grep -oE '[0-9]+%' <<<"$line" | head -1 || true)"
    lifetime="$(awk '{for(i=1;i<=NF;i++) if($i ~ /^[0-9]+$/) n=$i} END{if(n!="") print n}' <<<"$line")"
    lba="$(awk '{print $NF}' <<<"$line")"
    echo "Latest drive self-test"
    echo "─────────────────────────────"
    if grep -qi 'Completed without error' <<<"$line"; then
      echo "Result:       ✓ PASSED"
      echo "Coverage:     Complete (100%)"
      echo "Errors found: None reported"
      [[ "$lba" == "-" ]] && echo "Bad LBA:      None reported" || echo "First error:  $lba"
    elif grep -qiE 'Self-test routine in progress|in progress' <<<"$line"; then
      echo "Result:       IN PROGRESS"
      echo "Remaining:    ${remaining:-unknown}"
    else
      echo "Result:       ⚠ ${status:-See raw details}"
      echo "Remaining:    ${remaining:-unknown}"
      [[ -n "$lba" && "$lba" != "-" ]] && echo "First error:  $lba"
    fi
    [[ -n "$lifetime" ]] && echo "Drive age at test: $lifetime power-on hours"
  else
    echo "Latest drive self-test: none reported by drive"
  fi

  echo
  echo "AI Fleas local record"
  echo "─────────────────────────────"
  if [[ -f "$file" ]]; then tail -n 10 "$file"; else echo "No locally recorded test starts."; fi

  echo
  echo "Interpretation"
  echo "─────────────────────────────"
  if grep -qi 'Completed without error' <<<"$line"; then
    echo "✓ The drive completed its SMART self-test without reporting an error."
    echo "  This is strong positive evidence, but not a guarantee against every possible failure."
  elif [[ -n "$line" ]]; then
    echo "The latest drive self-test did not report a clean completed result."
  else
    echo "No retained SMART self-test result was available to interpret."
  fi

  echo
  echo "Raw SMART evidence"
  echo "─────────────────────────────"
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
