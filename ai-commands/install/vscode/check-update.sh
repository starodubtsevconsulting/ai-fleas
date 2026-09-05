#!/usr/bin/env bash
set -euo pipefail

find_installed_code() {
  if [ -x "$HOME/vscode/bin/code" ]; then
    echo "$HOME/vscode/bin/code"
  elif [ -x "$HOME/vscode/code" ]; then
    echo "$HOME/vscode/code"
  elif [ -x "$HOME/vscode/current/bin/code" ]; then
    echo "$HOME/vscode/current/bin/code"
  elif [ -x "$HOME/vscode/current/code" ]; then
    echo "$HOME/vscode/current/code"
  elif command -v code >/dev/null 2>&1; then
    command -v code
  fi
}

installed_code="$(find_installed_code || true)"
installed_version=""
if [ -n "$installed_code" ]; then
  installed_version="$($installed_code --version 2>/dev/null | head -n1 | tr -d '\r')"
fi

latest_version=""
if command -v curl >/dev/null 2>&1; then
  latest_version=$(curl -fsSL https://update.code.visualstudio.com/api/releases/stable 2>/dev/null | sed -E 's/^\["([^"]+)".*$/\1/') || true
elif command -v wget >/dev/null 2>&1; then
  latest_version=$(wget -qO- https://update.code.visualstudio.com/api/releases/stable 2>/dev/null | sed -E 's/^\["([^"]+)".*$/\1/') || true
fi

if [ -z "$installed_version" ]; then
  echo "VS Code not installed"
  exit 2
fi

if [ -z "$latest_version" ]; then
  echo "Unable to determine latest VS Code version"
  echo "Installed: $installed_version"
  exit 3
fi

if [ "$installed_version" = "$latest_version" ]; then
  echo "VS Code is up-to-date: $installed_version"
  exit 0
fi

newer=$(printf '%s\n%s\n' "$installed_version" "$latest_version" | sort -V | tail -n1)
if [ "$newer" = "$installed_version" ]; then
  echo "Installed VS Code is newer than latest: $installed_version (latest $latest_version)"
  exit 0
fi

echo "Update available: $installed_version -> $latest_version"
exit 1
