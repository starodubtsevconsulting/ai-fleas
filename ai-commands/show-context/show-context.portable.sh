#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_DIR="${SHOW_CONTEXT_VENV:-$SCRIPT_DIR/.venv}"

if [[ -x "$VENV_DIR/bin/python" ]]; then
  PYTHON_BIN="$VENV_DIR/bin/python"
elif command -v python3 >/dev/null 2>&1; then
  PYTHON_BIN="$(command -v python3)"
  echo 'show-context: optional highlighting dependencies are not installed; run ./install.sh for reproducible styling.' >&2
else
  echo 'show-context requires Python 3. Install it, then run ./install.sh.' >&2
  exit 1
fi

exec "$PYTHON_BIN" "$SCRIPT_DIR/show-context.py" "$@"
