#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root_dir="$(cd "$script_dir/.." && pwd)"
# shellcheck disable=SC1091
source "$root_dir/scripts/report-log.sh"
report_log_init "zed/install.sh" "$root_dir"
if ! "$script_dir/../scripts/confirm-reinstall.sh" "Zed" "command -v zed || test -x \"$HOME/.local/bin/zed\""; then
  exit 0
fi

if ! command -v curl >/dev/null 2>&1; then
  bash "$script_dir/../scripts/apt-update.sh"
  sudo apt install -y curl
fi

# Install Zed using the official installer script.
curl -f https://zed.dev/install.sh | sh

if ! grep -q "# LOCAL_BIN_START" "$HOME/.profile" 2>/dev/null; then
  {
    echo ""
    echo "# LOCAL_BIN_START"
    echo "export PATH=\"\$HOME/.local/bin:\$PATH\""
    echo "# LOCAL_BIN_END"
  } >> "$HOME/.profile"
fi
if ! grep -q "# LOCAL_BIN_START" "$HOME/.zshrc" 2>/dev/null; then
  {
    echo ""
    echo "# LOCAL_BIN_START"
    echo "export PATH=\"\$HOME/.local/bin:\$PATH\""
    echo "# LOCAL_BIN_END"
  } >> "$HOME/.zshrc"
fi

echo "Zed installed. Launch with: zed"
echo
echo "=== README ==="
cat "$script_dir/README.md"
