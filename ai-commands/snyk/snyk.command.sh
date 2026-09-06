#!/usr/bin/env bash
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/../_runtime/profile" && pwd -P)/command-profile.guard.sh"
ai_command_require_profile "snyk" || exit $?
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
CONF_FILE="${SNYK_COMMAND_CONF:-${AI_COMMAND_CONFIG_PATH:-}}"

if [ -n "$CONF_FILE" ] && [ -f "$CONF_FILE" ]; then
  # shellcheck source=/dev/null
  source "$CONF_FILE"
fi

REPO_DIR="${1:-${DEFAULT_REPO_DIR:-${AI_FLOW_PROJECT_DIR:-}}}"
SNYK_TOKEN="${SNYK_TOKEN:-${DEFAULT_SNYK_TOKEN:-}}"
SNYK_ORG="${SNYK_ORG:-${DEFAULT_SNYK_ORG:-}}"
SNYK_API_KEY_URL="${SNYK_API_KEY_URL:-${DEFAULT_SNYK_API_KEY_URL:-https://app.snyk.io/account}}"
SNYK_BIN="${SNYK_BIN:-${DEFAULT_SNYK_BIN:-}}"
SNYK_COMMAND="${SNYK_COMMAND:-${DEFAULT_SNYK_COMMAND:-test}}"
SNYK_TARGET_FILE="${SNYK_TARGET_FILE:-${DEFAULT_SNYK_TARGET_FILE:-}}"
SNYK_PROJECT_NAME="${SNYK_PROJECT_NAME:-${DEFAULT_SNYK_PROJECT_NAME:-}}"
SNYK_PROJECT_URL="${SNYK_PROJECT_URL:-${DEFAULT_SNYK_PROJECT_URL:-}}"
SNYK_OUTPUT_FORMAT="${SNYK_OUTPUT_FORMAT:-${DEFAULT_SNYK_OUTPUT_FORMAT:-}}"
SNYK_JSON="${SNYK_JSON:-${DEFAULT_SNYK_JSON:-}}"
SNYK_ALLOW_FAILURE="${SNYK_ALLOW_FAILURE:-${DEFAULT_SNYK_ALLOW_FAILURE:-}}"
SNYK_ARGS="${SNYK_ARGS:-${DEFAULT_SNYK_ARGS:-}}"
SNYK_MAVEN_ARGS="${SNYK_MAVEN_ARGS:-${DEFAULT_SNYK_MAVEN_ARGS:-}}"
SNYK_INSTALL_CMD="${SNYK_INSTALL_CMD:-${DEFAULT_SNYK_INSTALL_CMD:-}}"
SHOW_LOG="${SHOW_LOG:-${DEFAULT_SHOW_LOG:-}}"

if [ -z "$REPO_DIR" ]; then
  echo "Usage: $0 <repo_dir>" >&2
  exit 1
fi

if [ -z "$SNYK_TOKEN" ]; then
  echo "SNYK_TOKEN is required; set it in the environment or selected profile configuration." >&2
  echo "Opening Snyk API key page: $SNYK_API_KEY_URL" >&2
  open_api_key_page
  exit 1
fi

if [ ! -d "$REPO_DIR" ]; then
  echo "Repo directory not found: $REPO_DIR" >&2
  exit 1
fi

if [ -z "$SNYK_BIN" ]; then
  SNYK_BIN="$(command -v snyk || true)"
fi

if [ -z "$SNYK_BIN" ] || ! command -v "$SNYK_BIN" >/dev/null 2>&1; then
  if ! install_snyk; then
    exit 1
  fi
  SNYK_BIN="$(command -v snyk || true)"
fi

if [ -z "$SNYK_BIN" ] || ! command -v "$SNYK_BIN" >/dev/null 2>&1; then
  echo "Snyk CLI not available after install attempt; set SNYK_BIN." >&2
  exit 1
fi



open_api_key_page() {
  local browser_cmd="$SCRIPT_DIR/../browser/browser.command.sh"
  if [ -x "$browser_cmd" ]; then
    "$browser_cmd" "$SNYK_API_KEY_URL" || true
  else
    echo "Browser command not found: $browser_cmd" >&2
  fi
}

install_snyk() {
  if [ -n "$SNYK_INSTALL_CMD" ]; then
    echo "Installing Snyk CLI using SNYK_INSTALL_CMD..." >&2
    bash -lc "$SNYK_INSTALL_CMD"
    return $?
  fi

  if command -v npm >/dev/null 2>&1; then
    echo "Installing Snyk CLI using npm..." >&2
    npm install -g snyk
    return $?
  fi

  echo "Snyk CLI not available and no install method found. Set SNYK_INSTALL_CMD or install Snyk manually." >&2
  return 1
}

resolve_target_file() {
  if [ -n "$SNYK_TARGET_FILE" ]; then
    if [ -f "$REPO_DIR/$SNYK_TARGET_FILE" ]; then
      SNYK_TARGET_FILE="$REPO_DIR/$SNYK_TARGET_FILE"
      return 0
    fi
    if [ -f "$SNYK_TARGET_FILE" ]; then
      return 0
    fi
    echo "SNYK_TARGET_FILE not found: $SNYK_TARGET_FILE" >&2
    exit 1
  fi

  if [ -f "$REPO_DIR/pom.xml" ]; then
    SNYK_TARGET_FILE="$REPO_DIR/pom.xml"
    return 0
  fi

  mapfile -t pom_files < <(find "$REPO_DIR" -maxdepth 4 -name pom.xml)
  if [ "${#pom_files[@]}" -eq 1 ]; then
    SNYK_TARGET_FILE="${pom_files[0]}"
    return 0
  fi

  if [ "${#pom_files[@]}" -eq 0 ]; then
    echo "No pom.xml found under $REPO_DIR; set SNYK_TARGET_FILE." >&2
    exit 1
  fi

  echo "Multiple pom.xml files found; set SNYK_TARGET_FILE to the correct module:" >&2
  printf '  - %s\n' "${pom_files[@]}" >&2
  exit 1
}

resolve_target_file

MODULE_DIR="$(cd "$(dirname "$SNYK_TARGET_FILE")" && pwd)"
if [ -z "$SNYK_MAVEN_ARGS" ] && [ -f "$MODULE_DIR/settings.xml" ]; then
  SNYK_MAVEN_ARGS="-s $MODULE_DIR/settings.xml"
fi

if [ -n "${AI_FLOW_OUTPUT_DIR:-}" ]; then
  REPORTS_DIR="$AI_FLOW_OUTPUT_DIR/snyk/reports"
else
  REPORTS_DIR="$SCRIPT_DIR/reports"
fi
mkdir -p "$REPORTS_DIR"
rm -f "$REPORTS_DIR"/*

LOG_FILE="$REPORTS_DIR/snyk-$(basename "$REPO_DIR")-$SNYK_COMMAND.log"
JSON_FILE="$REPORTS_DIR/snyk-$(basename "$REPO_DIR")-$SNYK_COMMAND.json"

cmd=("$SNYK_BIN" "$SNYK_COMMAND" "--file=$SNYK_TARGET_FILE")
if [ -n "$SNYK_ORG" ]; then
  cmd+=("--org=$SNYK_ORG")
fi
if [ -n "$SNYK_PROJECT_NAME" ]; then
  cmd+=("--project-name=$SNYK_PROJECT_NAME")
fi
if [ -n "$SNYK_MAVEN_ARGS" ]; then
  cmd+=("--maven-args=$SNYK_MAVEN_ARGS")
fi
if [ "$SNYK_OUTPUT_FORMAT" = "json" ] || [ "$SNYK_JSON" = "1" ]; then
  cmd+=("--json")
fi
if [ -n "$SNYK_ARGS" ]; then
  read -r -a extra_args <<<"$SNYK_ARGS"
  cmd+=("${extra_args[@]}")
fi

set +e
if [ "$SNYK_OUTPUT_FORMAT" = "json" ] || [ "$SNYK_JSON" = "1" ]; then
  (cd "$REPO_DIR" && { [ -n "$SNYK_PROJECT_URL" ] && echo "Snyk project: $SNYK_PROJECT_URL" >&2; SNYK_TOKEN="$SNYK_TOKEN" "${cmd[@]}"; }) >"$JSON_FILE" 2>"$LOG_FILE"
else
  (cd "$REPO_DIR" && { [ -n "$SNYK_PROJECT_URL" ] && echo "Snyk project: $SNYK_PROJECT_URL" >&2; SNYK_TOKEN="$SNYK_TOKEN" "${cmd[@]}"; }) >"$LOG_FILE" 2>&1
fi
status=$?
set -e

if [ "$status" -ne 0 ] && [ "${SNYK_ALLOW_FAILURE:-0}" != "1" ]; then
  echo "FAIL"
  echo "Log: $LOG_FILE"
  if [ "$SNYK_OUTPUT_FORMAT" = "json" ] || [ "$SNYK_JSON" = "1" ]; then
    echo "JSON: $JSON_FILE"
  fi
  if [ "${SHOW_LOG:-0}" = "1" ]; then
    cat "$LOG_FILE"
  fi
  exit "$status"
fi

if [ "$status" -ne 0 ] && [ "${SNYK_ALLOW_FAILURE:-0}" = "1" ]; then
  echo "PASS"
if [ "$SNYK_OUTPUT_FORMAT" = "json" ] || [ "$SNYK_JSON" = "1" ]; then
  echo "JSON: $JSON_FILE"
fi
echo "Log: $LOG_FILE"
  exit 0
fi

echo "PASS"
if [ "$SNYK_OUTPUT_FORMAT" = "json" ] || [ "$SNYK_JSON" = "1" ]; then
  echo "JSON: $JSON_FILE"
fi
echo "Log: $LOG_FILE"
