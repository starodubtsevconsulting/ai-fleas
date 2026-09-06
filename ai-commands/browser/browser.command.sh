#!/usr/bin/env bash
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/../_runtime/profile" && pwd -P)/command-profile.guard.sh"
ai_command_require_profile "browser" || exit $?
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  browser.command.sh [--project-dir <path>] [--output-dir <path>] [--detach|--no-detach] <url1> <url2> ...
  browser.command.sh [--project-dir <path>] [--output-dir <path>] [--detach|--no-detach] --file <path>

Notes:
  - --file expects one URL per line; blank lines and lines starting with # are ignored.
  - Browser processes detach by default so windows stay open after this command exits.
  - Use --no-detach or --foreground when debugging browser launch failures.
USAGE
}

PROJECT_DIR=""
OUTPUT_DIR=""
URL_FILE=""
URLS=()
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
source "$SCRIPT_DIR/../command-python.setup.sh"
CONF_FILE="${BROWSER_COMMAND_CONF:-${AI_COMMAND_CONFIG_PATH:-}}"
BROWSER_CMD=""
BROWSER_ARGS=""
BROWSER_STRICT="true"
BROWSER_DETACH="${BROWSER_DETACH:-true}"

if [[ -n "$CONF_FILE" && -f "$CONF_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$CONF_FILE"
fi

while [[ $# -gt 0 ]]; do
  case "$1" in
    --project-dir)
      PROJECT_DIR="$2"
      export AI_FLOW_PROJECT_DIR="$2"
      shift 2
      ;;
    --output-dir)
      OUTPUT_DIR="$2"
      export AI_FLOW_OUTPUT_DIR="$2"
      shift 2
      ;;
    --file)
      URL_FILE="$2"
      shift 2
      ;;
    --detach)
      BROWSER_DETACH="true"
      shift
      ;;
    --no-detach|--foreground)
      BROWSER_DETACH="false"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      URLS+=("$1")
      shift
      ;;
  esac
 done

if [[ -n "$URL_FILE" ]]; then
  if [[ ! -f "$URL_FILE" ]]; then
    echo "URL file not found: $URL_FILE" >&2
    exit 1
  fi
  while IFS= read -r line; do
    [[ -z "$line" ]] && continue
    [[ "$line" == \#* ]] && continue
    URLS+=("$line")
  done < "$URL_FILE"
fi

if [[ ${#URLS[@]} -eq 0 ]]; then
  usage
  exit 1
fi

normalize_url() {
  local value="$1"
  if [[ "$value" =~ ^[A-Za-z][A-Za-z0-9+.-]*: ]]; then
    printf '%s
' "$value"
    return 0
  fi
  if [[ -e "$value" ]]; then
    command_python - "$value" <<'PYURL'
from pathlib import Path
from urllib.parse import quote
import sys
print("file://" + quote(str(Path(sys.argv[1]).resolve())))
PYURL
    return 0
  fi
  printf '%s
' "$value"
}

NORMALIZED_URLS=()
for url in "${URLS[@]}"; do
  NORMALIZED_URLS+=("$(normalize_url "$url")")
done
URLS=("${NORMALIZED_URLS[@]}")

open_urls() {
  launch_browser() {
    local cmd="$1"
    local pid
    shift
    if [[ "${BROWSER_DETACH:-true}" == "true" ]]; then
      if command -v setsid >/dev/null 2>&1; then
        setsid "$cmd" "$@" >/dev/null 2>&1 < /dev/null &
      else
        nohup "$cmd" "$@" >/dev/null 2>&1 < /dev/null &
      fi
      pid=$!
      sleep "${BROWSER_DETACH_CHECK_DELAY:-0.2}"
      if ! kill -0 "$pid" >/dev/null 2>&1; then
        wait "$pid"
        return $?
      fi
      return 0
    fi
    "$cmd" "$@" >/dev/null 2>&1
  }
  local browser_args=()
  local os
  local configured_ran=0
  local configured_failed=0
  if [[ -n "${BROWSER_ARGS:-}" ]]; then
    # shellcheck disable=SC2206
    browser_args=($BROWSER_ARGS)
  fi

  if [[ -n "${BROWSER_CMD:-}" ]] && command -v "$BROWSER_CMD" >/dev/null 2>&1; then
    configured_ran=1
    launch_browser "$BROWSER_CMD" "${browser_args[@]}" "${URLS[@]}" && return 0
    configured_failed=1
  fi

  if [[ "$configured_ran" -eq 1 && "${BROWSER_STRICT:-true}" == "true" ]]; then
    echo "Configured browser command failed: ${BROWSER_CMD}" >&2
    return 1
  fi

  os="$(uname -s)"

  if [[ "$os" == "Darwin" ]]; then
    if command -v open >/dev/null 2>&1; then
      launch_browser open -a "Google Chrome" "${URLS[@]}" && return 0
      launch_browser open "${URLS[@]}" && return 0
    fi
  fi

  if [[ "$os" == "Linux" ]]; then
    if command -v google-chrome-stable >/dev/null 2>&1; then
      launch_browser google-chrome-stable --new-window "${browser_args[@]}" "${URLS[@]}" && return 0
     fi
     if command -v google-chrome >/dev/null 2>&1; then
       launch_browser google-chrome --new-window "${browser_args[@]}" "${URLS[@]}" && return 0
    fi
    if command -v google-chrome >/dev/null 2>&1; then
      launch_browser google-chrome --new-window "${browser_args[@]}" "${URLS[@]}" && return 0
    fi
    if command -v chromium >/dev/null 2>&1; then
      launch_browser chromium "${browser_args[@]}" "${URLS[@]}" && return 0
    fi
  fi

  for url in "${URLS[@]}"; do
    if command -v gio >/dev/null 2>&1; then
      launch_browser gio open "$url" || true
    elif command -v xdg-open >/dev/null 2>&1; then
      launch_browser xdg-open "$url" || true
    elif command -v open >/dev/null 2>&1; then
      launch_browser open "$url" || true
    elif [[ "$configured_ran" -eq 1 || "$configured_failed" -eq 1 ]]; then
      return 1
    else
      return 1
    fi
  done
}

for url in "${URLS[@]}"; do
  echo "$url"
done

if ! open_urls; then
  echo "No browser opener found (xdg-open/open). Open the URL manually." >&2
fi
