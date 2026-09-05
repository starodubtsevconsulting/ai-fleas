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

LOG_FILE=""
PID=""
WAIT_SEC="${WAIT_SEC:-10}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --log) LOG_FILE="$2"; shift 2;;
    --pid) PID="$2"; shift 2;;
    --wait) WAIT_SEC="$2"; shift 2;;
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

if [[ -z "$PID" ]]; then
  if [[ -z "$LOG_FILE" ]]; then
    if [[ ! -d "$LOG_DIR" ]]; then
      echo "No log directory found: $LOG_DIR" >&2
      exit 1
    fi
    LOG_FILE=$(ls -1t "$LOG_DIR"/*.log 2>/dev/null | head -n 1 || true)
  fi

  if [[ -z "$LOG_FILE" || ! -f "$LOG_FILE" ]]; then
    echo "No log file found. Provide --log <path> or --pid <pid>." >&2
    exit 1
  fi

  PID_FILE="$LOG_FILE.pid"
  if [[ -f "$PID_FILE" ]]; then
    PID=$(cat "$PID_FILE" 2>/dev/null || true)
  fi
fi

if [[ -z "$PID" ]]; then
  echo "PID not found. Provide --pid <pid>." >&2
  exit 1
fi

if ! kill -0 "$PID" 2>/dev/null; then
  echo "Process $PID is not running."
  exit 0
fi

echo "Stopping PID: $PID"
kill "$PID" || true

if [[ "$WAIT_SEC" -gt 0 ]]; then
  for _ in $(seq 1 "$WAIT_SEC"); do
    if ! kill -0 "$PID" 2>/dev/null; then
      echo "Stopped."
      exit 0
    fi
    sleep 1
  done
fi

echo "Still running after ${WAIT_SEC}s; sending SIGKILL"
kill -9 "$PID" || true
