#!/usr/bin/env bash
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/../_runtime/profile" && pwd -P)/command-profile.guard.sh"
ai_command_require_profile "test" || exit $?
set -euo pipefail

AI_FLOW_PROJECT_DIR="${AI_FLOW_PROJECT_DIR:-}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
POMODORO_PRELUDE_SH="$SCRIPT_DIR/../pomodoro/pomodoro.prelude.sh"
if [[ -x "$POMODORO_PRELUDE_SH" ]]; then
  "$POMODORO_PRELUDE_SH" || true
fi

PROJECT_DIR="$AI_FLOW_PROJECT_DIR"
PROJECT_NAME=""
TEST_FILE=""
TEST_NAME=""
BASE_REF=""
HEAD_REF=""
RUN_LIST=0
RUN_AFFECTED=0
RUN_E2E_DEV=0
GREP_PATTERN=""
TEST_TIMEOUT_SEC="${AI_FLOW_TEST_TIMEOUT_SEC:-10}"

extra_args=()
while [ $# -gt 0 ]; do
  case "$1" in
    --project-dir)
      if [ $# -lt 2 ]; then
        echo "Missing value for --project-dir" >&2
        exit 2
      fi
      PROJECT_DIR="$2"
      shift 2
      ;;
    --project)
      if [ $# -lt 2 ]; then
        echo "Missing value for --project" >&2
        exit 2
      fi
      PROJECT_NAME="$2"
      shift 2
      ;;
    --file)
      if [ $# -lt 2 ]; then
        echo "Missing value for --file" >&2
        exit 2
      fi
      TEST_FILE="$2"
      shift 2
      ;;
    --name)
      if [ $# -lt 2 ]; then
        echo "Missing value for --name" >&2
        exit 2
      fi
      TEST_NAME="$2"
      shift 2
      ;;
    --base)
      if [ $# -lt 2 ]; then
        echo "Missing value for --base" >&2
        exit 2
      fi
      BASE_REF="$2"
      shift 2
      ;;
    --head)
      if [ $# -lt 2 ]; then
        echo "Missing value for --head" >&2
        exit 2
      fi
      HEAD_REF="$2"
      shift 2
      ;;
    --list)
      RUN_LIST=1
      shift
      ;;
    --affected)
      RUN_AFFECTED=1
      shift
      ;;
    --e2e-dev)
      RUN_E2E_DEV=1
      shift
      ;;
    --grep)
      if [ $# -lt 2 ]; then
        echo "Missing value for --grep" >&2
        exit 2
      fi
      GREP_PATTERN="$2"
      shift 2
      ;;
    --)
      shift
      break
      ;;
    *)
      extra_args+=("$1")
      shift
      ;;
  esac
done
if [ $# -gt 0 ]; then
  extra_args+=("$@")
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GUIDE_GENERIC="$SCRIPT_DIR/test.command.md"
GUIDE_NX="$SCRIPT_DIR/test.command-nx.md"

if [ -z "$PROJECT_DIR" ]; then
  PROJECT_DIR="$(pwd)"
fi

if [ ! -d "$PROJECT_DIR" ]; then
  echo "Project dir not found: $PROJECT_DIR" >&2
  exit 1
fi

cd "$PROJECT_DIR"

TIMEOUT_BIN=""
if command -v timeout >/dev/null 2>&1; then
  TIMEOUT_BIN="timeout"
elif command -v gtimeout >/dev/null 2>&1; then
  TIMEOUT_BIN="gtimeout"
fi

run_with_timeout() {
  if [ -z "$TIMEOUT_BIN" ]; then
    echo "Refusing to run tests: no timeout utility found (install coreutils or run locally)." >&2
    exit 3
  fi
  if ! [[ "$TEST_TIMEOUT_SEC" =~ ^[0-9]+$ ]] || [ "$TEST_TIMEOUT_SEC" -le 0 ]; then
    echo "Invalid AI_FLOW_TEST_TIMEOUT_SEC: '$TEST_TIMEOUT_SEC' (must be positive integer seconds)." >&2
    exit 2
  fi
  set +e
  "$TIMEOUT_BIN" "${TEST_TIMEOUT_SEC}s" "$@"
  local status=$?
  set -e
  if [ "$status" -eq 124 ] || [ "$status" -eq 137 ]; then
    echo "Test run exceeded ${TEST_TIMEOUT_SEC}s and was stopped by /test command." >&2
  fi
  return "$status"
}

if [ "$RUN_LIST" -eq 1 ]; then
  exec npx nx show projects
fi

if [ "$RUN_E2E_DEV" -eq 1 ]; then
  if [ -f package.json ] && node -e "const p=require('./package.json'); process.exit(p.scripts && p.scripts['e2e:dev'] ? 0 : 1)"; then
    npm run e2e:dev:cleanup
    cmd=(npm run e2e:dev)
    if [ -n "$GREP_PATTERN" ]; then
      cmd+=(-- --grep "$GREP_PATTERN")
    elif [ ${#extra_args[@]} -gt 0 ]; then
      cmd+=(-- "${extra_args[@]}")
    fi
    run_with_timeout "${cmd[@]}"
    exit $?
  fi
  echo "Project does not expose npm script e2e:dev: $PROJECT_DIR" >&2
  exit 2
fi

if [ "$RUN_AFFECTED" -eq 1 ]; then
  cmd=(npx nx affected -t test --runInBand --bail --verbose)
  if [ -n "$BASE_REF" ]; then
    cmd+=(--base "$BASE_REF")
  fi
  if [ -n "$HEAD_REF" ]; then
    cmd+=(--head "$HEAD_REF")
  fi
  if [ ${#extra_args[@]} -gt 0 ]; then
    cmd+=("${extra_args[@]}")
  fi
  run_with_timeout "${cmd[@]}"
  exit $?
fi

if [ -n "$PROJECT_NAME" ]; then
  cmd=(npx nx test "$PROJECT_NAME" --runInBand --bail --verbose)
  if [ -n "$TEST_FILE" ]; then
    cmd+=(--testFile="$TEST_FILE")
  fi
  if [ -n "$TEST_NAME" ]; then
    cmd+=(--testNamePattern="$TEST_NAME")
  fi
  if [ ${#extra_args[@]} -gt 0 ]; then
    cmd+=("${extra_args[@]}")
  fi
  run_with_timeout "${cmd[@]}"
  exit $?
fi

if [ -f "$GUIDE_NX" ]; then
  cat "$GUIDE_NX"
else
  cat "$GUIDE_GENERIC"
fi
