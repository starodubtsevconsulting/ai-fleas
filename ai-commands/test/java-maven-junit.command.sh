#!/usr/bin/env bash
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/../_runtime/profile" && pwd -P)/command-profile.guard.sh"
ai_command_require_profile "test" || exit $?
set -euo pipefail

PROJECT_DIR="$(pwd)"
MODULE_DIR=""
TEST_CLASS=""
JAVA_BIN="${JAVA_BIN:-$(command -v java || true)}"

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
    --class)
      TEST_CLASS="$2"
      shift 2
      ;;
    --java-bin)
      JAVA_BIN="$2"
      shift 2
      ;;
    -h|--help)
      cat <<USAGE
Usage:
  $0 --module-dir <module-dir> --class <fully.qualified.TestClass> [options]

Options:
  --project-dir <dir>   Project root (default: current directory)
  --module-dir <dir>    Maven module directory where pom.xml exists
  --class <fqcn>        Fully-qualified JUnit test class name
  --java-bin <path>     Java binary path (default: first 'java' in PATH)
USAGE
      exit 0
      ;;
    *)
      echo "Unknown arg: $1" >&2
      exit 2
      ;;
  esac
done

if [ -z "$MODULE_DIR" ] || [ -z "$TEST_CLASS" ]; then
  echo "Both --module-dir and --class are required." >&2
  exit 2
fi

if [ -z "$JAVA_BIN" ] || [ ! -x "$JAVA_BIN" ]; then
  if command -v java >/dev/null 2>&1; then
    JAVA_BIN="$(command -v java)"
  else
    echo "Java binary not found. Provide --java-bin or set JAVA_BIN." >&2
    exit 1
  fi
fi

MODULE_PATH="$PROJECT_DIR/$MODULE_DIR"
if [ ! -d "$MODULE_PATH" ] || [ ! -f "$MODULE_PATH/pom.xml" ]; then
  echo "Invalid module dir: $MODULE_PATH (pom.xml not found)" >&2
  exit 1
fi

latest_runtime_jar() {
  local pattern="$1"
  ls -1 $pattern 2>/dev/null \
    | grep -Ev '(-sources|-javadoc)\.jar$' \
    | sort -V \
    | tail -n1
}

JUNIT_LAUNCHER_JAR="$(latest_runtime_jar "$HOME/.m2/repository/org/junit/platform/junit-platform-launcher/*/junit-platform-launcher-*.jar" || true)"
BYTE_BUDDY_AGENT_JAR="$(latest_runtime_jar "$HOME/.m2/repository/net/bytebuddy/byte-buddy-agent/*/byte-buddy-agent-*.jar" || true)"

if [ -z "$JUNIT_LAUNCHER_JAR" ] || [ ! -f "$JUNIT_LAUNCHER_JAR" ]; then
  echo "junit-platform-launcher jar not found in ~/.m2. Run Maven tests once to populate dependencies." >&2
  exit 1
fi

JUNIT_PLATFORM_VERSION="$(basename "$JUNIT_LAUNCHER_JAR" | sed -E 's/^junit-platform-launcher-([0-9]+\.[0-9]+\.[0-9]+)\.jar$/\1/')"
CONSOLE_STANDALONE_JAR="$HOME/.m2/repository/org/junit/platform/junit-platform-console-standalone/$JUNIT_PLATFORM_VERSION/junit-platform-console-standalone-$JUNIT_PLATFORM_VERSION.jar"

if [ ! -f "$CONSOLE_STANDALONE_JAR" ]; then
  mvn -q org.apache.maven.plugins:maven-dependency-plugin:3.6.1:get \
    -Dartifact="org.junit.platform:junit-platform-console-standalone:$JUNIT_PLATFORM_VERSION"
fi

if [ ! -f "$CONSOLE_STANDALONE_JAR" ]; then
  echo "Failed to resolve junit-platform-console-standalone:$JUNIT_PLATFORM_VERSION" >&2
  exit 1
fi

if [ -z "$BYTE_BUDDY_AGENT_JAR" ] || [ ! -f "$BYTE_BUDDY_AGENT_JAR" ]; then
  echo "byte-buddy-agent jar not found in ~/.m2. Run Maven tests once to populate dependencies." >&2
  exit 1
fi

cd "$MODULE_PATH"

# Ensure compiled classes exist for selected test class.
mvn -q -DskipTests test-compile

CP_FILE="/tmp/java-maven-junit-cp-$$.txt"
trap 'rm -f "$CP_FILE"' EXIT
mvn -q -DincludeScope=test dependency:build-classpath -Dmdep.outputFile="$CP_FILE"

CP="$(cat "$CP_FILE"):target/test-classes:target/classes"

"$JAVA_BIN" \
  -ea \
  -XX:+EnableDynamicAgentLoading \
  -javaagent:"$BYTE_BUDDY_AGENT_JAR" \
  -Dfile.encoding=UTF-8 \
  -jar "$CONSOLE_STANDALONE_JAR" \
  --class-path "$CP" \
  --select-class "$TEST_CLASS" \
  --details tree
