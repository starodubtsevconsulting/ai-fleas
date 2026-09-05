#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  is-installed.step.sh [--all] [checks...]

Checks (repeatable):
  --cmd <name>     Succeeds if command exists in PATH
  --path <path>    Succeeds if path exists and is executable
  --file <path>    Succeeds if file exists
  --dir <path>     Succeeds if directory exists

Semantics:
  By default all checks must pass.
  --all is accepted for readability (same as default).

Exit codes:
  0 - all checks passed
  1 - at least one check failed
USAGE
}

if [ "$#" -eq 0 ]; then
  usage >&2
  exit 2
fi

ok=1

while [ "$#" -gt 0 ]; do
  case "$1" in
    --help|-h)
      usage
      exit 0
      ;;
    --all)
      shift
      ;;
    --cmd)
      shift
      [ "$#" -ge 1 ] || { echo "--cmd requires an argument" >&2; exit 2; }
      if ! command -v "$1" >/dev/null 2>&1; then
        ok=0
      fi
      shift
      ;;
    --path)
      shift
      [ "$#" -ge 1 ] || { echo "--path requires an argument" >&2; exit 2; }
      if ! [ -x "$1" ]; then
        ok=0
      fi
      shift
      ;;
    --file)
      shift
      [ "$#" -ge 1 ] || { echo "--file requires an argument" >&2; exit 2; }
      if ! [ -f "$1" ]; then
        ok=0
      fi
      shift
      ;;
    --dir)
      shift
      [ "$#" -ge 1 ] || { echo "--dir requires an argument" >&2; exit 2; }
      if ! [ -d "$1" ]; then
        ok=0
      fi
      shift
      ;;
    *)
      echo "Unknown arg: $1" >&2
      usage >&2
      exit 2
      ;;
  esac

done

[ "$ok" -eq 1 ]
