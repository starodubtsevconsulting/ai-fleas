#!/usr/bin/env bash
set -euo pipefail

# Ensure we run under bash even if invoked from zsh
if [ -z "${BASH_VERSION:-}" ]; then
  exec bash "$0" "$@"
fi

MAVEN_VERSION="3.9.9"
MAVEN_HOME="$HOME/maven"
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
ver = data.get("default_maven_version")
if ver:
    print(ver)
PY
)"
  if [ -n "$matrix_out" ]; then
    MAVEN_VERSION="$matrix_out"
  fi
fi

if [ -n "${MAVEN_VERSION_OVERRIDE:-}" ]; then
  MAVEN_VERSION="$MAVEN_VERSION_OVERRIDE"
  echo "Using MAVEN_VERSION_OVERRIDE=${MAVEN_VERSION}"
fi

cleanup_missing_bins() {
  for d in "$MAVEN_HOME"/*; do
    [ -d "$d" ] || continue
    [ "$(basename "$d")" = "current" ] && continue
    if [ ! -x "$d/bin/mvn" ]; then
      rm -rf "$d"
    fi
  done
}

cleanup_missing_bins

LABEL_DETAIL="$(runtime_inventory "$MAVEN_HOME" "current/bin/mvn" "Current Maven inventory" '[0-9]+([.][0-9]+)*' || true)"
if ! LABEL_DETAIL="$LABEL_DETAIL" "$script_dir/../scripts/confirm-reinstall.sh" "Maven" "test -x \"$MAVEN_HOME/current/bin/mvn\""; then
  exit 0
fi

cleanup() {
  if [ -n "${WORKDIR:-}" ] && [ -d "$WORKDIR" ]; then
    rm -rf "$WORKDIR"
  fi
}
trap cleanup EXIT
report_log_init "maven/install.sh" "$root_dir"

WORKDIR="$(mktemp -d)"

major="${MAVEN_VERSION%%.*}"
tarball="apache-maven-${MAVEN_VERSION}-bin.tar.gz"
primary_url="https://dlcdn.apache.org/maven/maven-${major}/${MAVEN_VERSION}/binaries/${tarball}"
archive_url="https://archive.apache.org/dist/maven/maven-${major}/${MAVEN_VERSION}/binaries/${tarball}"

download_url="$primary_url"
if ! curl -Ifs "$primary_url" >/dev/null 2>&1; then
  if curl -Ifs "$archive_url" >/dev/null 2>&1; then
    download_url="$archive_url"
  else
    echo "Maven ${MAVEN_VERSION} tarball not found at:"
    echo "  $primary_url"
    echo "  $archive_url"
    echo "Update v_matrix.json default_maven_version or set MAVEN_VERSION_OVERRIDE to a valid release."
    exit 1
  fi
fi

mkdir -p "$MAVEN_HOME"
cd "$WORKDIR"
curl -fsSLO "$download_url"
tar -xzf "$tarball"

extracted_dir="apache-maven-${MAVEN_VERSION}"
if [ ! -d "$extracted_dir" ]; then
  echo "Failed to extract Maven ${MAVEN_VERSION}"
  exit 1
fi

rm -rf "${MAVEN_HOME}/${MAVEN_VERSION}"
mv "$extracted_dir" "${MAVEN_HOME}/${MAVEN_VERSION}"
rm -f "$tarball"

ln -sfn "${MAVEN_HOME}/${MAVEN_VERSION}" "${MAVEN_HOME}/current"

# Drop any stale Maven dirs missing binaries
for d in "$MAVEN_HOME"/*; do
  [ -d "$d" ] || continue
  [ "$(basename "$d")" = "current" ] && continue
  if [ ! -x "$d/bin/mvn" ]; then
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
  local maven_start="# MAVEN_HOME_START"
  local maven_end="# MAVEN_HOME_END"
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

  remove_block "$maven_start" "$maven_end" "$file"
  remove_block "$bin_start" "$bin_end" "$file"

  {
    echo ""
    echo "$maven_start"
    echo "export MAVEN_HOME=\"$MAVEN_HOME\""
    echo "export M2_HOME=\"\$MAVEN_HOME/current\""
    echo "export PATH=\"\$M2_HOME/bin:\$PATH\""
    echo "$maven_end"
    echo ""
    echo "$bin_start"
    echo "export PATH=\"\$HOME/bin:\$PATH\""
    echo "$bin_end"
  } >> "$file"
}

add_path_block "$HOME/.profile"
add_path_block "$HOME/.zshrc"

# Copy switch helper and expose convenience symlink
cp "$script_dir/switch.sh" "$MAVEN_HOME/switch.sh"
chmod +x "$MAVEN_HOME/switch.sh"

mkdir -p "$HOME/bin"
ln -sfn "$MAVEN_HOME/switch.sh" "$HOME/bin/maven-switch"
chmod +x "$HOME/bin/maven-switch"

runtime_inventory "$MAVEN_HOME" "current/bin/mvn" "Installed Maven versions" '[0-9]+([.][0-9]+)*'

echo "Maven ${MAVEN_VERSION} installed in ${MAVEN_HOME}/${MAVEN_VERSION}"
echo
echo "=== README ==="
cat "$script_dir/README.md"
