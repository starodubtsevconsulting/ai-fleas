#!/usr/bin/env bash
set -euo pipefail

PYTHON_SERIES="3.12"
PYTHON_HOME="$HOME/python"
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root_dir="$(cd "$script_dir/.." && pwd)"
# shellcheck disable=SC1091
source "$root_dir/scripts/report-log.sh"

if ! "$script_dir/../scripts/confirm-reinstall.sh" "Python" "test -x \"$HOME/python/current/bin/python3\""; then
  exit 0
fi

matrix_file="$script_dir/../v_matrix.json"
if [ -f "$matrix_file" ] && command -v python3 >/dev/null 2>&1; then
  codename="$(. /etc/os-release && echo "$VERSION_CODENAME")"
  series_from_matrix="$(python3 - "$matrix_file" "$codename" <<'PY'
import json
import sys

path = sys.argv[1]
codename = sys.argv[2]

with open(path, "r", encoding="utf-8") as fh:
    data = json.load(fh)

series = data.get("default_python_series")
for entry in data.get("ubuntu_to_python", []):
    if entry.get("codename") == codename and entry.get("recommended_python"):
        series = entry["recommended_python"]
        break

selected = None
for entry in data.get("ubuntu_to_python", []):
    if entry.get("selected"):
        selected = entry.get("codename")
        break

if series:
    print(series)
if selected:
    print("SELECTED=" + selected)
PY
)"
  if [ -n "$series_from_matrix" ]; then
    series_line="$(printf "%s\n" "$series_from_matrix" | head -n1)"
    selected_line="$(printf "%s\n" "$series_from_matrix" | tail -n1)"
    if [ -n "$series_line" ]; then
      PYTHON_SERIES="$series_line"
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
  fi
else
  echo "Matrix check: SKIPPED - v_matrix.json missing or python3 not available."
fi

cleanup() {
  if [ -n "${WORKDIR:-}" ] && [ -d "$WORKDIR" ]; then
    rm -rf "$WORKDIR"
  fi
}
trap cleanup EXIT
report_log_init "python/install.sh" "$root_dir"

WORKDIR="$(mktemp -d)"

# Build dependencies for Python from source
bash "$script_dir/../scripts/apt-update.sh"
sudo apt install -y \
  build-essential \
  ca-certificates \
  curl \
  libbz2-dev \
  libffi-dev \
  liblzma-dev \
  libncursesw5-dev \
  libreadline-dev \
  libsqlite3-dev \
  libssl-dev \
  tk-dev \
  uuid-dev \
  xz-utils \
  zlib1g-dev

latest_version="$(curl -fsSL https://www.python.org/ftp/python/ | \
  grep -oE "${PYTHON_SERIES}\\.([0-9]+)" | sort -V | tail -n1)"
latest_version="${latest_version//$'\r'/}"

if [ -z "$latest_version" ]; then
  echo "Failed to detect latest Python ${PYTHON_SERIES}.x version"
  exit 1
fi

tarball="Python-${latest_version}.tgz"
url="https://www.python.org/ftp/python/${latest_version}/${tarball}"

mkdir -p "$PYTHON_HOME"
cd "$WORKDIR"

if ! curl -Ifs "$url" >/dev/null 2>&1; then
  echo "Python tarball not found at:"
  echo "  $url"
  exit 1
fi

curl -fsSLo "$tarball" "$url"
tar -xzf "$tarball"

cd "Python-${latest_version}"
./configure --prefix="${PYTHON_HOME}/${latest_version}" --enable-optimizations
make -j"$(nproc)"
make install

ln -sfn "${PYTHON_HOME}/${latest_version}" "${PYTHON_HOME}/current"
ln -sfn "${PYTHON_HOME}/${latest_version}" "${PYTHON_HOME}/${PYTHON_SERIES}"

"${PYTHON_HOME}/current/bin/python3" -m ensurepip --upgrade

ln -sfn "${PYTHON_HOME}/current/bin/python3" "${PYTHON_HOME}/current/bin/python"
if [ -x "${PYTHON_HOME}/current/bin/pip3" ]; then
  ln -sfn "${PYTHON_HOME}/current/bin/pip3" "${PYTHON_HOME}/current/bin/pip"
fi

# Keep a copy in ~/python and expose a global helper
cp "$script_dir/switch.sh" "$PYTHON_HOME/switch.sh"
chmod +x "$PYTHON_HOME/switch.sh"

mkdir -p "$HOME/bin"
ln -sfn "$PYTHON_HOME/switch.sh" "$HOME/bin/python-switch"
chmod +x "$HOME/bin/python-switch"

profile="$HOME/.profile"
block_start="# PYTHON_HOME_START"
block_end="# PYTHON_HOME_END"

if ! grep -q "$block_start" "$profile" 2>/dev/null; then
  {
    echo ""
    echo "$block_start"
    echo "export PYTHON_HOME=\"$PYTHON_HOME\""
    echo "export PATH=\"\$PYTHON_HOME/current/bin:\$PATH\""
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

echo "Python ${latest_version} installed in ${PYTHON_HOME}/${latest_version}"
echo
echo "=== README ==="
cat "$script_dir/README.md"
