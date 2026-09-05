#!/usr/bin/env bash
set -euo pipefail

# Ensure we run under bash even if invoked from zsh
if [ -z "${BASH_VERSION:-}" ]; then
  exec bash "$0" "$@"
fi

SBT_VERSION="1.10.7"
SBT_HOME="$HOME/sbt"
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root_dir="$(cd "$script_dir/.." && pwd)"
# shellcheck disable=SC1091
source "$root_dir/scripts/report-log.sh"
matrix_file="$script_dir/../v_matrix.json"

# Load shared inventory helper
if [ -f "$script_dir/../scripts/runtime-inventory.sh" ]; then
  # shellcheck disable=SC1091
  source "$script_dir/../scripts/runtime-inventory.sh"
else
  echo "Missing helper: scripts/runtime-inventory.sh"
  exit 1
fi

if [ -f "$matrix_file" ] && command -v python3 >/dev/null 2>&1; then
  matrix_out="$(python3 - "$matrix_file" <<'PY'
import json, sys
path = sys.argv[1]
with open(path, "r", encoding="utf-8") as fh:
    data = json.load(fh)
ver = data.get("default_sbt_version")
if ver:
    print(ver)
PY
)"
  if [ -n "$matrix_out" ]; then
    SBT_VERSION="$matrix_out"
  fi
fi

if [ -n "${SBT_VERSION_OVERRIDE:-}" ]; then
  SBT_VERSION="$SBT_VERSION_OVERRIDE"
  echo "Using SBT_VERSION_OVERRIDE=${SBT_VERSION}"
fi

cleanup_missing_bins() {
  for d in "$SBT_HOME"/*; do
    [ -d "$d" ] || continue
    [ "$(basename "$d")" = "current" ] && continue
    if [ ! -x "$d/bin/sbt" ]; then
      rm -rf "$d"
    fi
  done
}

cleanup_missing_bins

LABEL_DETAIL="$(runtime_inventory "$SBT_HOME" "current/bin/sbt" "Current sbt inventory" '[0-9]+([.][0-9]+)*' || true)"
if ! LABEL_DETAIL="$LABEL_DETAIL" "$script_dir/../scripts/confirm-reinstall.sh" "sbt" "test -x \"$SBT_HOME/current/bin/sbt\""; then
  exit 0
fi

cleanup() {
  if [ -n "${WORKDIR:-}" ] && [ -d "$WORKDIR" ]; then
    rm -rf "$WORKDIR"
  fi
}
trap cleanup EXIT
report_log_init "sbt/install.sh" "$root_dir"

WORKDIR="$(mktemp -d)"

tarball="sbt-${SBT_VERSION}.tgz"
url="https://github.com/sbt/sbt/releases/download/v${SBT_VERSION}/${tarball}"

if ! curl -Ifs "$url" >/dev/null 2>&1; then
  echo "sbt ${SBT_VERSION} tarball not found at:"
  echo "  $url"
  echo "Update v_matrix.json default_sbt_version or set SBT_VERSION_OVERRIDE to a valid release."
  exit 1
fi

mkdir -p "$SBT_HOME"
cd "$WORKDIR"
curl -fsSLO "$url"
tar -xzf "$tarball"

extracted_dir="sbt"
if [ ! -d "$extracted_dir" ]; then
  echo "Failed to extract sbt ${SBT_VERSION}"
  exit 1
fi

rm -rf "${SBT_HOME}/${SBT_VERSION}"
mv "$extracted_dir" "${SBT_HOME}/${SBT_VERSION}"
rm -f "$tarball"

ln -sfn "${SBT_HOME}/${SBT_VERSION}" "${SBT_HOME}/current"

# Drop any stale sbt dirs missing binaries
for d in "$SBT_HOME"/*; do
  [ -d "$d" ] || continue
  [ "$(basename "$d")" = "current" ] && continue
  if [ ! -x "$d/bin/sbt" ]; then
    rm -rf "$d"
  fi
done

backup_file() {
  local target="$1"
  if [ -f "$target" ]; then
    cp "$target" "${target}.$(date +%Y%m%d%H%M%S).sh.bk"
  fi
}

add_path_block() {
  local file="$1"
  local sbt_start="# SBT_HOME_START"
  local sbt_end="# SBT_HOME_END"
  local bin_start="# BIN_HOME_START"
  local bin_end="# BIN_HOME_END"

  backup_file "$file"

  remove_block() {
    local start="$1" end="$2" target="$3"
    if [ -f "$target" ]; then
      tmp="$(mktemp)"
      awk -v s="$start" -v e="$end" '
        $0==s {inside=1; next}
        inside && $0==e {inside=0; next}
        !inside {print}
      ' "$target" > "$tmp"
      mv "$tmp" "$target"
    else
      touch "$target"
    fi
  }

  remove_block "$sbt_start" "$sbt_end" "$file"
  remove_block "$bin_start" "$bin_end" "$file"

  {
    echo ""
    echo "$sbt_start"
    echo "export SBT_HOME=\"$SBT_HOME\""
    echo "export PATH=\"\$SBT_HOME/current/bin:\$PATH\""
    echo "$sbt_end"
    echo ""
    echo "$bin_start"
    echo "export PATH=\"\$HOME/bin:\$PATH\""
    echo "$bin_end"
  } >> "$file"
}

add_path_block "$HOME/.profile"
add_path_block "$HOME/.zshrc"

runtime_inventory "$SBT_HOME" "current/bin/sbt" "Installed sbt versions" '[0-9]+([.][0-9]+)*'

echo "sbt ${SBT_VERSION} installed in ${SBT_HOME}/${SBT_VERSION}"
echo
echo "=== README ==="
cat "$script_dir/README.md"
