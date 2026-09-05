#!/usr/bin/env bash
set -euo pipefail

python_home="$HOME/python/current/bin/python3"
python_cmd=""

if [ -x "$python_home" ]; then
  python_cmd="$python_home"
elif command -v python3 >/dev/null 2>&1; then
  python_cmd="python3"
else
  echo "Python not found. Install it first (./install.sh)."
  exit 1
fi

usage() {
  echo "Usage: $0 [path]"
  echo "If no path is given, you will be prompted."
}

if [ "${1-}" = "-h" ] || [ "${1-}" = "--help" ]; then
  usage
  exit 0
fi

venv_path="${1-}"

if [ -z "$venv_path" ]; then
  printf "Create venv in current directory? [Y/NO]: "
  read -r choice
  if [ "${choice^^}" = "Y" ]; then
    venv_path=".venv"
  else
    printf "Enter venv path: "
    read -r venv_path
  fi
fi

if [ -z "$venv_path" ]; then
  echo "No path provided."
  exit 1
fi

"$python_cmd" -m venv "$venv_path"

activate_hint="$venv_path/bin/activate"
if [ ! -f "$activate_hint" ] && [ -f "$PWD/$activate_hint" ]; then
  activate_hint="$PWD/$activate_hint"
fi

echo "Venv created at: $venv_path"
echo "Activate: source $activate_hint"
