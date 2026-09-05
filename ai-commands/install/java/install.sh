#!/usr/bin/env bash
set -euo pipefail

# Ensure we run under bash even if invoked from zsh
if [ -z "${BASH_VERSION:-}" ]; then
  exec bash "$0" "$@"
fi

JAVA_HOME_BASE="$HOME/java"
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root_dir="$(cd "$script_dir/.." && pwd)"
# shellcheck disable=SC1091
source "$root_dir/scripts/report-log.sh"
matrix_file="$script_dir/../v_matrix.json"

JAVA_MAJOR="21"
install_latest_java="true"

if [ -f "$matrix_file" ] && command -v python3 >/dev/null 2>&1; then
  codename="$(. /etc/os-release && echo "$VERSION_CODENAME")"
  matrix_out="$(python3 - "$matrix_file" "$codename" <<'PY'
import json
import sys

path = sys.argv[1]
codename = sys.argv[2]

with open(path, "r", encoding="utf-8") as fh:
    data = json.load(fh)

major = data.get("default_java_major")
selected = None
for entry in data.get("ubuntu_to_java", []):
    if entry.get("codename") == codename and entry.get("recommended_major"):
        major = entry["recommended_major"]
        break

for entry in data.get("ubuntu_to_java", []):
    if entry.get("selected"):
        selected = entry.get("codename")
        break

install_latest = data.get("install_latest_java", False)

if major:
    print(major)
if selected:
    print("SELECTED=" + selected)
print("INSTALL_LATEST=" + str(install_latest))
PY
)"

  if [ -n "$matrix_out" ]; then
    major_line="$(printf "%s\n" "$matrix_out" | head -n1)"
    selected_line="$(printf "%s\n" "$matrix_out" | sed -n '2p')"
    install_line="$(printf "%s\n" "$matrix_out" | tail -n1)"
    if [ -n "$major_line" ]; then
      JAVA_MAJOR="$major_line"
    fi
    if [ "${selected_line#SELECTED=}" != "$selected_line" ]; then
      selected_codename="${selected_line#SELECTED=}"
      if [ -n "$selected_codename" ] && [ "$selected_codename" != "$codename" ]; then
        echo "Matrix check: WARNING - selected OS ($selected_codename) does not match this system ($codename)."
      else
        echo "Matrix check: OK - selected OS matches this system ($codename)."
      fi
    else
      echo "Matrix check: WARNING - no selected OS in v_matrix.json."
    fi
    if [ "${install_line#INSTALL_LATEST=}" != "$install_line" ]; then
      install_latest_java="${install_line#INSTALL_LATEST=}"
    fi
  fi
else
  echo "Matrix check: SKIPPED - v_matrix.json missing or python3 not available."
fi

if ! "$script_dir/../scripts/confirm-reinstall.sh" "Java" "test -d \"$JAVA_HOME_BASE/${JAVA_MAJOR}-aws\""; then
  exit 0
fi


cleanup() {
  if [ -n "${WORKDIR:-}" ] && [ -d "$WORKDIR" ]; then
    rm -rf "$WORKDIR"
  fi
}
trap cleanup EXIT
report_log_init "java/install.sh" "$root_dir"

WORKDIR="$(mktemp -d)"

arch="$(uname -m)"
case "$arch" in
  x86_64)
    corretto_arch="x64"
    ;;
  aarch64|arm64)
    corretto_arch="aarch64"
    ;;
  *)
    echo "Unsupported architecture: $arch"
    exit 1
    ;;
esac

corretto_url() {
  local major="$1"
  echo "https://corretto.aws/downloads/latest/amazon-corretto-${major}-${corretto_arch}-linux-jdk.tar.gz"
}

install_corretto_major() {
  local major="$1"
  local target_dir="$2"
  local url
  url="$(corretto_url "$major")"

  cd "$WORKDIR"
  curl -fsSLO "$url"
  tarball="amazon-corretto-${major}-${corretto_arch}-linux-jdk.tar.gz"
  tar -xzf "$tarball"

  extracted_dir="$( (set +o pipefail; tar -tzf "$tarball" | head -n1 | cut -d/ -f1) )"
  if [ -z "$extracted_dir" ] || [ ! -d "$extracted_dir" ]; then
    echo "Failed to extract Corretto $major"
    exit 1
  fi

  mkdir -p "$JAVA_HOME_BASE"
  rm -rf "$target_dir"
  mv "$extracted_dir" "$target_dir"
  rm -f "$tarball"
}

find_latest_major() {
  local candidates="25 24 23 22 21 20 19 18 17"
  local major
  for major in $candidates; do
    if curl -fsI "$(corretto_url "$major")" >/dev/null 2>&1; then
      echo "$major"
      return 0
    fi
  done
  return 1
}

latest_major="$(find_latest_major || true)"
if [ -z "$latest_major" ]; then
  echo "Warning: failed to detect latest Corretto major version. Using 21 as latest."
  latest_major="21"
fi

install_corretto_major "$JAVA_MAJOR" "${JAVA_HOME_BASE}/${JAVA_MAJOR}-aws"
if [ "$latest_major" = "$JAVA_MAJOR" ]; then
  ln -sfn "${JAVA_HOME_BASE}/${JAVA_MAJOR}-aws" "${JAVA_HOME_BASE}/latest-aws"
else
  if [ "${install_latest_java}" = "True" ] || [ "${install_latest_java}" = "true" ]; then
    install_corretto_major "$latest_major" "${JAVA_HOME_BASE}/latest-aws"
  else
    ln -sfn "${JAVA_HOME_BASE}/${JAVA_MAJOR}-aws" "${JAVA_HOME_BASE}/latest-aws"
  fi
fi

if [ "${install_latest_java}" = "True" ] || [ "${install_latest_java}" = "true" ]; then
  ln -sfn "${JAVA_HOME_BASE}/latest-aws" "${JAVA_HOME_BASE}/current"
else
  ln -sfn "${JAVA_HOME_BASE}/${JAVA_MAJOR}-aws" "${JAVA_HOME_BASE}/current"
fi

# Keep a copy in ~/java and expose a global helper
cp "$script_dir/switch.sh" "$JAVA_HOME_BASE/switch.sh"
chmod +x "$JAVA_HOME_BASE/switch.sh"

mkdir -p "$HOME/bin"
ln -sfn "$JAVA_HOME_BASE/switch.sh" "$HOME/bin/java-switch"
chmod +x "$HOME/bin/java-switch"

profile="$HOME/.profile"
block_start="# JAVA_HOME_START"
block_end="# JAVA_HOME_END"

if ! grep -q "$block_start" "$profile" 2>/dev/null; then
  {
    echo ""
    echo "$block_start"
    echo "export JAVA_HOME=\"$JAVA_HOME_BASE/current\""
    echo "export PATH=\"\$JAVA_HOME/bin:\$PATH\""
    echo "$block_end"
  } >> "$profile"
fi

bin_block_start="# BIN_HOME_START"
bin_block_end="# BIN_HOME_END"
if ! grep -q "$bin_block_start" "$profile" 2>/dev/null; then
  {
    echo ""
    echo "$bin_block_start"
    echo "export PATH=\"\$HOME/bin:\$PATH\""
    echo "$bin_block_end"
  } >> "$profile"
fi

if ! grep -q "$bin_block_start" "$HOME/.zshrc" 2>/dev/null; then
  {
    echo ""
    echo "$bin_block_start"
    echo "export PATH=\"\$HOME/bin:\$PATH\""
    echo "$bin_block_end"
  } >> "$HOME/.zshrc"
fi

echo "Java installed in ${JAVA_HOME_BASE}/${JAVA_MAJOR}-aws and ${JAVA_HOME_BASE}/latest-aws"
echo
echo "=== README ==="
cat "$script_dir/README.md"
