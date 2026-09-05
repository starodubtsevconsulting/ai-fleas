#!/usr/bin/env bash
set -euo pipefail

# Ensure we run under bash even if invoked from zsh
if [ -z "${BASH_VERSION:-}" ]; then
  exec bash "$0" "$@"
fi

SCALA_VERSION="3.4.1"
SCALA_HOME="$HOME/scala"
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root_dir="$(cd "$script_dir/.." && pwd)"
# shellcheck disable=SC1091
source "$root_dir/scripts/report-log.sh"
matrix_file="$script_dir/../v_matrix.json"
install_latest_scala="true"
SCALA_LATEST_PIN=""

# Load shared inventory helper
if [ -f "$script_dir/../scripts/runtime-inventory.sh" ]; then
  # shellcheck disable=SC1091
  source "$script_dir/../scripts/runtime-inventory.sh"
else
  echo "Missing helper: scripts/runtime-inventory.sh"
  exit 1
fi

if [ -f "$matrix_file" ] && command -v python3 >/dev/null 2>&1; then
  codename="$(. /etc/os-release && echo "$VERSION_CODENAME")"
matrix_out="$(python3 - "$matrix_file" "$codename" <<'PY'
import json
import sys

path = sys.argv[1]
codename = sys.argv[2]

with open(path, "r", encoding="utf-8") as fh:
    data = json.load(fh)

default_version = data.get("default_scala_version")
current_codename = None
current_version = None
final_version = default_version
for entry in data.get("ubuntu_to_scala", []):
    if entry.get("codename") == codename and entry.get("recommended_version"):
        final_version = entry["recommended_version"]
    if entry.get("current") or entry.get("selected"):
        current_codename = entry.get("codename")
        if entry.get("recommended_version"):
            current_version = entry["recommended_version"]

install_latest = data.get("install_latest_scala", False)
latest_pin = data.get("latest_scala_version")

if current_codename and current_codename == codename and current_version:
    final_version = current_version

if final_version:
    print("VERSION=" + final_version)
if current_codename:
    print("CURRENT=" + current_codename)
print("INSTALL_LATEST=" + str(install_latest))
if latest_pin:
    print("LATEST_VERSION=" + latest_pin)
PY
)"

  if [ -n "$matrix_out" ]; then
    while IFS= read -r line; do
      case "$line" in
        VERSION=*)
          SCALA_VERSION="${line#VERSION=}"
          ;;
        CURRENT=*|SELECTED=*)
          current_codename="${line#*=}"
          if [ -n "$current_codename" ] && [ "$current_codename" != "$codename" ]; then
            echo "Matrix check: WARNING - current OS ($current_codename) does not match this system ($codename)."
          else
            echo "Matrix check: OK - current OS matches this system ($codename)."
          fi
          ;;
        INSTALL_LATEST=*)
          install_latest_scala="${line#INSTALL_LATEST=}"
          ;;
        LATEST_VERSION=*)
          SCALA_LATEST_PIN="${line#LATEST_VERSION=}"
          ;;
      esac
    done <<< "$matrix_out"
  else
    echo "Matrix check: WARNING - no current OS in v_matrix.json."
  fi
else
  echo "Matrix check: SKIPPED - v_matrix.json missing or python3 not available."
fi

if [ -n "${SCALA_VERSION_OVERRIDE:-}" ]; then
  SCALA_VERSION="$SCALA_VERSION_OVERRIDE"
  echo "Using SCALA_VERSION_OVERRIDE=${SCALA_VERSION}"
fi

show_plan() {
echo "Plan:"
echo "  specific: ${SCALA_VERSION} -> ${SCALA_HOME}/${SCALA_VERSION}"
if [ "${install_latest_scala}" = "True" ] || [ "${install_latest_scala}" = "true" ]; then
  echo "  latest:   auto-detect latest Scala 3 -> ${SCALA_HOME}/latest"
else
  echo "  latest:   skipped (install_latest_scala=false)"
fi
echo
}

LABEL_DETAIL="$( (show_plan; runtime_inventory "$SCALA_HOME" "bin/scala" "Current Scala inventory" '[0-9]+([.][0-9]+)*') || true)"
if ! LABEL_DETAIL="$LABEL_DETAIL" "$script_dir/../scripts/confirm-reinstall.sh" "Scala" "test -x \"$SCALA_HOME/current/bin/scala\""; then
  exit 0
fi

if ! command -v java >/dev/null 2>&1 && [ ! -x "$HOME/java/current/bin/java" ]; then
  echo "Warning: Java is not detected. Scala needs a JDK (run ./java/install.sh)."
fi

cleanup() {
  if [ -n "${WORKDIR:-}" ] && [ -d "$WORKDIR" ]; then
    rm -rf "$WORKDIR"
  fi
}
trap cleanup EXIT
report_log_init "scala/install.sh" "$root_dir"

WORKDIR="$(mktemp -d)"

latest_scala_version=""

detect_scala_version() {
  local bin="$1"
  if [ ! -x "$bin" ]; then
    return 1
  fi
  "$bin" -version 2>&1 | grep -oE '[0-9]+([.][0-9]+)*' | head -n1
}

fetch_latest_scala() {
  if [ -n "$SCALA_LATEST_PIN" ]; then
    echo "$SCALA_LATEST_PIN"
    return 0
  fi

  latest_tag="$(curl -I -Ls -o /dev/null -w '%{url_effective}' "https://github.com/scala/scala3/releases/latest" |
    sed -E 's#.*/tag/([^/]+).*#\1#')"

  if printf "%s" "$latest_tag" | grep -qE '^3\\.'; then
    echo "$latest_tag"
  else
    # Fallback to the requested specific version if tag is unexpected
    echo "$SCALA_VERSION"
  fi
}

install_scala_version() {
  local version="$1"
  local target_dir="$2"
  local tarball="scala3-${version}.tar.gz"
  local url="https://github.com/scala/scala3/releases/download/${version}/${tarball}"

  if ! curl -Ifs "$url" >/dev/null 2>&1; then
    echo "Scala ${version} tarball not found at:"
    echo "  $url"
    echo "Update v_matrix.json or set SCALA_VERSION_OVERRIDE to a valid Scala 3 release (e.g., ${SCALA_VERSION}) and rerun."
    exit 1
  fi

  mkdir -p "$SCALA_HOME"
  cd "$WORKDIR"
  curl -fsSLO "$url"
  tar_flags=()
  if tar --version 2>/dev/null | head -n1 | grep -qi gnu; then
    tar_flags+=(--warning=no-unknown-keyword)
  fi
  tar "${tar_flags[@]}" -xzf "$tarball"

  extracted_dir="scala3-${version}"
  if [ ! -d "$extracted_dir" ]; then
    echo "Failed to extract Scala ${version}"
    exit 1
  fi

  rm -rf "$target_dir"
  mv "$extracted_dir" "$target_dir"
  rm -f "$tarball"
}

cleanup_invalid_versions() {
  for d in "$SCALA_HOME"/*; do
    [ -d "$d" ] || continue
    base="$(basename "$d")"
    case "$base" in
      [0-9]*)
        ver="$(detect_scala_version "$d/bin/scala" || true)"
        if [ -z "$ver" ] || ! printf "%s" "$ver" | grep -qE '^3\\.'; then
          echo "Removing invalid Scala dir: $d (reports ${ver:-unknown})"
          rm -rf "$d"
        fi
        ;;
    esac
  done
}

cleanup_scala_home() {
  mkdir -p "$SCALA_HOME"
  for path in "$SCALA_HOME"/* "$SCALA_HOME"/.*; do
    [ -e "$path" ] || continue
    base="$(basename "$path")"
    case "$base" in
      .|..|current|latest|switch.sh|[0-9]*)
        ;;
      *)
        rm -rf "$path"
        ;;
    esac
  done
}

cleanup_scala_home
cleanup_invalid_versions
show_plan

install_scala_version "$SCALA_VERSION" "${SCALA_HOME}/${SCALA_VERSION}"

if [ "${install_latest_scala}" = "True" ] || [ "${install_latest_scala}" = "true" ]; then
  latest_scala_version="$(fetch_latest_scala)"
  if [ -z "$latest_scala_version" ]; then
    echo "Warning: failed to detect latest Scala release; skipping latest install."
  else
    if [ "$latest_scala_version" = "$SCALA_VERSION" ]; then
      ln -sfn "${SCALA_HOME}/${SCALA_VERSION}" "${SCALA_HOME}/latest"
    else
      install_scala_version "$latest_scala_version" "${SCALA_HOME}/${latest_scala_version}"
      ln -sfn "${SCALA_HOME}/${latest_scala_version}" "${SCALA_HOME}/latest"
    fi
  fi
fi

ln -sfn "${SCALA_HOME}/${SCALA_VERSION}" "${SCALA_HOME}/current"

# Keep a copy in ~/scala and expose a global helper
cp "$script_dir/switch.sh" "$SCALA_HOME/switch.sh"
chmod +x "$SCALA_HOME/switch.sh"

mkdir -p "$HOME/bin"
ln -sfn "$SCALA_HOME/switch.sh" "$HOME/bin/scala-switch"
chmod +x "$HOME/bin/scala-switch"

backup_file() {
  local target="$1"
  if [ -f "$target" ]; then
    cp "$target" "${target}.$(date +%Y%m%d%H%M%S).sh.bk"
  fi
}

add_path_block() {
  local file="$1"
  local scala_start="# SCALA_HOME_START"
  local scala_end="# SCALA_HOME_END"
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

  remove_block "$scala_start" "$scala_end" "$file"
  remove_block "$bin_start" "$bin_end" "$file"

  {
    echo ""
    echo "$scala_start"
    echo "export SCALA_HOME=\"$SCALA_HOME\""
    echo "export PATH=\"\$SCALA_HOME/current/bin:\$PATH\""
    echo "$scala_end"
    echo ""
    echo "$bin_start"
    echo "export PATH=\"\$HOME/bin:\$PATH\""
    echo "$bin_end"
  } >> "$file"

}

add_path_block "$HOME/.profile"
add_path_block "$HOME/.zshrc"

print_symlinks() {
  echo
  echo "Symlinks:"
  if [ -L "${SCALA_HOME}/current" ]; then
    echo "  current -> $(readlink -f "${SCALA_HOME}/current")"
  else
    echo "  current -> (missing)"
  fi
  if [ -L "${SCALA_HOME}/latest" ]; then
    echo "  latest -> $(readlink -f "${SCALA_HOME}/latest")"
  else
    echo "  latest -> (missing)"
  fi
  echo
}

runtime_inventory "$SCALA_HOME" "bin/scala" "Installed Scala versions" '[0-9]+([.][0-9]+)+'

print_symlinks

echo "Scala ${SCALA_VERSION} installed in ${SCALA_HOME}/${SCALA_VERSION}"
echo
echo "=== README ==="
cat "$script_dir/README.md"
