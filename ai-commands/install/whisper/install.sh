#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root_dir="$(cd "$script_dir/.." && pwd)"
config_file="${AI_COMMAND_CONFIG_PATH:-}"
[[ -n "$config_file" && -f "$config_file" ]] || { echo 'Profile-owned Whisper config required.' >&2; exit 2; }
# shellcheck disable=SC1091
source "$root_dir/scripts/report-log.sh"
report_log_init "whisper/install.sh" "$root_dir"

if [ -f "$config_file" ]; then
  # shellcheck disable=SC1090
  source "$config_file"
fi

feature_install_edge_tts="${WHISPER_FEATURE_INSTALL_EDGE_TTS:-1}"
feature_install_espeak="${WHISPER_FEATURE_INSTALL_ESPEAK_NG:-1}"
feature_install_player="${WHISPER_FEATURE_INSTALL_PLAYER:-1}"
feature_autorun_smoke="${WHISPER_FEATURE_AUTORUN_SMOKE_TEST:-1}"
public_pypi_url="${WHISPER_PIP_PUBLIC_INDEX_URL:-https://pypi.org/simple}"

if ! "$script_dir/../scripts/confirm-reinstall.sh" "Whisper CLI" "command -v whisper"; then
  exit 0
fi

need_cmd() {
  command -v "$1" >/dev/null 2>&1
}

pip_install_user_with_fallback() {
  local package_name="$1"
  if python3 -m pip install --user --upgrade "$package_name"; then
    return 0
  fi
  echo "Default pip index failed for $package_name; retrying against public PyPI: $public_pypi_url"
  PIP_INDEX_URL="$public_pypi_url" python3 -m pip install --user --upgrade "$package_name"
}

pipx_install_with_fallback() {
  local package_name="$1"
  if pipx install --force "$package_name"; then
    return 0
  fi
  echo "pipx install failed for $package_name; trying user pip fallback."
  pip_install_user_with_fallback "$package_name"
}

apt_packages=(ffmpeg python3 python3-pip python3-venv pipx)
if [ "$feature_install_espeak" = "1" ]; then
  apt_packages+=(espeak-ng)
fi
if [ "$feature_install_player" = "1" ]; then
  apt_packages+=(mpv)
fi

if need_cmd sudo && sudo -n true >/dev/null 2>&1; then
  bash "$script_dir/../scripts/apt-update.sh"
  sudo apt install -y "${apt_packages[@]}"
else
  echo "Skipping sudo apt install (no noninteractive sudo)."
  echo "Required system packages must already exist or be installed manually: ${apt_packages[*]}"
fi

if command -v pipx >/dev/null 2>&1; then
  pipx ensurepath >/dev/null 2>&1 || true
  pipx_install_with_fallback openai-whisper
  if [ "$feature_install_edge_tts" = "1" ]; then
    pipx_install_with_fallback edge-tts
  fi
else
  pip_install_user_with_fallback openai-whisper
  if [ "$feature_install_edge_tts" = "1" ]; then
    pip_install_user_with_fallback edge-tts
  fi
fi

mkdir -p "$HOME/bin"
if ! command -v whisper >/dev/null 2>&1 && [ -x "$HOME/.local/bin/whisper" ]; then
  ln -sfn "$HOME/.local/bin/whisper" "$HOME/bin/whisper"
fi
if [ "$feature_install_edge_tts" = "1" ] && ! command -v edge-tts >/dev/null 2>&1 && [ -x "$HOME/.local/bin/edge-tts" ]; then
  ln -sfn "$HOME/.local/bin/edge-tts" "$HOME/bin/edge-tts"
fi

ln -sfn "$script_dir/text-to-audio.sh" "$HOME/bin/whisper-text-to-audio"
ln -sfn "$script_dir/smoke-test.sh" "$HOME/bin/whisper-smoke-test"
ln -sfn "$script_dir/play-audio.sh" "$HOME/bin/whisper-play-audio"
chmod +x "$script_dir/text-to-audio.sh" "$script_dir/smoke-test.sh" "$script_dir/play-audio.sh"

if ! command -v whisper >/dev/null 2>&1; then
  echo "Whisper install failed: whisper command not found in PATH."
  echo "Try opening a new shell so PATH updates are applied."
  exit 1
fi
if [ "$feature_install_edge_tts" = "1" ] && ! command -v edge-tts >/dev/null 2>&1 && [ "$require_neural" = "1" ]; then
  echo "Whisper install incomplete: edge-tts command not found in PATH."
  echo "Try opening a new shell so PATH updates are applied, or set PIP_INDEX_URL=https://pypi.org/simple and rerun install.sh."
  exit 1
fi

if [ "$feature_autorun_smoke" = "1" ]; then
  echo "Running Whisper smoke test..."
  WHISPER_SMOKE_SKIP_INSTALL_LOG_STATUS=1 "$script_dir/smoke-test.sh"
fi

echo "Whisper installed successfully."
echo
echo "=== README ==="
cat "$script_dir/README.md"
