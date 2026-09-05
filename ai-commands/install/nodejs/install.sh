#!/usr/bin/env bash
set -euo pipefail

NODE_MAJOR="22"
NODE_HOME="$HOME/node"
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root_dir="$(cd "$script_dir/.." && pwd)"
# shellcheck disable=SC1091
source "$root_dir/scripts/report-log.sh"
matrix_file="$script_dir/../v_matrix.json"

if [ -f "$matrix_file" ] && command -v python3 >/dev/null 2>&1; then
  codename="$(. /etc/os-release && echo "$VERSION_CODENAME")"
  matrix_out="$(python3 - "$matrix_file" "$codename" <<'PY'
import json
import sys

path = sys.argv[1]
codename = sys.argv[2]

with open(path, "r", encoding="utf-8") as fh:
    data = json.load(fh)

major = data.get("default_node_major")
selected = None
for entry in data.get("ubuntu_to_node", []):
    if entry.get("codename") == codename and entry.get("recommended_major"):
        major = entry["recommended_major"]
        break

for entry in data.get("ubuntu_to_node", []):
    if entry.get("selected"):
        selected = entry.get("codename")
        break

install_latest = data.get("install_latest_node", False)

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
      NODE_MAJOR="$major_line"
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
      install_latest_node="${install_line#INSTALL_LATEST=}"
    fi
  fi
else
  echo "Matrix check: SKIPPED - v_matrix.json missing or python3 not available."
fi

if ! "$script_dir/../scripts/confirm-reinstall.sh" "Node.js" "test -x \"$NODE_HOME/current/bin/node\""; then
  exit 0
fi

arch="$(uname -m)"
case "$arch" in
  x86_64)
    node_arch="x64"
    ;;
  aarch64|arm64)
    node_arch="arm64"
    ;;
  *)
    echo "Unsupported architecture: $arch"
    exit 1
    ;;
 esac

cleanup() {
  if [ -n "${WORKDIR:-}" ] && [ -d "$WORKDIR" ]; then
    rm -rf "$WORKDIR"
  fi
}
trap cleanup EXIT
report_log_init "nodejs/install.sh" "$root_dir"

WORKDIR="$(mktemp -d)"

fetch_latest_for_major() {
  python3 - "$1" <<'PY'
import json
import sys
import urllib.request

major = sys.argv[1]
with urllib.request.urlopen("https://nodejs.org/dist/index.json") as resp:
    data = json.load(resp)

for entry in data:
    ver = entry.get("version", "").lstrip("v")
    if ver.startswith(major + "."):
        print(ver)
        break
PY
}

fetch_latest_major() {
  python3 - <<'PY'
import json
import urllib.request

with urllib.request.urlopen("https://nodejs.org/dist/index.json") as resp:
    data = json.load(resp)

for entry in data:
    ver = entry.get("version", "").lstrip("v")
    if ver:
        print(ver.split(".")[0])
        break
PY
}

# Find latest Node.js for the selected major
latest_version="$(fetch_latest_for_major "$NODE_MAJOR")"
latest_major="$(fetch_latest_major)"

if [ -z "$latest_version" ]; then
  echo "Failed to detect latest Node.js ${NODE_MAJOR}.x version"
  exit 1
fi

install_node_version() {
  local version="$1"
  local major="$2"
  local tar="node-v${version}-linux-${node_arch}.tar.xz"
  local download="https://nodejs.org/dist/v${version}/${tar}"
  local extracted="node-v${version}-linux-${node_arch}"

  cd "$WORKDIR"
  curl -fsSLO "$download"
  tar -xJf "$tar"

  if [ ! -d "$extracted" ]; then
    echo "Failed to extract Node.js ${version}"
    exit 1
  fi

  rm -rf "$NODE_HOME/${version}"
  mv "$extracted" "$NODE_HOME/${version}"
  ln -sfn "$NODE_HOME/${version}" "$NODE_HOME/${major}"
  rm -f "$tar"
}

mkdir -p "$NODE_HOME"
install_node_version "$latest_version" "$NODE_MAJOR"

if [ "${install_latest_node:-false}" = "True" ] || [ "${install_latest_node:-false}" = "true" ]; then
  if [ -n "$latest_major" ] && [ "$latest_major" != "$NODE_MAJOR" ]; then
    latest_major_version="$(fetch_latest_for_major "$latest_major")"
    if [ -n "$latest_major_version" ]; then
      install_node_version "$latest_major_version" "latest"
    fi
  else
    ln -sfn "$NODE_HOME/${latest_version}" "$NODE_HOME/latest"
  fi
fi

ln -sfn "$NODE_HOME/${latest_version}" "$NODE_HOME/current"

# Keep a copy in ~/node and expose a global helper
cp "$script_dir/switch.sh" "$NODE_HOME/switch.sh"
chmod +x "$NODE_HOME/switch.sh"

mkdir -p "$HOME/bin"
ln -sfn "$NODE_HOME/switch.sh" "$HOME/bin/node-switch"
chmod +x "$HOME/bin/node-switch"

add_path_block() {
  local file="$1"
  local node_start="# NODE_HOME_START"
  local node_end="# NODE_HOME_END"
  local bin_start="# BIN_HOME_START"
  local bin_end="# BIN_HOME_END"

  if ! grep -q "$node_start" "$file" 2>/dev/null; then
    {
      echo ""
      echo "$node_start"
      echo "export NODE_HOME=\"$NODE_HOME\""
      echo "export PATH=\"\$NODE_HOME/current/bin:\$PATH\""
      echo "$node_end"
    } >> "$file"
  fi

  if ! grep -q "$bin_start" "$file" 2>/dev/null; then
    {
      echo ""
      echo "$bin_start"
      echo "export PATH=\"\$HOME/bin:\$PATH\""
      echo "$bin_end"
    } >> "$file"
  fi
}

add_path_block "$HOME/.profile"
add_path_block "$HOME/.zshrc"

echo "Node.js ${latest_version} installed in ${NODE_HOME}/${latest_version}"
echo
echo "=== README ==="
cat "$script_dir/README.md"
