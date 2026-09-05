#!/usr/bin/env bash
set -euo pipefail

AI_FLOW_PROJECT_DIR="${AI_FLOW_PROJECT_DIR:-}"
AI_FLOW_OUTPUT_DIR="${AI_FLOW_OUTPUT_DIR:-}"
AI_FLOW_PROFILE="${AI_FLOW_PROFILE:-}"
AI_FLOW_TASK_NAME="${AI_FLOW_TASK_NAME:-}"

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
    --profile)
      if [ $# -lt 2 ]; then
        echo "Missing value for --profile" >&2
        exit 2
      fi
      AI_FLOW_PROFILE="$2"
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
export AI_FLOW_PROJECT_DIR AI_FLOW_OUTPUT_DIR AI_FLOW_PROFILE AI_FLOW_TASK_NAME


SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../command-python.setup.sh"
CONF_FILE="$SCRIPT_DIR/sonar-qube.command.conf"
PROFILE_CONF_FILE=""
CREDS_FILE="${CREDS_FILE:-$SCRIPT_DIR/../../../ai-config/.creds/creds.json}"

if [ -f "$CONF_FILE" ]; then
  # shellcheck source=/dev/null
  source "$CONF_FILE"
fi

PROFILE="${AI_FLOW_PROFILE:-${DEFAULT_PROFILE:-}}"
if [ -n "$PROFILE" ]; then
  PROFILE_CONF_FILE="$SCRIPT_DIR/sonar-qube.command.${PROFILE}.conf"
  if [ -f "$PROFILE_CONF_FILE" ]; then
    # shellcheck source=/dev/null
    source "$PROFILE_CONF_FILE"
  fi
fi

REPO_DIR="${1:-${DEFAULT_REPO_DIR:-${AI_FLOW_PROJECT_DIR:-}}}"
SONAR_TOKEN="${SONAR_TOKEN:-${DEFAULT_SONAR_TOKEN:-}}"

if [ -z "$REPO_DIR" ]; then
  echo "Usage: $0 <repo_dir>" >&2
  exit 1
fi

load_sonar_token_from_creds() {
  if [ -z "$PROFILE" ] || [ ! -f "$CREDS_FILE" ]; then
    return 0
  fi
  local token
  token="$(command_python - <<PY 2>/dev/null || true
import json
import sys
path = "${CREDS_FILE}"
profile = "${PROFILE}"
try:
    data = json.load(open(path))
except Exception:
    sys.exit(0)
token = (
    data.get("profiles", {})
        .get(profile, {})
        .get("codex", {})
        .get("sonarToken", "")
)
print(token)
PY
)"
  if [ -n "$token" ]; then
    SONAR_TOKEN="$token"
  fi
}

load_sonar_token_from_creds

if [ -z "$SONAR_TOKEN" ]; then
  echo "SONAR_TOKEN is required; generate one at https://sonarqube.local/account/security and set it in the environment or sonar-qube.command.conf." >&2
  exit 1
fi

if [ ! -d "$REPO_DIR" ]; then
  echo "Repo directory not found: $REPO_DIR" >&2
  exit 1
fi

PROJECT_NAME="$(basename "$REPO_DIR")"
TASK_NAME="${AI_FLOW_TASK_NAME:-}"
if [ -z "$TASK_NAME" ] && command -v git >/dev/null 2>&1; then
  TASK_NAME="$(git -C "$REPO_DIR" rev-parse --abbrev-ref HEAD 2>/dev/null || true)"
fi
TASK_NAME="${TASK_NAME:-task}"
PROFILE="${PROFILE:-default}"

if [ -n "${AI_FLOW_OUTPUT_DIR:-}" ]; then
  REPORTS_ROOT="$AI_FLOW_OUTPUT_DIR/sonar-qube/reports"
else
  REPORTS_ROOT="$SCRIPT_DIR/reports"
fi
REPORTS_DIR="$REPORTS_ROOT/$PROFILE/$PROJECT_NAME/$TASK_NAME"
LOG_FILE="$REPORTS_DIR/sonar-qube-$(basename "$REPO_DIR").log"
ISSUES_FILE="$REPORTS_DIR/sonar-qube-$(basename "$REPO_DIR")-issues.json"
QUALITY_FILE="$REPORTS_DIR/sonar-qube-$(basename "$REPO_DIR")-quality.json"
MEASURES_FILE="$REPORTS_DIR/sonar-qube-$(basename "$REPO_DIR")-measures.json"
TEMP_MVNW=""
MAVEN_SETTINGS="${MAVEN_SETTINGS:-${DEFAULT_MAVEN_SETTINGS:-settings.xml}}"
COVERAGE_REPORT="${COVERAGE_REPORT:-${DEFAULT_COVERAGE_REPORT:-target/site/jacoco-aggregate/jacoco.xml}}"
SONAR_HOST_URL="${SONAR_HOST_URL:-${DEFAULT_SONAR_HOST_URL:-https://sonarqube.local}}"
SONAR_PROJECT_KEY="${SONAR_PROJECT_KEY:-${DEFAULT_SONAR_PROJECT_KEY:-}}"
MAVEN_MODULE_DIR="${MAVEN_MODULE_DIR:-${DEFAULT_MAVEN_MODULE_DIR:-}}"
MAVEN_ARGS="${MAVEN_ARGS:-${DEFAULT_MAVEN_ARGS:-}}"
SKIP_MAVEN_CLEAN="${SKIP_MAVEN_CLEAN:-${DEFAULT_SKIP_MAVEN_CLEAN:-}}"
RUN_TESTS="${RUN_TESTS:-${DEFAULT_RUN_TESTS:-}}"
SONAR_SCANNER_HOME="${SONAR_SCANNER_HOME:-${DEFAULT_SONAR_SCANNER_HOME:-$HOME/.local/sonar-scanner}}"
SONAR_SCANNER_BIN="${SONAR_SCANNER_BIN:-${DEFAULT_SONAR_SCANNER_BIN:-}}"
SONAR_BRANCH="${SONAR_BRANCH:-${DEFAULT_SONAR_BRANCH:-}}"
SONAR_PR_KEY="${SONAR_PR_KEY:-${DEFAULT_SONAR_PR_KEY:-}}"
SONAR_PR_BASE="${SONAR_PR_BASE:-${DEFAULT_SONAR_PR_BASE:-}}"
SONAR_PR_BRANCH="${SONAR_PR_BRANCH:-${DEFAULT_SONAR_PR_BRANCH:-}}"
SONAR_METRICS="${SONAR_METRICS:-${DEFAULT_SONAR_METRICS:-new_coverage}}"

ensure_mvnw() {
  if [ -x "$MODULE_DIR/mvnw" ]; then
    MVN_CMD="$MODULE_DIR/mvnw"
    return 0
  fi

  if [ -x "$REPO_DIR/mvnw" ]; then
    MVN_CMD="$REPO_DIR/mvnw"
    return 0
  fi

  if ! command -v mvn >/dev/null 2>&1; then
    echo "Missing ./mvnw and mvn is not available on PATH." >&2
    exit 1
  fi

  TEMP_MVNW="$MODULE_DIR/mvnw"
  cat >"$TEMP_MVNW" <<'EOF'
#!/usr/bin/env bash
exec mvn "$@"
EOF
  chmod +x "$TEMP_MVNW"
  MVN_CMD="$TEMP_MVNW"
}

cleanup_mvnw() {
  if [ -n "$TEMP_MVNW" ] && [ -f "$TEMP_MVNW" ]; then
    rm -f "$TEMP_MVNW"
  fi
}

resolve_sonar_scanner() {
  PATH="${SONAR_SCANNER_HOME}/bin:${PATH}"
  if [ -n "$SONAR_SCANNER_BIN" ]; then
    SCANNER_BIN="$SONAR_SCANNER_BIN"
  else
    SCANNER_BIN="$(command -v sonar-scanner || true)"
  fi

  if [ -z "$SCANNER_BIN" ] || ! command -v "$SCANNER_BIN" >/dev/null 2>&1; then
    echo "SonarScanner not available; install it or set SONAR_SCANNER_BIN." >&2
    exit 1
  fi
}

resolve_coverage_report() {
  local candidates=()
  candidates+=("$COVERAGE_REPORT")
  candidates+=("target/site/jacoco-aggregate/jacoco.xml")
  candidates+=("target/site/jacoco-ut/jacoco.xml")
  candidates+=("target/site/jacoco-it/jacoco.xml")
  candidates+=("target/site/jacoco/jacoco.xml")

  for candidate in "${candidates[@]}"; do
    if [ -n "$candidate" ] && [ -f "$candidate" ]; then
      COVERAGE_REPORT="$candidate"
      return 0
    fi
  done
}

resolve_module_dir() {
  if [ -n "$MAVEN_MODULE_DIR" ]; then
    if [ -d "$REPO_DIR/$MAVEN_MODULE_DIR" ]; then
      MODULE_DIR="$REPO_DIR/$MAVEN_MODULE_DIR"
      return 0
    fi
    if [ -d "$MAVEN_MODULE_DIR" ]; then
      MODULE_DIR="$MAVEN_MODULE_DIR"
      return 0
    fi
    echo "MAVEN_MODULE_DIR not found: $MAVEN_MODULE_DIR" >&2
    exit 1
  fi

  if [ -f "$REPO_DIR/pom.xml" ]; then
    MODULE_DIR="$REPO_DIR"
    return 0
  fi

  mapfile -t pom_files < <(find "$REPO_DIR" -maxdepth 4 -name pom.xml)
  if [ "${#pom_files[@]}" -eq 1 ]; then
    MODULE_DIR="$(dirname "${pom_files[0]}")"
    return 0
  fi

  if [ "${#pom_files[@]}" -eq 0 ]; then
    echo "No pom.xml found under $REPO_DIR; set MAVEN_MODULE_DIR." >&2
    exit 1
  fi

  echo "Multiple pom.xml files found; set MAVEN_MODULE_DIR to the correct module:" >&2
  printf '  - %s\n' "${pom_files[@]}" >&2
  exit 1
}

load_sonar_project_key() {
  if [ -n "$SONAR_PROJECT_KEY" ]; then
    return 0
  fi
  if [ -f "$MODULE_DIR/sonar-project.properties" ]; then
    SONAR_PROJECT_KEY="$(awk -F= '$1 ~ /^sonar.projectKey$/ {print $2; exit}' "$MODULE_DIR/sonar-project.properties" | tr -d '\r')"
  fi
}

run_scan() {
  mkdir -p "$REPORTS_DIR"
  rm -f "$REPORTS_DIR"/sonar-qube-*
  resolve_module_dir
  echo "PROJECT: $REPO_DIR"
  echo "MODULE: $MODULE_DIR"

  cd "$MODULE_DIR"
  {
    ensure_mvnw
    resolve_sonar_scanner
    load_sonar_project_key

    if [ -z "$SONAR_PROJECT_KEY" ] && [ ! -f "sonar-project.properties" ]; then
      SONAR_PROJECT_KEY="ghe:config-services:$(basename "$REPO_DIR")"
    fi

    if [ -z "$MAVEN_ARGS" ]; then
      if [ -n "$RUN_TESTS" ]; then
        MAVEN_ARGS=""
      else
        MAVEN_ARGS="-DskipTests -DskipITs -Dskip.unit.tests=true -DskipUTs=true"
      fi
    fi
    read -r -a MAVEN_ARGS_ARR <<< "$MAVEN_ARGS"

    MAVEN_GOALS=(clean verify)
    if [ -n "$SKIP_MAVEN_CLEAN" ]; then
      MAVEN_GOALS=(verify)
    fi

    if [ -f "$MAVEN_SETTINGS" ]; then
      "$MVN_CMD" -q --settings="$MAVEN_SETTINGS" "${MAVEN_GOALS[@]}" "${MAVEN_ARGS_ARR[@]}"
    else
      "$MVN_CMD" -q "${MAVEN_GOALS[@]}" "${MAVEN_ARGS_ARR[@]}"
    fi

    resolve_coverage_report

    SCAN_ARGS=(
      -Dsonar.host.url="$SONAR_HOST_URL"
      -Dsonar.coverage.jacoco.xmlReportPaths="$COVERAGE_REPORT"
      -Dsonar.java.binaries="target/classes"
      -Dsonar.verbose=false
      -Dsonar.log.level=ERROR
    )

    if [ -n "$SONAR_PROJECT_KEY" ]; then
      SCAN_ARGS+=(-Dsonar.projectKey="$SONAR_PROJECT_KEY")
    fi
    if [ -n "$SONAR_BRANCH" ]; then
      SCAN_ARGS+=(-Dsonar.branch.name="$SONAR_BRANCH")
    fi
    if [ -n "$SONAR_PR_KEY" ] && [ -n "$SONAR_PR_BASE" ]; then
      SCAN_ARGS+=(
        -Dsonar.pullrequest.key="$SONAR_PR_KEY"
        -Dsonar.pullrequest.branch="${SONAR_PR_BRANCH:-$SONAR_BRANCH}"
        -Dsonar.pullrequest.base="$SONAR_PR_BASE"
      )
    fi

    SONAR_TOKEN="$SONAR_TOKEN" "$SCANNER_BIN" "${SCAN_ARGS[@]}"
  } >"$LOG_FILE" 2>&1
}

fetch_sonar_results() {
  if ! command -v curl >/dev/null 2>&1; then
    return 0
  fi
  if [ -z "$SONAR_PROJECT_KEY" ]; then
    return 0
  fi

  PR_PARAM=""
  if [ -n "$SONAR_PR_KEY" ]; then
    PR_PARAM="&pullRequest=$SONAR_PR_KEY"
  fi

  BRANCH_PARAM=""
  if [ -n "$SONAR_BRANCH" ]; then
    BRANCH_PARAM="&branch=$SONAR_BRANCH"
  fi

  curl -sf -u "${SONAR_TOKEN}:" \
    "${SONAR_HOST_URL}/api/issues/search?componentKeys=${SONAR_PROJECT_KEY}&resolved=false&ps=500${BRANCH_PARAM}${PR_PARAM}" \
    -o "$ISSUES_FILE" || true
  curl -sf -u "${SONAR_TOKEN}:" \
    "${SONAR_HOST_URL}/api/qualitygates/project_status?projectKey=${SONAR_PROJECT_KEY}${BRANCH_PARAM}" \
    -o "$QUALITY_FILE" || true
  if [ -n "$SONAR_METRICS" ]; then
    curl -sf -u "${SONAR_TOKEN}:" \
      "${SONAR_HOST_URL}/api/measures/component?component=${SONAR_PROJECT_KEY}&metricKeys=${SONAR_METRICS}${BRANCH_PARAM}${PR_PARAM}" \
      -o "$MEASURES_FILE" || true
  fi
}

summarize_issues() {
  if [ ! -f "$ISSUES_FILE" ]; then
    return 0
  fi
  if command_python_bootstrap >/dev/null 2>&1; then
    command_python - "$ISSUES_FILE" <<'PY'
import json, sys
path = sys.argv[1]
try:
    data = json.load(open(path))
    issues = data.get("issues", [])
    print(f"Issues: {len(issues)}")
except Exception:
    pass
PY
  fi
}

wait_for_ce_task() {
  if [ ! -f "$LOG_FILE" ]; then
    return 0
  fi
  if ! command -v curl >/dev/null 2>&1; then
    return 0
  fi
  if [ -z "$SONAR_PROJECT_KEY" ]; then
    return 0
  fi

  local task_url task_id api_url status attempts
  task_url="$(awk '/More about the report processing at/ {print $NF; exit}' "$LOG_FILE")"
  if [ -z "$task_url" ]; then
    return 0
  fi
  task_id="${task_url##*id=}"
  if [ -z "$task_id" ]; then
    return 0
  fi

  api_url="${SONAR_HOST_URL}/api/ce/task?id=${task_id}"
  attempts=0
  while [ $attempts -lt 20 ]; do
    status="$(curl -sf -u "${SONAR_TOKEN}:" "$api_url" 2>/dev/null | awk -F'"' '/"status":/ {print $4; exit}' || true)"
    if [ "$status" = "SUCCESS" ]; then
      return 0
    fi
    if [ "$status" = "FAILED" ] || [ "$status" = "CANCELED" ]; then
      return 0
    fi
    attempts=$((attempts + 1))
    sleep 3
  done
}

if run_scan; then
  cleanup_mvnw
  echo "Scan finished; waiting for SonarQube to process results..."
  wait_for_ce_task
  echo "Fetching JSON reports..."
  fetch_sonar_results
  echo "PASS"
  echo "Log: $LOG_FILE"
  if [ -f "$ISSUES_FILE" ]; then
    echo "Issues: $ISSUES_FILE"
    summarize_issues
  fi
  if [ -f "$QUALITY_FILE" ]; then
    echo "Quality: $QUALITY_FILE"
  fi
  if [ -f "$MEASURES_FILE" ]; then
    echo "Measures: $MEASURES_FILE"
  fi
else
  cleanup_mvnw
  echo "FAIL"
  if [ "${SHOW_LOG:-0}" = "1" ]; then
    cat "$LOG_FILE"
  else
    echo "Log: $LOG_FILE"
  fi
  exit 1
fi
