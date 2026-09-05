#!/usr/bin/env bash
set -euo pipefail

# Ensure we run under bash even if invoked from zsh
if [ -z "${BASH_VERSION:-}" ]; then
  exec bash "$0" "$@"
fi

SCALA_HOME="$HOME/scala"

list_versions() {
  local d base scala_bin ver
  for d in "$SCALA_HOME"/*; do
    [ -d "$d" ] || continue
    base="$(basename "$d")"
    case "$base" in
      [0-9]*|latest)
        scala_bin="$d/bin/scala"
        if [ -x "$scala_bin" ]; then
          ver="$("$scala_bin" -version 2>&1 | head -n1 | grep -oE '[0-9]+[.][0-9]+[.][0-9]+' | head -n1)"
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
    echo "No installed versions found in $SCALA_HOME"
    exit 1
  fi

  printf "\nInstalled versions in %s:\n" "$SCALA_HOME" >&2
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
if [ ! -d "$SCALA_HOME/$target_base" ]; then
  echo "Not found: $SCALA_HOME/$target"
  exit 1
fi

ln -sfn "$SCALA_HOME/$target_base" "$SCALA_HOME/current"

echo "Now using: $SCALA_HOME/current"
echo "If needed, reload shell or run: source ~/.profile"
