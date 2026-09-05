#!/usr/bin/env bash
set -euo pipefail

label="${1-}"
check_cmd="${2-}"

if [ -z "$label" ] || [ -z "$check_cmd" ]; then
  echo "Usage: $0 <label> <check_cmd>"
  exit 2
fi

if bash -c "$check_cmd" >/dev/null 2>&1; then
  if [ -n "${LABEL_DETAIL:-}" ]; then
    echo "$LABEL_DETAIL"
  fi
  printf "%s already installed. Reinstall? [Y/NO]: " "$label"
  read -r choice
  if [ "${choice^^}" != "Y" ]; then
    echo "Skipping."
    exit 1
  fi
fi
