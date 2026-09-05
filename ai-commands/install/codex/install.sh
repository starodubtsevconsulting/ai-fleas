#!/usr/bin/env bash
set -euo pipefail

NPM_PREFIX="${CODEX_NPM_PREFIX:-$HOME/.npm-global}"
export PATH="$NPM_PREFIX/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"

if [[ -x "/Applications/ChatGPT.app/Contents/Resources/codex" ]]; then
  echo "Codex CLI is available from the ChatGPT application."
  exit 0
fi

if command -v codex >/dev/null 2>&1; then
  echo "Codex CLI is already installed."
  exit 0
fi

find_brew() {
  local candidate
  for candidate in "$(command -v brew 2>/dev/null || true)" /opt/homebrew/bin/brew /usr/local/bin/brew; do
    if [[ -n "$candidate" && -x "$candidate" ]]; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done
  return 1
}

if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  brew_bin="$(find_brew || true)"
  if [[ -z "$brew_bin" ]]; then
    echo "Node.js and npm are required, and Homebrew was not found." >&2
    echo "Run the terminal installer first or install Node.js manually." >&2
    exit 1
  fi
  echo "Node.js is required to install Codex CLI. Installing Node.js with Homebrew."
  "$brew_bin" install node
  export PATH="$(dirname "$brew_bin"):$PATH"
fi

echo "Installing Codex CLI into $NPM_PREFIX."
mkdir -p "$NPM_PREFIX"
npm install --global --prefix "$NPM_PREFIX" @openai/codex
export PATH="$NPM_PREFIX/bin:$PATH"

if ! command -v codex >/dev/null 2>&1; then
  echo "Codex CLI installation completed, but codex was not found at $NPM_PREFIX/bin." >&2
  exit 1
fi

echo "Codex CLI installed successfully."
