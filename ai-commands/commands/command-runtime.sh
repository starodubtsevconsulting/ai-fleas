#!/usr/bin/env bash
set -euo pipefail

# Shared AI Commands runtime guard.
# Usage: ai_command_require_runnable /path/to/version.json

ai_command_read_json_string() {
  local file="$1"
  local key="$2"
  sed -nE 's/^[[:space:]]*"'"$key"'"[[:space:]]*:[[:space:]]*"([^"]*)".*/\1/p' "$file" | head -n 1
}

ai_command_require_runnable() {
  local version_file="$1"

  if [[ ! -f "$version_file" ]]; then
    echo "ERROR: command version metadata is missing: $version_file" >&2
    return 2
  fi

  local version stage
  version="$(ai_command_read_json_string "$version_file" version)"
  stage="$(ai_command_read_json_string "$version_file" stage)"

  if [[ -z "$version" ]]; then
    echo "ERROR: command version is missing." >&2
    return 2
  fi

  printf 'Command version: %s' "$version"
  [[ -n "$stage" ]] && printf ' [%s]' "$stage"
  printf '\n'

  # SNAPSHOT means actively under development and intentionally non-runnable.
  if [[ "$version" == *-SNAPSHOT || "$version" == *-snapshot ]]; then
    echo "NOT READY: this command is a SNAPSHOT and cannot be executed." >&2
    return 3
  fi

  return 0
}
