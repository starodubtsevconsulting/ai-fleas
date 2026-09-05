#!/usr/bin/env bash
# Shared Python bootstrap for AI commands.
# Source this file, then call Python through: command_python ...

COMMANDS_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
COMMANDS_VENV="${COMMANDS_VENV:-$COMMANDS_DIR/.venv}"
COMMANDS_DEPENDENCIES="${COMMANDS_DEPENDENCIES:-$COMMANDS_DIR/dependencies.txt}"
COMMAND_PYTHON_BIN="${COMMAND_PYTHON_BIN:-$COMMANDS_VENV/bin/python}"

command_python_dependency_stamp() {
  local dep_file combined_stamp=""
  for dep_file in "$COMMANDS_DEPENDENCIES" "${COMMAND_DEPENDENCIES:-}"; do
    if [[ -n "$dep_file" && -f "$dep_file" ]]; then
      combined_stamp+="$(sha256sum "$dep_file")"
    fi
  done
  printf '%s' "$combined_stamp"
}

command_python_bootstrap() {
  local stamp_file combined_stamp

  if [[ ! -f "$COMMANDS_DEPENDENCIES" && ( -z "${COMMAND_DEPENDENCIES:-}" || ! -f "$COMMAND_DEPENDENCIES" ) ]]; then
    COMMAND_PYTHON_BIN="$(command -v python3)"
    return 0
  fi

  if [[ ! -x "$COMMAND_PYTHON_BIN" ]]; then
    python3 -m venv "$COMMANDS_VENV"
  fi

  stamp_file="$COMMANDS_VENV/.dependencies.sha256"
  combined_stamp="$(command_python_dependency_stamp)"
  if [[ ! -f "$stamp_file" || "$(cat "$stamp_file")" != "$combined_stamp" ]]; then
    "$COMMAND_PYTHON_BIN" -m pip install --upgrade pip >/dev/null
    if [[ -f "$COMMANDS_DEPENDENCIES" ]]; then
      "$COMMAND_PYTHON_BIN" -m pip install -r "$COMMANDS_DEPENDENCIES"
    fi
    if [[ -n "${COMMAND_DEPENDENCIES:-}" && -f "$COMMAND_DEPENDENCIES" ]]; then
      "$COMMAND_PYTHON_BIN" -m pip install -r "$COMMAND_DEPENDENCIES"
    fi
    printf '%s' "$combined_stamp" > "$stamp_file"
  fi
}

command_python() {
  command_python_bootstrap
  "$COMMAND_PYTHON_BIN" "$@"
}
