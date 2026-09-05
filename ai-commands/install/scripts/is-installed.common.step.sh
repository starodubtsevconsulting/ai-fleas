#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage: $0 <module_dir>" >&2
}

if [ "$#" -ne 1 ]; then
  usage
  exit 2
fi

module_dir="$1"
module_name="$(basename "$module_dir")"

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
checker="$root_dir/scripts/is-installed.step.sh"

if [ -f "$module_dir/is-installed.step.sh" ]; then
  bash "$module_dir/is-installed.step.sh"
  exit $?
fi

case "$module_name" in
  docker)
    bash "$checker" --cmd docker
    ;;
  git)
    bash "$checker" --cmd gh
    ;;
  java)
    bash "$checker" --path "$HOME/java/current/bin/java"
    ;;
  maven)
    bash "$checker" --path "$HOME/maven/current/bin/mvn"
    ;;
  nodejs)
    bash "$checker" --path "$HOME/node/current/bin/node"
    ;;
  python)
    bash "$checker" --path "$HOME/python/current/bin/python3"
    ;;
  sbt)
    bash "$checker" --path "$HOME/sbt/current/bin/sbt"
    ;;
  terminal)
    bash "$checker" --cmd zsh
    ;;
  vim)
    bash "$checker" --all --cmd vim --file "$HOME/.vimrc"
    ;;
  *)
    exit 1
    ;;
esac
