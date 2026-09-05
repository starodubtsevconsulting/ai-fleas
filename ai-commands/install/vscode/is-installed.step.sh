#!/usr/bin/env bash
set -euo pipefail

if [ -x "$HOME/vscode/bin/code" ] || [ -x "$HOME/vscode/code" ]; then
  exit 0
fi

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
bash "$script_dir/../scripts/is-installed.step.sh" --cmd code
