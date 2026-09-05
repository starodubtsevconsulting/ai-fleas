#!/usr/bin/env bash
set -euo pipefail

AI_FLOW_PROJECT_DIR="${AI_FLOW_PROJECT_DIR:-}"
AI_FLOW_OUTPUT_DIR="${AI_FLOW_OUTPUT_DIR:-}"
ENSURE_TMUX_ONLY="false"

# GUI apps and non-login shells on macOS often omit Homebrew from PATH.
system_package_prefixes="${AI_SYSTEM_PACKAGE_PREFIXES:-/opt/homebrew /usr/local /home/linuxbrew/.linuxbrew}"
for package_prefix in "${HOMEBREW_PREFIX:-}" "${BREW_PREFIX:-}" $system_package_prefixes; do
  if [[ -n "$package_prefix" && -d "$package_prefix/bin" ]]; then
    PATH="$package_prefix/bin:$PATH"
  fi
done
export PATH

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
    --ensure-tmux)
      ENSURE_TMUX_ONLY="true"
      shift
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
if [ "${#ai_flow_args[@]}" -gt 0 ]; then
  set -- "${ai_flow_args[@]}"
else
  set --
fi
export AI_FLOW_PROJECT_DIR AI_FLOW_OUTPUT_DIR

if command -v tmux >/dev/null 2>&1; then
  echo "tmux is already installed."
  exit 0
fi

homebrew_candidates() {
  local candidate
  local candidates=()
  if [[ -n "${HOMEBREW_PREFIX:-}" ]]; then
    candidates+=("$HOMEBREW_PREFIX/bin/brew")
  fi
  if [[ -n "${BREW_PREFIX:-}" ]]; then
    candidates+=("$BREW_PREFIX/bin/brew")
  fi
  for candidate in $system_package_prefixes; do
    candidates+=("$candidate/bin/brew")
  done
  candidates+=(
    "${HOME:-}/.homebrew/bin/brew"
    "${HOME:-}/homebrew/bin/brew"
    "${HOME:-}/.linuxbrew/bin/brew"
    "${HOME:-}/.local/homebrew/bin/brew"
  )
  for candidate in "${candidates[@]}"; do
    [[ -n "$candidate" ]] && printf '%s\n' "$candidate"
  done
}

is_usable_homebrew() {
  local brew_bin="$1"
  [[ -x "$brew_bin" ]] || return 1
  "$brew_bin" shellenv >/dev/null 2>&1
}

find_homebrew() {
  local candidate
  if command -v brew >/dev/null 2>&1; then
    candidate="$(command -v brew)"
    if is_usable_homebrew "$candidate"; then
      printf '%s\n' "$candidate"
      return 0
    fi
  fi
  while IFS= read -r candidate; do
    if is_usable_homebrew "$candidate"; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done < <(homebrew_candidates)
  return 1
}

refresh_tmux_path_after_install() {
  local brew_bin="${1:-}"
  if [[ -n "$brew_bin" ]]; then
    eval "$("$brew_bin" shellenv)"
    export PATH="$(dirname "$brew_bin"):$PATH"
  fi
  export PATH="/opt/homebrew/bin:/usr/local/bin:/home/linuxbrew/.linuxbrew/bin:$PATH"
  hash -r 2>/dev/null || true
}

print_homebrew_diagnostics() {
  local candidate
  echo "Homebrew was not found on PATH or in known locations:" >&2
  while IFS= read -r candidate; do
    echo "  $candidate" >&2
  done < <(homebrew_candidates)
}

bootstrap_homebrew_on_darwin() {
  if [[ "$(uname -s)" != "Darwin" ]]; then
    return 1
  fi
  if find_homebrew >/dev/null 2>&1; then
    return 0
  fi
  if ! command -v curl >/dev/null 2>&1; then
    echo "curl is required to install Homebrew automatically." >&2
    return 1
  fi
  echo "Homebrew is required to install tmux on macOS. Installing Homebrew first." >&2
  if [[ -t 0 ]]; then
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  else
    NONINTERACTIVE=1 /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  fi
  local brew_bin
  brew_bin="$(find_homebrew || true)"
  if [[ -z "$brew_bin" ]]; then
    echo "Homebrew install finished, but brew was still not found." >&2
    print_homebrew_diagnostics
    return 1
  fi
  refresh_tmux_path_after_install "$brew_bin"
  find_homebrew >/dev/null 2>&1
}

detect_linux_installer() {
  if command -v apt-get >/dev/null 2>&1; then
    printf 'apt-get\n'
    return 0
  fi
  if command -v dnf >/dev/null 2>&1; then
    printf 'dnf\n'
    return 0
  fi
  if command -v yum >/dev/null 2>&1; then
    printf 'yum\n'
    return 0
  fi
  if command -v pacman >/dev/null 2>&1; then
    printf 'pacman\n'
    return 0
  fi
  return 1
}

detect_installer() {
  if [[ "$(uname -s)" == "Darwin" ]]; then
    if find_homebrew >/dev/null 2>&1 || bootstrap_homebrew_on_darwin >&2; then
      printf 'brew\n'
      return 0
    fi
    return 1
  fi
  detect_linux_installer && return 0
  if find_homebrew >/dev/null 2>&1; then
    printf 'brew\n'
    return 0
  fi
  return 1
}

run_install() {
  local installer="$1"
  case "$installer" in
    brew)
      local brew_bin
      brew_bin="$(find_homebrew)"
      "$brew_bin" install tmux
      refresh_tmux_path_after_install "$brew_bin"
      ;;
    apt-get)
      if [ "$(id -u)" -eq 0 ]; then
        apt-get update
        apt-get install -y tmux
      else
        sudo apt-get update
        sudo apt-get install -y tmux
      fi
      ;;
    dnf)
      if [ "$(id -u)" -eq 0 ]; then
        dnf install -y tmux
      else
        sudo dnf install -y tmux
      fi
      ;;
    yum)
      if [ "$(id -u)" -eq 0 ]; then
        yum install -y tmux
      else
        sudo yum install -y tmux
      fi
      ;;
    pacman)
      if [ "$(id -u)" -eq 0 ]; then
        pacman -Sy --noconfirm tmux
      else
        sudo pacman -Sy --noconfirm tmux
      fi
      ;;
    *)
      echo "Unsupported installer: $installer" >&2
      exit 1
      ;;
  esac
}

installer="$(detect_installer || true)"
if [ -z "$installer" ]; then
  echo "tmux is required, but no supported installer was detected (brew, apt-get, dnf, yum, pacman)." >&2
  print_homebrew_diagnostics
  exit 1
fi

if [ -t 0 ] && [ -t 1 ]; then
  printf 'tmux is not installed. Install it now using %s? [Y/n]: ' "$installer"
  read -r answer || true
  case "${answer:-Y}" in
    n|N)
      echo "tmux installation declined." >&2
      exit 1
      ;;
  esac
elif [ "$ENSURE_TMUX_ONLY" != "true" ]; then
  echo "tmux is not installed and no interactive terminal is available to confirm installation." >&2
  exit 1
fi

run_install "$installer"

if command -v tmux >/dev/null 2>&1; then
  echo "tmux installed successfully."
  exit 0
fi

if [[ "$(uname -s)" == "Darwin" ]]; then
  echo 'tmux installation command completed, but tmux is still not on PATH. Try opening a new terminal, or run: eval "$(brew shellenv)"' >&2
else
  echo "tmux installation command completed, but tmux is still not on PATH." >&2
fi
exit 1
