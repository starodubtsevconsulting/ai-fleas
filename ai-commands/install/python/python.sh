#!/usr/bin/env bash
set -euo pipefail

PACKAGE_NAME=""
IMPORT_NAME=""
PYTHON_BIN="${PYTHON_BIN:-python3}"
PIP_INSTALL_ARGS=(--user)

while [ $# -gt 0 ]; do
  case "$1" in
    --package)
      PACKAGE_NAME="${2:-}"
      shift 2
      ;;
    --import)
      IMPORT_NAME="${2:-}"
      shift 2
      ;;
    --python)
      PYTHON_BIN="${2:-}"
      shift 2
      ;;
    --system)
      PIP_INSTALL_ARGS=()
      shift
      ;;
    -h|--help)
      cat <<'EOF'
Usage:
  python.sh --package <pip-package> [--import <module>] [--python <python-bin>] [--system]
EOF
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 2
      ;;
  esac
done

if [ -z "$PACKAGE_NAME" ]; then
  echo "Missing --package." >&2
  exit 2
fi
if [ -z "$IMPORT_NAME" ]; then
  IMPORT_NAME="$PACKAGE_NAME"
fi

if ! command -v "$PYTHON_BIN" >/dev/null 2>&1; then
  echo "Python binary not found: $PYTHON_BIN" >&2
  exit 1
fi

if "$PYTHON_BIN" - "$IMPORT_NAME" <<'PY'
import importlib.util
import sys
name = sys.argv[1]
raise SystemExit(0 if importlib.util.find_spec(name) else 1)
PY
then
  echo "Python dependency already available: $IMPORT_NAME"
  exit 0
fi

echo "Installing Python dependency: $PACKAGE_NAME" >&2
"$PYTHON_BIN" -m pip install "${PIP_INSTALL_ARGS[@]}" "$PACKAGE_NAME"

if "$PYTHON_BIN" - "$IMPORT_NAME" <<'PY'
import importlib.util
import sys
name = sys.argv[1]
raise SystemExit(0 if importlib.util.find_spec(name) else 1)
PY
then
  echo "Python dependency installed: $IMPORT_NAME"
  exit 0
fi

echo "Python dependency install completed, but import is still unavailable: $IMPORT_NAME" >&2
exit 1
