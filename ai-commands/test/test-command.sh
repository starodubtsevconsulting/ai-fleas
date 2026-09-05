#!/usr/bin/env bash
set -euo pipefail

AI_FLOW_PROJECT_DIR="${AI_FLOW_PROJECT_DIR:-}"
AI_FLOW_OUTPUT_DIR="${AI_FLOW_OUTPUT_DIR:-}"

ai_flow_args=()
while [ $# -gt 0 ]; do
  case "$1" in
    --project-dir)
      if [ $# -lt 2 ]; then
        echo "Missing value for --project-dir" >&2
        exit 2
      fi
      AI_FLOW_PROJECT_DIR="$2"
      shift 2
      ;;
    --output-dir)
      if [ $# -lt 2 ]; then
        echo "Missing value for --output-dir" >&2
        exit 2
      fi
      AI_FLOW_OUTPUT_DIR="$2"
      shift 2
      ;;
    --)
      shift
      break
      ;;
    *)
      ai_flow_args+=("$1")
      shift
      ;;
  esac
done
if [ $# -gt 0 ]; then
  ai_flow_args+=("$@")
fi
set -- "${ai_flow_args[@]}"
export AI_FLOW_PROJECT_DIR AI_FLOW_OUTPUT_DIR


SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
if [ -n "${AI_FLOW_PROJECT_DIR:-}" ]; then
  PROJECT_ROOT="$AI_FLOW_PROJECT_DIR"
fi
CONF_FILE="$SCRIPT_DIR/test.command.conf"

if [ -f "$CONF_FILE" ]; then
  # shellcheck source=/dev/null
  source "$CONF_FILE"
fi

MODULE_DIR="${1:-${DEFAULT_MODULE_DIR:-}}"
TEST_ID="${2:-${DEFAULT_TEST_ID:-}}"

resolve_module_dir() {
  if [ -n "$MODULE_DIR" ]; then
    return 0
  fi

  if [ -f "$PROJECT_ROOT/pom.xml" ]; then
    MODULE_DIR="$PROJECT_ROOT"
    return 0
  fi

  mapfile -t pom_files < <(find "$PROJECT_ROOT" -maxdepth 4 -name pom.xml)
  if [ "${#pom_files[@]}" -eq 1 ]; then
    MODULE_DIR="$(dirname "${pom_files[0]}")"
    return 0
  fi

  if [ "${#pom_files[@]}" -eq 0 ]; then
    echo "No pom.xml found under $PROJECT_ROOT; provide <module_dir>." >&2
    exit 1
  fi

  echo "Multiple pom.xml files found; provide <module_dir>:" >&2
  printf '  - %s\n' "${pom_files[@]}" >&2
  exit 1
}

resolve_module_dir

if [ -z "$MODULE_DIR" ] || [ -z "$TEST_ID" ]; then
  echo "Usage: $0 <module_dir> <test_id>" >&2
  exit 1
fi

MAVEN_CMD="${MAVEN_CMD:-mvn}"
LOG_DIR="${AI_FLOW_OUTPUT_DIR:-/tmp}"
if [ -n "${AI_FLOW_OUTPUT_DIR:-}" ]; then
  mkdir -p "$LOG_DIR"
fi
rm -f "$LOG_DIR/test-command."*.log
LOG_FILE="$(mktemp "$LOG_DIR/test-command.XXXXXX.log")"

run_test() {
  if [ -d "$PROJECT_ROOT/$MODULE_DIR" ]; then
    cd "$PROJECT_ROOT/$MODULE_DIR"
  else
    cd "$MODULE_DIR"
  fi

  "$MAVEN_CMD" -q -Dtest="$TEST_ID" test ${MAVEN_ARGS:-} >"$LOG_FILE" 2>&1
}

if run_test; then
  echo "PASS: $TEST_ID ($MODULE_DIR)"
  rm -f "$LOG_FILE"
else
  echo "FAIL: $TEST_ID ($MODULE_DIR)"
  if [ "${SHOW_LOG:-0}" = "1" ]; then
    cat "$LOG_FILE"
  else
    echo "Log: $LOG_FILE"
  fi
  exit 1
fi
