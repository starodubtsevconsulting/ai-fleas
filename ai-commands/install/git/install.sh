#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root_dir="$(cd "$script_dir/.." && pwd)"
# shellcheck disable=SC1091
source "$root_dir/scripts/report-log.sh"
report_log_init "git/install.sh" "$root_dir"
if ! "$script_dir/../scripts/confirm-reinstall.sh" "GitHub CLI" "command -v gh"; then
  exit 0
fi

# Install GitHub CLI
bash "$script_dir/../scripts/apt-update.sh"
sudo apt install -y gh

echo "GitHub CLI installed. Run: gh auth login"
echo
echo "=== README ==="
cat "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/README.md"
