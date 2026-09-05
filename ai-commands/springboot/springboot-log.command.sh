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

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
CONF_FILE="$SCRIPT_DIR/springboot.command.conf"
if [[ -f "$CONF_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$CONF_FILE"
fi

LOG_FILE=""
TAIL_LINES="${TAIL_LINES:-200}"
WATCH="${WATCH:-0}"
INTERVAL_SEC="${INTERVAL_SEC:-30}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --log) LOG_FILE="$2"; shift 2;;
    --tail) TAIL_LINES="$2"; shift 2;;
    --watch) WATCH=1; shift;;
    --interval) INTERVAL_SEC="$2"; shift 2;;
    *) echo "Unknown arg: $1" >&2; exit 1;;
  esac
done

REPO_DIR="${AI_FLOW_PROJECT_DIR:-$PWD}"

find_project_root() {
  local dir="$1"
  while [[ -n "$dir" && "$dir" != "/" ]]; do
    if [[ -f "$dir/app-config.json" || -d "$dir/.git" ]]; then
      echo "$dir"
      return 0
    fi
    dir="$(dirname "$dir")"
  done
  echo ""
}

PROJECT_ROOT=""
if [[ -n "$AI_FLOW_PROJECT_DIR" ]]; then
  PROJECT_ROOT="$AI_FLOW_PROJECT_DIR"
else
  PROJECT_ROOT="$(find_project_root "$REPO_DIR")"
fi

if [[ -n "$AI_FLOW_OUTPUT_DIR" ]]; then
  OUTPUT_BASE="$AI_FLOW_OUTPUT_DIR"
elif [[ -n "$PROJECT_ROOT" ]]; then
  OUTPUT_BASE="$PROJECT_ROOT/.ai"
else
  OUTPUT_BASE="$SCRIPT_DIR/reports"
fi
LOG_DIR="$OUTPUT_BASE/springboot"

resolve_log() {
  if [[ -z "$LOG_FILE" ]]; then
    if [[ ! -d "$LOG_DIR" ]]; then
      echo "No log directory found: $LOG_DIR" >&2
      exit 1
    fi
    LOG_FILE=$(ls -1t "$LOG_DIR"/*.log 2>/dev/null | head -n 1 || true)
  fi

  if [[ -z "$LOG_FILE" || ! -f "$LOG_FILE" ]]; then
    echo "No log file found. Provide --log <path>." >&2
    exit 1
  fi
}

status_once() {
  local pid_file pid running started_line error_line status

  pid_file="$LOG_FILE.pid"
  pid=""
  if [[ -f "$pid_file" ]]; then
    pid=$(cat "$pid_file" 2>/dev/null || true)
  fi

  running="unknown"
  if [[ -n "$pid" ]]; then
    if kill -0 "$pid" 2>/dev/null; then
      running="yes"
    else
      running="no"
    fi
  fi

  # Spring Boot success line looks like: "Started FooApplication in 3.456 seconds"
  started_line=$(rg -n "\bStarted\s+\S+\s+in\s+[0-9.]+\s+seconds" "$LOG_FILE" | tail -n 1 || true)
  error_line=$(rg -n "(Exception|ERROR|Caused by:)" "$LOG_FILE" | tail -n 1 || true)

  status="UNKNOWN"
  if [[ -n "$started_line" && -z "$error_line" && "$running" == "yes" ]]; then
    status="SUCCESS"
  elif [[ -n "$error_line" || "$running" == "no" ]]; then
    status="FAILURE"
  elif [[ "$running" == "yes" ]]; then
    status="STARTING"
  fi

  echo "Log: $LOG_FILE"
  if [[ -n "$pid" ]]; then
    echo "PID: $pid (running: $running)"
  fi
  echo "Status: $status"
  if [[ -n "$started_line" ]]; then
    echo "Started line: $started_line"
  fi
  if [[ -n "$error_line" ]]; then
    echo "Error line: $error_line"
  fi
  echo "--- tail ($TAIL_LINES) ---"
  tail -n "$TAIL_LINES" "$LOG_FILE"

  if [[ "$status" == "SUCCESS" || "$status" == "FAILURE" ]]; then
    return 0
  fi
  return 1
}

resolve_log

if [[ "$WATCH" == "1" ]]; then
  while true; do
    if status_once; then
      exit 0
    fi
    echo "--- waiting ${INTERVAL_SEC}s ---"
    sleep "$INTERVAL_SEC"
  done
else
  status_once
fi
