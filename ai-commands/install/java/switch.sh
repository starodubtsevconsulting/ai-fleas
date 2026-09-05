#!/usr/bin/env bash
set -euo pipefail

# Ensure we run under bash even if invoked from zsh
if [ -z "${BASH_VERSION:-}" ]; then
  exec bash "$0" "$@"
fi

JAVA_HOME_BASE="$HOME/java"

list_versions() {
  local d base java_bin ver
  for d in "$JAVA_HOME_BASE"/*; do
    [ -d "$d" ] || continue
    base="$(basename "$d")"
    case "$base" in
      [0-9]*-aws|latest-aws)
        java_bin="$d/bin/java"
        if [ -x "$java_bin" ]; then
          ver="$("$java_bin" -version 2>&1 | head -n1 | sed -E 's/.*"([0-9]+).*/\1/')"
          [ -n "$ver" ] && printf "%s|%s\n" "$base" "$ver"
        fi
        ;;
    esac
  done | sort -t '|' -k2,2V
}

pick_version() {
  local versions=()
  while IFS= read -r v; do
    [ -n "$v" ] && versions+=("$v")
  done < <(list_versions)

  if [ "${#versions[@]}" -eq 0 ]; then
    echo "No installed versions found in $JAVA_HOME_BASE"
    exit 1
  fi

  printf "\nInstalled versions in %s:\n" "$JAVA_HOME_BASE" >&2
  local i=1
  for v in "${versions[@]}"; do
    base="${v%%|*}"
    ver="${v#*|}"
    printf "  %d) %s (%s)\n" "$i" "$base" "$ver" >&2
    i=$((i + 1))
  done

  printf "Choose a version number and press Enter.\n" >&2
  read -r -p "Switch to which version? [1-${#versions[@]}]: " choice
  if ! [[ "$choice" =~ ^[0-9]+$ ]] || [ "$choice" -lt 1 ] || [ "$choice" -gt "${#versions[@]}" ]; then
    echo "Invalid choice."
    exit 1
  fi

  echo "${versions[$((choice - 1))]}"
}

if [ -z "${1-}" ]; then
  target="$(pick_version)"
else
  target="$1"
fi

target_base="${target%%|*}"
if [ ! -d "$JAVA_HOME_BASE/$target_base" ]; then
  echo "Not found: $JAVA_HOME_BASE/$target"
  exit 1
fi

ln -sfn "$JAVA_HOME_BASE/$target_base" "$JAVA_HOME_BASE/current"

echo "Now using: $JAVA_HOME_BASE/current"
echo "If needed, reload shell or run: source ~/.profile"
