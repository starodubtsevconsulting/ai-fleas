#!/usr/bin/env bash
set -euo pipefail

manifest="${1:?command manifest required}"

[[ -f "$manifest" ]] || {
  echo "Command manifest missing: $manifest" >&2
  exit 1
}

powered="$(awk '
  /^[[:space:]]*ai:[[:space:]]*$/ { in_ai=1; next }
  in_ai && /^[^[:space:]]/ { in_ai=0 }
  in_ai && /^[[:space:]]*powered:[[:space:]]*/ {
    sub(/^[[:space:]]*powered:[[:space:]]*/, "")
    gsub(/[[:space:]]+$/, "")
    print
    exit
  }
' "$manifest")"

case "$powered" in
  false)
    exit 0
    ;;
  true)
    echo "AI-powered command execution is declared for this command, but AI command support is not implemented yet." >&2
    exit 78
    ;;
  *)
    echo "Invalid or missing ai.powered in $manifest; expected true or false." >&2
    exit 1
    ;;
esac
