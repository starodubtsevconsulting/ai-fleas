#!/usr/bin/env bash
set -euo pipefail

# runtime_inventory <runtime_home> <bin_relative_path> [label] [version_pattern]
# Lists version directories (numeric, latest, current) under runtime_home and prints
# the resolved version string from the provided binary. If version_pattern is given,
# the first match from that pattern is shown; otherwise the first line of -version
# output is shown.
runtime_inventory() {
  local runtime_home="${1-}"
  local bin_rel="${2-}"
  local label="${3:-Inventory}"
  local pattern="${4-}"

  if [ -z "$runtime_home" ] || [ -z "$bin_rel" ]; then
    echo "runtime_inventory: runtime_home and bin_relative_path are required." >&2
    return 1
  fi

  echo "$label in $runtime_home:"
  printf "  %-10s | %s\n" "dir" "binary version"
  printf "  %-10s-+-%s\n" "----------" "----------------"
  for d in "$runtime_home"/*; do
    [ -d "$d" ] || continue
    base="$(basename "$d")"
    case "$base" in
      [0-9]*|latest|current)
        bin_path="$d/$bin_rel"
        ver="(missing bin)"
        if [ -x "$bin_path" ]; then
          line="$("$bin_path" -version 2>&1 | head -n1 || true)"
          if [ -n "$pattern" ]; then
            ver="$(printf "%s\n" "$line" | grep -oE "$pattern" | head -n1 || true)"
            ver="${ver:-$line}"
          else
            ver="$line"
          fi
        fi
        printf "  %-10s | %s\n" "$base" "${ver:-unknown}"
        ;;
    esac
  done
  echo
}
