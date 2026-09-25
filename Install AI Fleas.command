#!/bin/zsh
set -euo pipefail

repository_root="$(cd "$(dirname "$0")" && pwd -P)"

case "$(uname -s)" in
  Darwin)
    exec "$repository_root/platforms/gpt-agents/macos/install-app.sh"
    ;;
  *)
    print -u2 "AI Fleas does not have an installer for this operating system yet."
    exit 1
    ;;
esac
