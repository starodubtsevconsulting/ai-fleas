#!/usr/bin/env bash
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/../_runtime/profile" && pwd -P)/command-profile.guard.sh"
ai_command_require_profile "commit" || exit $?

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
COMMANDS_ROOT="${AI_COMMANDS_ROOT:-$(cd "$SCRIPT_DIR/.." && pwd -P)}"
POMODORO_PRELUDE_SH="$SCRIPT_DIR/../pomodoro/pomodoro.prelude.sh"
if [[ -x "$POMODORO_PRELUDE_SH" ]]; then
  "$POMODORO_PRELUDE_SH" || true
fi

SDD_GUARD_SH="$COMMANDS_ROOT/sdd/sdd.command-guard.sh"
if [[ -x "$SDD_GUARD_SH" ]]; then
  "$SDD_GUARD_SH" --staged-only
fi

# No automation for this command yet; see the .command.md file.
exit 0
