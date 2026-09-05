#!/usr/bin/env bash
set -euo pipefail

JAVA_HOME_BASE="${JAVA_HOME_BASE:-$HOME/java}"
JAVA_MAJOR="21"
SWITCH_CURRENT="false"
FORCE="false"

usage() {
  cat <<'EOF'
Usage: ./commands/install/java/java.sh [--major N] [--switch] [--force]

Installs AWS Corretto JDK N into ~/java/N-aws. Use --switch to update
~/java/current to the installed version for this shell profile layout.
EOF
}

while [ $# -gt 0 ]; do
  case "$1" in
    --major)
      if [ $# -lt 2 ]; then
        echo "Missing value for --major" >&2
        exit 2
      fi
      JAVA_MAJOR="$2"
      shift 2
      ;;
    --switch)
      SWITCH_CURRENT="true"
      shift
      ;;
    --force)
      FORCE="true"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

case "$JAVA_MAJOR" in
  ''|*[!0-9]*)
    echo "--major must be a Java major version number" >&2
    exit 2
    ;;
esac

for tool in curl tar awk uname; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "Missing required tool: $tool" >&2
    exit 1
  fi
done

arch="$(uname -m)"
case "$arch" in
  x86_64)
    corretto_arch="x64"
    ;;
  aarch64|arm64)
    corretto_arch="aarch64"
    ;;
  *)
    echo "Unsupported architecture: $arch" >&2
    exit 1
    ;;
esac

target_dir="$JAVA_HOME_BASE/${JAVA_MAJOR}-aws"
if [ -x "$target_dir/bin/java" ] && [ "$FORCE" != "true" ]; then
  echo "Java $JAVA_MAJOR is already installed at $target_dir"
else
  workdir="$(mktemp -d)"
  cleanup() {
    rm -rf "$workdir"
  }
  trap cleanup EXIT

  url="https://corretto.aws/downloads/latest/amazon-corretto-${JAVA_MAJOR}-${corretto_arch}-linux-jdk.tar.gz"
  tarball="amazon-corretto-${JAVA_MAJOR}-${corretto_arch}-linux-jdk.tar.gz"

  cd "$workdir"
  curl -fsSLO "$url"
  tar -xzf "$tarball"
  extracted_dir="$(tar -tzf "$tarball" | awk -F/ 'NR==1 { print $1 }')"
  if [ -z "$extracted_dir" ] || [ ! -d "$extracted_dir" ]; then
    echo "Failed to extract Corretto $JAVA_MAJOR" >&2
    exit 1
  fi

  mkdir -p "$JAVA_HOME_BASE"
  rm -rf "$target_dir"
  mv "$extracted_dir" "$target_dir"
fi

confs_switch="$HOME/confs/java/switch.sh"
if [ -f "$confs_switch" ]; then
  cp "$confs_switch" "$JAVA_HOME_BASE/switch.sh"
  chmod +x "$JAVA_HOME_BASE/switch.sh"
  mkdir -p "$HOME/bin"
  ln -sfn "$JAVA_HOME_BASE/switch.sh" "$HOME/bin/java-switch"
fi

if [ "$SWITCH_CURRENT" = "true" ]; then
  ln -sfn "$target_dir" "$JAVA_HOME_BASE/current"
fi

"$target_dir/bin/java" -version
if [ "$SWITCH_CURRENT" = "true" ]; then
  echo "Now using: $JAVA_HOME_BASE/current"
fi
