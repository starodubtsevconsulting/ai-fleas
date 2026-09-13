#!/usr/bin/env bash
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/../_runtime/profile" && pwd -P)/command-profile.guard.sh"
ai_command_require_profile "test" || exit $?
set -euo pipefail

PROJECT_DIR="$(pwd)"
MODULE_DIR=""
LOG_FILE=""
TAIL_LINES="${TAIL_LINES:-80}"
REPORT_GLOB="${REPORT_GLOB:-}"
SHOW_REPORT_LINES="${SHOW_REPORT_LINES:-120}"

usage() {
  cat <<'USAGE'
Usage:
  java-maven-cheap.command.sh --module-dir <module-dir> [options] -- <maven command...>

Options:
  --project-dir <dir>      Project root (default: current directory)
  --module-dir <dir>       Maven module directory where pom.xml exists
  --log-file <path>        Explicit log file path (default: /tmp/java-maven-cheap.<pid>.log)
  --tail-lines <n>         Number of trailing log lines to print on failure (default: 80)
  --report-glob <pattern>  Optional report filename glob to narrow report snippets
  --report-lines <n>       Number of lines to print from matching report files (default: 120)
  -h, --help               Show this help

Example:
  ${AI_COMMANDS_ROOT}/test/java-maven-cheap.command.sh \
    --module-dir example-module \
    --report-glob '*ExampleTest*' \
    -- mvn -q -Dtest=ExampleTest test
USAGE
}

while [ $# -gt 0 ]; do
  case "$1" in
    --project-dir)
      PROJECT_DIR="$2"
      shift 2
      ;;
    --module-dir)
      MODULE_DIR="$2"
      shift 2
      ;;
    --log-file)
      LOG_FILE="$2"
      shift 2
      ;;
    --tail-lines)
      TAIL_LINES="$2"
      shift 2
      ;;
    --report-glob)
      REPORT_GLOB="$2"
      shift 2
      ;;
    --report-lines)
      SHOW_REPORT_LINES="$2"
      shift 2
      ;;
    --)
      shift
      break
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown arg: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

if [ -z "$MODULE_DIR" ]; then
  echo "--module-dir is required" >&2
  exit 2
fi

if [ $# -eq 0 ]; then
  echo "Missing Maven command after --" >&2
  exit 2
fi

if ! [[ "$TAIL_LINES" =~ ^[0-9]+$ ]] || [ "$TAIL_LINES" -lt 1 ]; then
  echo "--tail-lines must be a positive integer" >&2
  exit 2
fi

if ! [[ "$SHOW_REPORT_LINES" =~ ^[0-9]+$ ]] || [ "$SHOW_REPORT_LINES" -lt 1 ]; then
  echo "--report-lines must be a positive integer" >&2
  exit 2
fi

MODULE_PATH="$PROJECT_DIR/$MODULE_DIR"
if [ ! -d "$MODULE_PATH" ] || [ ! -f "$MODULE_PATH/pom.xml" ]; then
  echo "Invalid module dir: $MODULE_PATH (pom.xml not found)" >&2
  exit 1
fi

if [ -z "$LOG_FILE" ]; then
  LOG_FILE="/tmp/java-maven-cheap.$$.$(date +%Y%m%dT%H%M%S).log"
fi

mkdir -p "$(dirname "$LOG_FILE")"

print_report_snippets() {
  local reports_found=0
  local report_dirs=(
    "$MODULE_PATH/target/surefire-reports"
    "$MODULE_PATH/target/failsafe-reports"
  )

  local dir file
  for dir in "${report_dirs[@]}"; do
    [ -d "$dir" ] || continue
    while IFS= read -r -d '' file; do
      reports_found=1
      printf '\n=== Report: %s ===\n' "$file"
      sed -n "1,${SHOW_REPORT_LINES}p" "$file"
    done < <(
      if [ -n "$REPORT_GLOB" ]; then
        find "$dir" -maxdepth 1 -type f -name "$REPORT_GLOB" -print0 2>/dev/null
      else
        find "$dir" -maxdepth 1 -type f \( -name '*.txt' -o -name '*.xml' \) -print0 2>/dev/null
      fi
    )
  done

  if [ "$reports_found" -eq 0 ]; then
    printf '\nNo matching Surefire/Failsafe report files found.\n'
  fi
}

cd "$MODULE_PATH"

printf 'Running in %s\n' "$MODULE_PATH"
printf 'Full log: %s\n' "$LOG_FILE"
printf 'Command:'
for arg in "$@"; do
  printf ' %q' "$arg"
done
printf '\n'

set +e
"$@" >"$LOG_FILE" 2>&1
rc=$?
set -e

printf 'Exit code: %s\n' "$rc"

if [ "$rc" -eq 0 ]; then
  printf 'Result: SUCCESS\n'
  exit 0
fi

printf 'Result: FAILURE\n'
printf '\n=== Log Tail (%s lines) ===\n' "$TAIL_LINES"
tail -n "$TAIL_LINES" "$LOG_FILE" || true

print_report_snippets

exit "$rc"
