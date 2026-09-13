#!/usr/bin/env bash
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/../_runtime/profile" && pwd -P)/command-profile.guard.sh"
ai_command_require_profile "springboot" || exit $?
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
source "$SCRIPT_DIR/../command-python.setup.sh"
ROOT_DIR=$(cd "$SCRIPT_DIR/../.." && pwd)
CONF_FILE="${SPRINGBOOT_COMMAND_CONF:-${AI_COMMAND_CONFIG_PATH:-}}"
if [[ -n "$CONF_FILE" && -f "$CONF_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$CONF_FILE"
fi

REPO_DIR="${AI_FLOW_PROJECT_DIR:-$PWD}"
DEFAULT_PROFILE="${DEFAULT_PROFILE:-local-aws}"
DEFAULT_REGION="${DEFAULT_REGION:-us-east-2}"
DEFAULT_POM="${DEFAULT_POM:-}"
DEFAULT_MAIN_CLASS="${DEFAULT_MAIN_CLASS:-}"
DEFAULT_APP="${DEFAULT_APP:-}"
DEFAULT_PROJECT_RUN_SCRIPT="${DEFAULT_PROJECT_RUN_SCRIPT:-script/run-local-aws.sh}"
MAVEN_CMD="${MAVEN_CMD:-mvn}"
MAVEN_ARGS="${MAVEN_ARGS:-}"
MVN_ARGS="${MVN_ARGS:-}"
JVM_ARGS="${JVM_ARGS:-}"
FOREGROUND=0
SANDBOX_SAFE=0
USE_PROJECT_RUN_SCRIPT=1

POM_PATH=""
MAIN_CLASS=""
PROFILE="$DEFAULT_PROFILE"
REGION="$DEFAULT_REGION"
APP_NAME="$DEFAULT_APP"
PROJECT_RUN_SCRIPT="$DEFAULT_PROJECT_RUN_SCRIPT"
EXTRA_MVN_ARGS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --pom) POM_PATH="$2"; shift 2;;
    --app) APP_NAME="$2"; shift 2;;
    --profile) PROFILE="$2"; shift 2;;
    --region) REGION="$2"; shift 2;;
    --main-class) MAIN_CLASS="$2"; shift 2;;
    --mvn-args) MVN_ARGS="$2"; shift 2;;
    --maven-args) MAVEN_ARGS="$2"; shift 2;;
    --jvm-args) JVM_ARGS="$2"; shift 2;;
    --project-run-script) PROJECT_RUN_SCRIPT="$2"; shift 2;;
    --force-maven|--no-project-run-script) USE_PROJECT_RUN_SCRIPT=0; shift;;
    --foreground|--no-bg) FOREGROUND=1; shift;;
    --sandbox-safe) SANDBOX_SAFE=1; shift;;
    --) shift; EXTRA_MVN_ARGS+=("$@"); break;;
    *) EXTRA_MVN_ARGS+=("$1"); shift;;
  esac
done

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

PROJECT_RUN_SCRIPT_PATH=""
if [[ -n "$PROJECT_RUN_SCRIPT" ]]; then
  if [[ "$PROJECT_RUN_SCRIPT" = /* && -f "$PROJECT_RUN_SCRIPT" ]]; then
    PROJECT_RUN_SCRIPT_PATH="$PROJECT_RUN_SCRIPT"
  elif [[ -n "$PROJECT_ROOT" && -f "$PROJECT_ROOT/$PROJECT_RUN_SCRIPT" ]]; then
    PROJECT_RUN_SCRIPT_PATH="$PROJECT_ROOT/$PROJECT_RUN_SCRIPT"
  elif [[ -f "$REPO_DIR/$PROJECT_RUN_SCRIPT" ]]; then
    PROJECT_RUN_SCRIPT_PATH="$REPO_DIR/$PROJECT_RUN_SCRIPT"
  fi
fi

USE_PROJECT_RUNNER=0
if [[ "$USE_PROJECT_RUN_SCRIPT" -eq 1 && -n "$PROJECT_RUN_SCRIPT_PATH" ]]; then
  USE_PROJECT_RUNNER=1
fi

if [[ "$USE_PROJECT_RUNNER" -eq 0 ]]; then
  if [[ -z "$POM_PATH" && -n "$DEFAULT_POM" ]]; then
    POM_PATH="$DEFAULT_POM"
  fi

  if [[ -n "$POM_PATH" && ! "$POM_PATH" = /* ]]; then
    POM_PATH="$REPO_DIR/$POM_PATH"
  fi
fi

if [[ "$USE_PROJECT_RUNNER" -eq 0 && -z "$POM_PATH" && -n "$APP_NAME" ]]; then
  APP_CANDIDATE="$APP_NAME"
  if [[ "$APP_CANDIDATE" != /* ]]; then
    APP_CANDIDATE="$REPO_DIR/$APP_CANDIDATE"
  fi
  if [[ -f "$APP_CANDIDATE" && "$(basename "$APP_CANDIDATE")" == "pom.xml" ]]; then
    POM_PATH="$APP_CANDIDATE"
  elif [[ -d "$APP_CANDIDATE" ]]; then
    mapfile -t APP_POMS < <(rg --files -g 'pom.xml' "$APP_CANDIDATE" || true)
    if [[ ${#APP_POMS[@]} -eq 1 ]]; then
      POM_PATH="${APP_POMS[0]}"
    elif [[ ${#APP_POMS[@]} -gt 1 ]]; then
      echo "Multiple pom.xml files found under $APP_CANDIDATE. Provide --pom." >&2
      printf '  %s\n' "${APP_POMS[@]}" >&2
      exit 1
    fi
  else
    mapfile -t ALL_POMS < <(rg --files -g 'pom.xml' "$REPO_DIR" || true)
    if [[ ${#ALL_POMS[@]} -gt 0 ]]; then
      MATCHED=()
      for p in "${ALL_POMS[@]}"; do
        if [[ "$p" == *"/$APP_NAME/"* || "$p" == *"/$APP_NAME/pom.xml" ]]; then
          MATCHED+=("$p")
        fi
      done
      if [[ ${#MATCHED[@]} -eq 1 ]]; then
        POM_PATH="${MATCHED[0]}"
      elif [[ ${#MATCHED[@]} -gt 1 ]]; then
        echo "Multiple pom.xml files matched app '$APP_NAME'. Provide --pom." >&2
        printf '  %s\n' "${MATCHED[@]}" >&2
        exit 1
      fi
    fi
  fi
fi

if [[ "$USE_PROJECT_RUNNER" -eq 0 && -z "$POM_PATH" ]]; then
  mapfile -t POMS < <(rg --files -g 'pom.xml' "$REPO_DIR" || true)
  if [[ ${#POMS[@]} -eq 0 ]]; then
    echo "No pom.xml found under $REPO_DIR" >&2
    exit 1
  elif [[ ${#POMS[@]} -eq 1 ]]; then
    POM_PATH="${POMS[0]}"
  else
    echo "Multiple pom.xml files found. Provide --pom or --app or set DEFAULT_POM in config:" >&2
    printf '  %s\n' "${POMS[@]}" >&2
    exit 1
  fi
fi

if [[ "$USE_PROJECT_RUNNER" -eq 0 && ! -f "$POM_PATH" ]]; then
  echo "pom.xml not found at: $POM_PATH" >&2
  exit 1
fi

if [[ -z "$MAIN_CLASS" && -n "$DEFAULT_MAIN_CLASS" ]]; then
  MAIN_CLASS="$DEFAULT_MAIN_CLASS"
fi

POM_DIR=""
if [[ "$USE_PROJECT_RUNNER" -eq 0 ]]; then
  POM_DIR=$(cd "$(dirname "$POM_PATH")" && pwd)
fi

if [[ "$USE_PROJECT_RUNNER" -eq 0 && -z "$MAIN_CLASS" ]]; then
  MAIN_CLASS=$(command_python - "$POM_PATH" <<'PY'
import sys
import xml.etree.ElementTree as ET

path = sys.argv[1]
try:
    tree = ET.parse(path)
except Exception:
    print("")
    sys.exit(0)
root = tree.getroot()

def text(elem):
    return (elem.text or "").strip()

# Prefer plugin configuration mainClass
for plugin in root.findall(".//{*}plugin"):
    artifact = plugin.find("{*}artifactId")
    if artifact is not None and text(artifact) == "spring-boot-maven-plugin":
        conf = plugin.find("{*}configuration")
        if conf is not None:
            mc = conf.find("{*}mainClass")
            if mc is not None and text(mc):
                print(text(mc))
                sys.exit(0)

# Fallback to properties start-class
start_class = root.find(".//{*}properties/{*}start-class")
if start_class is not None and text(start_class):
    print(text(start_class))
    sys.exit(0)

print("")
PY
)
fi

MAIN_CLASS_FILE=""
if [[ "$USE_PROJECT_RUNNER" -eq 0 && -n "$MAIN_CLASS" ]]; then
  CANDIDATE="$POM_DIR/src/main/java/${MAIN_CLASS//./\/}.java"
  if [[ -f "$CANDIDATE" ]]; then
    MAIN_CLASS_FILE="$CANDIDATE"
  fi
elif [[ "$USE_PROJECT_RUNNER" -eq 0 && -d "$POM_DIR/src" ]]; then
  # Best-effort inference via @SpringBootApplication
  mapfile -t SPRING_FILES < <(rg --files -g '*.java' -g '*.kt' -g '*.groovy' "$POM_DIR/src" | xargs -r rg -l "@SpringBootApplication" -S || true)
  if [[ ${#SPRING_FILES[@]} -gt 0 ]]; then
    MAIN_CLASS=$(command_python - <<'PY'
import re, sys
files = sys.stdin.read().splitlines()
for path in files:
    try:
        with open(path, 'r', encoding='utf-8', errors='ignore') as f:
            data = f.read()
    except Exception:
        continue
    m = re.search(r"\bclass\s+([A-Za-z0-9_]+)", data)
    if m:
        print(m.group(1))
        sys.exit(0)
print("")
PY
<<<"${SPRING_FILES[*]}"
)
    if [[ -n "$MAIN_CLASS" ]]; then
      MAIN_CLASS_FILE="${SPRING_FILES[0]}"
    fi
  fi
fi

APP_LABEL="$APP_NAME"
if [[ -z "$APP_LABEL" ]]; then
  if [[ -n "$POM_DIR" ]]; then
    APP_LABEL="$(basename "$POM_DIR")"
  elif [[ -n "$PROJECT_ROOT" ]]; then
    APP_LABEL="$(basename "$PROJECT_ROOT")"
  else
    APP_LABEL="springboot"
  fi
fi

if [[ -n "$AI_FLOW_OUTPUT_DIR" ]]; then
  OUTPUT_BASE="$AI_FLOW_OUTPUT_DIR"
elif [[ -n "$PROJECT_ROOT" ]]; then
  OUTPUT_BASE="$PROJECT_ROOT/.ai"
else
  OUTPUT_BASE="$SCRIPT_DIR/reports"
fi
LOG_DIR="$OUTPUT_BASE/springboot"
mkdir -p "$LOG_DIR"

# Stop previous run if still running (latest PID file)
LATEST_PID_FILE=$(ls -1t "$LOG_DIR"/*.pid 2>/dev/null | head -n 1 || true)
if [[ -n "$LATEST_PID_FILE" && -f "$LATEST_PID_FILE" ]]; then
  PREV_PID=$(cat "$LATEST_PID_FILE" 2>/dev/null || true)
  if [[ -n "$PREV_PID" ]] && kill -0 "$PREV_PID" 2>/dev/null; then
    echo "Stopping previous run PID: $PREV_PID"
    kill "$PREV_PID" || true
    for _ in $(seq 1 10); do
      if ! kill -0 "$PREV_PID" 2>/dev/null; then
        break
      fi
      sleep 1
    done
    if kill -0 "$PREV_PID" 2>/dev/null; then
      echo "Previous PID still running; sending SIGKILL"
      kill -9 "$PREV_PID" || true
    fi
  fi
fi

rm -f "$LOG_DIR"/*.log "$LOG_DIR"/*.pid

TS=$(date +%Y%m%d-%H%M%S)
LOG_FILE="$LOG_DIR/springboot-${APP_LABEL}-${TS}.log"
PID_FILE="$LOG_FILE.pid"

CMD=()
RUN_DIR=""
if [[ "$USE_PROJECT_RUNNER" -eq 1 ]]; then
  CMD=("$PROJECT_RUN_SCRIPT_PATH")
  RUN_DIR="$(dirname "$PROJECT_RUN_SCRIPT_PATH")"
else
  CMD=($MAVEN_CMD -f "$POM_PATH" spring-boot:run)
  CMD+=("-Dspring-boot.run.profiles=$PROFILE")
  if [[ -n "$JVM_ARGS" ]]; then
    CMD+=("-Dspring-boot.run.jvmArguments=$JVM_ARGS")
  elif [[ "$SANDBOX_SAFE" -eq 1 ]]; then
    CMD+=("-Dspring-boot.run.jvmArguments=-Dio.netty.transport.noNative=true")
  fi
  if [[ -n "$MAIN_CLASS" ]]; then
    CMD+=("-Dspring-boot.run.mainClass=$MAIN_CLASS")
  fi
  if [[ -n "$MAVEN_ARGS" ]]; then
    # shellcheck disable=SC2206
    MAVEN_ARGS_ARR=($MAVEN_ARGS)
    CMD+=("${MAVEN_ARGS_ARR[@]}")
  fi
  if [[ -n "$MVN_ARGS" ]]; then
    # shellcheck disable=SC2206
    MVN_ARGS_ARR=($MVN_ARGS)
    CMD+=("${MVN_ARGS_ARR[@]}")
  fi
  if [[ ${#EXTRA_MVN_ARGS[@]} -gt 0 ]]; then
    CMD+=("${EXTRA_MVN_ARGS[@]}")
  fi
  RUN_DIR="$POM_DIR"
fi

echo "Repo: $REPO_DIR"
if [[ "$USE_PROJECT_RUNNER" -eq 1 ]]; then
  echo "Project run script: $PROJECT_RUN_SCRIPT_PATH"
else
  echo "pom.xml: $POM_PATH"
fi
if [[ "$USE_PROJECT_RUNNER" -eq 1 ]]; then
  echo "Main class: (owned by project run script)"
elif [[ -n "$MAIN_CLASS" ]]; then
  echo "Main class: $MAIN_CLASS"
else
  echo "Main class: (not found; relying on Spring Boot defaults)"
fi
if [[ "$USE_PROJECT_RUNNER" -eq 0 && -n "$MAIN_CLASS_FILE" ]]; then
  echo "Main class file: $MAIN_CLASS_FILE"
fi
echo "Profile: $PROFILE"
echo "Region: $REGION"
if [[ "$USE_PROJECT_RUNNER" -eq 1 ]]; then
  echo "Startup path: project run script"
else
  echo "Startup path: Maven spring-boot:run"
  if [[ "$USE_PROJECT_RUN_SCRIPT" -eq 0 && -n "$PROJECT_RUN_SCRIPT_PATH" ]]; then
    echo "Project run script: (disabled: $PROJECT_RUN_SCRIPT_PATH)"
  elif [[ -n "$PROJECT_RUN_SCRIPT" ]]; then
    echo "Project run script: (not found: $PROJECT_RUN_SCRIPT)"
  fi
fi
echo "Logs: $LOG_FILE"
echo "Manual run (local terminal):"
if [[ "$USE_PROJECT_RUNNER" -eq 1 ]]; then
  printf '  cd "%s" && ./%s\n' "$(dirname "$PROJECT_RUN_SCRIPT_PATH")" "$(basename "$PROJECT_RUN_SCRIPT_PATH")"
elif [[ -n "$JVM_ARGS" ]]; then
  printf '  cd "%s" && AWS_REGION="%s" mvn spring-boot:run -Dspring-boot.run.profiles="%s" -Dspring-boot.run.jvmArguments="%s"\n' "$POM_DIR" "$REGION" "$PROFILE" "$JVM_ARGS"
else
  printf '  cd "%s" && AWS_REGION="%s" mvn spring-boot:run -Dspring-boot.run.profiles="%s"\n' "$POM_DIR" "$REGION" "$PROFILE"
fi

echo "==============================================="
if [[ $FOREGROUND -eq 1 ]]; then
  echo "▶ Running Spring Boot (foreground)"
else
  echo "▶ Running Spring Boot (background)"
fi
printf '  %q \\\n' "${CMD[@]}"
echo "==============================================="

{
  echo "Run started: $(date)"
  echo "Repo: $REPO_DIR"
  if [[ "$USE_PROJECT_RUNNER" -eq 1 ]]; then
    echo "Project run script: $PROJECT_RUN_SCRIPT_PATH"
  else
    echo "pom.xml: $POM_PATH"
  fi
  if [[ "$USE_PROJECT_RUNNER" -eq 0 && -n "$MAIN_CLASS" ]]; then
    echo "Main class: $MAIN_CLASS"
  fi
  echo "Profile: $PROFILE"
  echo "Region: $REGION"
  echo "Startup path: $([[ "$USE_PROJECT_RUNNER" -eq 1 ]] && echo project-run-script || echo maven)"
  echo "Command: ${CMD[*]}"
  echo "Working dir: $RUN_DIR"
  echo "-----------------------------------------------"
} >> "$LOG_FILE"

if [[ "$FOREGROUND" -eq 1 ]]; then
  cd "$RUN_DIR"
  SPRING_PROFILES_ACTIVE="$PROFILE" AWS_REGION="$REGION" AWS_DEFAULT_REGION="$REGION" \
    "${CMD[@]}" 2>&1 | tee -a "$LOG_FILE"
else
  (
    cd "$RUN_DIR"
    SPRING_PROFILES_ACTIVE="$PROFILE" AWS_REGION="$REGION" AWS_DEFAULT_REGION="$REGION" \
      nohup "${CMD[@]}" >> "$LOG_FILE" 2>&1 &
    echo "$!" > "$PID_FILE"
  )

  PID=$(cat "$PID_FILE" 2>/dev/null || true)
  if [[ -n "$PID" ]]; then
    echo "Started PID: $PID"
    echo "PID file: $PID_FILE"
  else
    echo "Failed to capture PID" >&2
    exit 1
  fi
fi
