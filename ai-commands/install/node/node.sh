#!/usr/bin/env bash
set -euo pipefail

PACKAGE_NAME=""
PREFIX_DIR="."

while [ $# -gt 0 ]; do
  case "$1" in
    --package)
      PACKAGE_NAME="${2:-}"
      shift 2
      ;;
    --prefix)
      PREFIX_DIR="${2:-}"
      shift 2
      ;;
    -h|--help)
      cat <<'EOF'
Usage:
  node.sh --package <npm-package> [--prefix <install-dir>]
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
if ! command -v node >/dev/null 2>&1; then
  echo "node is required for npm package detection." >&2
  exit 1
fi
if ! command -v npm >/dev/null 2>&1; then
  echo "npm is required for npm package installation." >&2
  exit 1
fi
mkdir -p "$PREFIX_DIR"

if node - "$PREFIX_DIR" "$PACKAGE_NAME" <<'NODE'
const path = require('path');
const prefix = path.resolve(process.argv[2]);
const pkg = process.argv[3];
try {
  require.resolve(pkg, { paths: [prefix] });
  process.exit(0);
} catch (error) {
  process.exit(1);
}
NODE
then
  echo "Node dependency already available: $PACKAGE_NAME"
  exit 0
fi

echo "Installing Node dependency: $PACKAGE_NAME into $PREFIX_DIR" >&2
npm install --prefix "$PREFIX_DIR" "$PACKAGE_NAME"

node - "$PREFIX_DIR" "$PACKAGE_NAME" <<'NODE'
const path = require('path');
const prefix = path.resolve(process.argv[2]);
const pkg = process.argv[3];
require.resolve(pkg, { paths: [prefix] });
NODE

echo "Node dependency installed: $PACKAGE_NAME"
