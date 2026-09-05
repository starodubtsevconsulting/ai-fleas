#!/bin/bash

set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
COMMANDS_DIR="$SCRIPT_DIR"

if [ $# -lt 1 ]; then
  echo "Usage: read-config.sh <command-name>"
  exit 1
fi

COMMAND_NAME="$1"

DEFAULT_CONF="$COMMANDS_DIR/${COMMAND_NAME}/${COMMAND_NAME}.command-default.config"
EXAMPLE_CONF="$COMMANDS_DIR/${COMMAND_NAME}/${COMMAND_NAME}.command.example.config"
USER_CONF="$COMMANDS_DIR/${COMMAND_NAME}/${COMMAND_NAME}.command.config"

if [ -f "$DEFAULT_CONF" ]; then
  # shellcheck disable=SC1090
  . "$DEFAULT_CONF"
fi

if [ -f "$USER_CONF" ]; then
  # shellcheck disable=SC1090
  . "$USER_CONF"
elif [ ! -f "$DEFAULT_CONF" ] && [ -f "$EXAMPLE_CONF" ]; then
  read -p "No user config for '$COMMAND_NAME'. Create from example? [y/N]: " create_conf
  if [[ "$create_conf" =~ ^[Yy]$ ]]; then
    cp "$EXAMPLE_CONF" "$USER_CONF"
    echo "Created $USER_CONF"
    # shellcheck disable=SC1090
    . "$USER_CONF"
  fi
fi
