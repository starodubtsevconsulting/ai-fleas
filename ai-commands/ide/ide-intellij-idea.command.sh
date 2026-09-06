#!/usr/bin/env bash
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/../_runtime/profile" && pwd -P)/command-profile.guard.sh"
ai_command_require_profile "ide" || exit $?
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
source "$SCRIPT_DIR/../command-python.setup.sh"
CONF_FILE="${IDE_COMMAND_CONF:-${AI_COMMAND_CONFIG_PATH:-}}"

MAIN_CLASS_ENV="${MAIN_CLASS:-}"
PROFILE_ENV="${PROFILE:-}"
RUN_AWS_REGION_ENV="${RUN_AWS_REGION:-}"
DEVTOOLS_RESTART_ENABLED_ENV="${DEVTOOLS_RESTART_ENABLED:-}"
DEVTOOLS_RESTART_JVM_DISABLE_ENV="${DEVTOOLS_RESTART_JVM_DISABLE:-}"

if [ -n "$CONF_FILE" ] && [ -f "$CONF_FILE" ]; then
  # shellcheck source=/dev/null
  source "$CONF_FILE"
fi

REPO_DIR="${1:-}"
MODULE_DIR="${MODULE_DIR:-}"
MAIN_CLASS="${MAIN_CLASS_ENV:-${MAIN_CLASS:-}}"
PROFILE="${PROFILE_ENV:-${PROFILE:-local-aws}}"
RUN_AWS_REGION="${RUN_AWS_REGION_ENV:-${RUN_AWS_REGION:-us-east-2}}"
DEVTOOLS_RESTART_ENABLED="${DEVTOOLS_RESTART_ENABLED_ENV:-${DEVTOOLS_RESTART_ENABLED:-false}}"
DEVTOOLS_RESTART_JVM_DISABLE="${DEVTOOLS_RESTART_JVM_DISABLE_ENV:-${DEVTOOLS_RESTART_JVM_DISABLE:-true}}"
VALIDATE_ONLY="${VALIDATE_ONLY:-}"
PROMPT="${PROMPT:-}"

if [ -z "$REPO_DIR" ]; then
  echo "Usage: $0 <repo_dir>" >&2
  exit 1
fi

if [ ! -d "$REPO_DIR" ]; then
  echo "Repo directory not found: $REPO_DIR" >&2
  exit 1
fi

if [ -z "$MAIN_CLASS" ]; then
  echo "MAIN_CLASS is required (set it in the selected profile or environment)." >&2
  exit 1
fi

resolve_module_dir() {
  if [ -n "$MODULE_DIR" ]; then
    if [ -d "$REPO_DIR/$MODULE_DIR" ]; then
      MODULE_DIR="$REPO_DIR/$MODULE_DIR"
      return 0
    fi
    if [ -d "$MODULE_DIR" ]; then
      return 0
    fi
    echo "MODULE_DIR not found: $MODULE_DIR" >&2
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
    echo "No pom.xml found under $REPO_DIR; set MODULE_DIR." >&2
    exit 1
  fi

  echo "Multiple pom.xml files found; set MODULE_DIR to the correct module:" >&2
  printf '  - %s\n' "${pom_files[@]}" >&2
  exit 1
}

resolve_module_dir

IDEA_DIR="$REPO_DIR/.idea"
RUN_DIR="$IDEA_DIR/runConfigurations"
mkdir -p "$RUN_DIR"

MODULE_NAME="$(basename "$MODULE_DIR")"
CONFIG_NAME="$(basename "${MAIN_CLASS//./\/}")"
CONFIG_PATH="$RUN_DIR/${CONFIG_NAME}.xml"
LEGACY_CONFIG_PATH="$RUN_DIR/ConfigServiceApplication.xml"
EXPECTED_XML="$(cat <<EOF
<component name="ProjectRunConfigurationManager">
  <configuration default="false" name="${CONFIG_NAME}" type="SpringBootApplicationConfigurationType" factoryName="Spring Boot">
    <option name="STORE_AS_PROJECT_FILE" value="true" />
    <option name="SPRING_BOOT_MAIN_CLASS" value="${MAIN_CLASS}" />
    <option name="SPRING_BOOT_PROFILES" value="${PROFILE}" />
    <option name="ACTIVE_PROFILES" value="${PROFILE}" />
    <envs>
      <env name="AWS_REGION" value="${RUN_AWS_REGION}" />
      <env name="SPRING_PROFILES_ACTIVE" value="${PROFILE}" />
      <env name="SPRING_DEVTOOLS_RESTART_ENABLED" value="${DEVTOOLS_RESTART_ENABLED}" />
    </envs>
    <option name="VM_PARAMETERS" value="-Dspring.devtools.restart.enabled=${DEVTOOLS_RESTART_JVM_DISABLE}" />
    <module name="${MODULE_NAME}" />
    <method v="2">
      <option name="Make" enabled="true" />
    </method>
  </configuration>
</component>
EOF
)"

if [ -f "$CONFIG_PATH" ]; then
  status=0
  command_python - "$CONFIG_PATH" "$MAIN_CLASS" "$PROFILE" "$RUN_AWS_REGION" "$DEVTOOLS_RESTART_ENABLED" "$DEVTOOLS_RESTART_JVM_DISABLE" "$MODULE_NAME" "$VALIDATE_ONLY" "$PROMPT" <<'PY' || status=$?
import re
import sys

path, exp_main, exp_profile, exp_region, exp_devtools, exp_jvm_disable, exp_module, validate_only, prompt = sys.argv[1:]
data = open(path, "r", encoding="utf-8").read()

def find(pattern):
    m = re.search(pattern, data)
    return m.group(1) if m else None

cur_main = find(r'SPRING_BOOT_MAIN_CLASS" value="([^"]*)"')
cur_profile = find(r'SPRING_BOOT_PROFILES" value="([^"]*)"')
cur_active_profiles = find(r'ACTIVE_PROFILES" value="([^"]*)"')
cur_region = find(r'<env name="AWS_REGION" value="([^"]*)"')
cur_active = find(r'<env name="SPRING_PROFILES_ACTIVE" value="([^"]*)"')
cur_devtools = find(r'<env name="SPRING_DEVTOOLS_RESTART_ENABLED" value="([^"]*)"')
cur_vm = find(r'<option name="VM_PARAMETERS" value="([^"]*)"')
cur_module = find(r'<module name="([^"]*)"')

problems = []
if cur_main != exp_main:
    problems.append(f"MAIN_CLASS expected '{exp_main}' got '{cur_main}'")
if cur_profile != exp_profile:
    problems.append(f"PROFILE expected '{exp_profile}' got '{cur_profile}'")
if cur_active_profiles != exp_profile:
    problems.append(f"ACTIVE_PROFILES expected '{exp_profile}' got '{cur_active_profiles}'")
if cur_region != exp_region:
    problems.append(f"AWS_REGION expected '{exp_region}' got '{cur_region}'")
if cur_active != exp_profile:
    problems.append(f"SPRING_PROFILES_ACTIVE expected '{exp_profile}' got '{cur_active}'")
if cur_devtools != exp_devtools:
    problems.append(f"SPRING_DEVTOOLS_RESTART_ENABLED expected '{exp_devtools}' got '{cur_devtools}'")
expected_vm = f"-Dspring.devtools.restart.enabled={exp_jvm_disable}"
if cur_vm != expected_vm:
    problems.append(f"VM_PARAMETERS expected '{expected_vm}' got '{cur_vm}'")
if cur_module != exp_module:
    problems.append(f"MODULE expected '{exp_module}' got '{cur_module}'")

if problems:
    if validate_only:
        print("IDEA run config does not match expected values:")
        for p in problems:
            print(f"- {p}")
        if not prompt:
            print("Re-run without VALIDATE_ONLY to update the file.")
        sys.exit(3)
    sys.exit(2)
else:
    print(f"IDEA run config is up to date: {path}")
    sys.exit(0)
PY
  if [ $status -eq 0 ]; then
    exit 0
  fi
  if [ $status -eq 3 ] && [ -n "$VALIDATE_ONLY" ]; then
    if [ -n "$PROMPT" ]; then
      read -r -p "Fix IntelliJ run config to expected values? [y/N] " reply
      if [ "$reply" != "y" ] && [ "$reply" != "Y" ]; then
        exit 3
      fi
      VALIDATE_ONLY=""
    else
      exit 3
    fi
  fi
fi

if [ -n "$LEGACY_CONFIG_PATH" ] && [ "$LEGACY_CONFIG_PATH" != "$CONFIG_PATH" ] && [ -f "$LEGACY_CONFIG_PATH" ]; then
  rm -f "$LEGACY_CONFIG_PATH"
fi

cat >"$CONFIG_PATH" <<EOF
$EXPECTED_XML
EOF

echo "Wrote $CONFIG_PATH"
