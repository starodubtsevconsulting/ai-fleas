#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_DIR="${SHOW_CONTEXT_VENV:-$SCRIPT_DIR/.venv}"

command -v python3 >/dev/null 2>&1 || {
  echo 'show-context requires Python 3.' >&2
  exit 1
}

python3 -m venv "$VENV_DIR"
"$VENV_DIR/bin/python" -m pip install -r "$SCRIPT_DIR/requirements.txt"

echo "show-context dependencies installed in: $VENV_DIR"
