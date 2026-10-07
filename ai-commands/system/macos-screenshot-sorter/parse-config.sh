#!/bin/bash
# Parse config file with proper quote handling
# Usage: source parse-config.sh <config_path>

ai_config_path="$1"

if [[ -z "$ai_config_path" ]]; then
  echo "Usage: source parse-config.sh <config_path>" >&2
  return 1
fi

if [[ ! -f "$ai_config_path" ]]; then
  echo "Config file not found: $ai_config_path" >&2
  return 1
fi

while IFS= read -r line || [[ -n "$line" ]]; do
  # Skip empty lines and comments
  [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
  # Skip lines that don't match KEY=VALUE pattern
  [[ "$line" =~ ^[[:space:]]*[A-Za-z_][A-Za-z0-9_]*[[:space:]]*= ]] || continue

  key="${line%%=*}"
  value="${line#*=}"

  # Remove surrounding double quotes if present
  if [[ "$value" == \"*\" ]]; then
    value="${value:1:${#value}-2}"
  # Remove surrounding single quotes if present
  elif [[ "$value" == \'*\' ]]; then
    value="${value:1:${#value}-2}"
  fi

  export "$key=$value"
done < "$ai_config_path"
