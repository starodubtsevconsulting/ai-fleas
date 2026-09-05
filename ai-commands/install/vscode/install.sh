#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root_dir="$(cd "$script_dir/.." && pwd)"
# shellcheck disable=SC1091
source "$root_dir/scripts/report-log.sh"
report_log_init "vscode/install.sh" "$root_dir"

EXTENSIONS_ONLY=0
SINGLE_EXTENSION=""

usage() {
  cat <<'USAGE'
Usage:
  ./install.sh
  ./install.sh --extensions-only
  ./install.sh --extension <publisher.extensionId>
  ./install.sh --extensions-only --extension <publisher.extensionId>
USAGE
}

while [ $# -gt 0 ]; do
  case "$1" in
    --extensions-only)
      EXTENSIONS_ONLY=1
      shift
      ;;
    --extension)
      SINGLE_EXTENSION="${2:-}"
      if [ -z "$SINGLE_EXTENSION" ]; then
        echo "Missing extension id after --extension" >&2
        exit 1
      fi
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

resolve_code_bin() {
  if [ -x "$HOME/vscode/bin/code" ]; then
    printf '%s\n' "$HOME/vscode/bin/code"
    return 0
  fi
  if [ -x "$HOME/vscode/code" ]; then
    printf '%s\n' "$HOME/vscode/code"
    return 0
  fi
  if [ -x "$HOME/vscode/current/bin/code" ]; then
    printf '%s\n' "$HOME/vscode/current/bin/code"
    return 0
  fi
  if [ -x "$HOME/vscode/current/code" ]; then
    printf '%s\n' "$HOME/vscode/current/code"
    return 0
  fi
  if command -v code >/dev/null 2>&1; then
    command -v code
    return 0
  fi
  return 1
}

install_extensions() {
  local code_bin="$1"
  local extensions_file="$script_dir/extensions.txt"
  local ext=""

  if [ -n "$SINGLE_EXTENSION" ]; then
    echo "Installing VS Code extension: $SINGLE_EXTENSION"
    "$code_bin" --install-extension "$SINGLE_EXTENSION" --force
    return 0
  fi

  if [ ! -f "$extensions_file" ]; then
    echo "Missing extensions list: $extensions_file" >&2
    return 1
  fi

  while IFS= read -r ext; do
    ext="$(printf "%s" "$ext" | sed -E 's/#.*$//g' | xargs)"
    [ -z "$ext" ] && continue
    "$code_bin" --install-extension "$ext" --force || true
  done < "$extensions_file"
}

if [ "$EXTENSIONS_ONLY" -eq 1 ]; then
  code_bin="$(resolve_code_bin || true)"
  if [ -z "$code_bin" ]; then
    echo "VS Code launcher not found. Install VS Code first or ensure 'code' is on PATH." >&2
    exit 1
  fi
  install_extensions "$code_bin"
  if [ -n "$SINGLE_EXTENSION" ]; then
    echo "Installed extension via existing VS Code: $SINGLE_EXTENSION"
  else
    echo "Installed managed VS Code extensions via existing VS Code launcher."
  fi
  exit 0
fi

installed_version=""
if command -v "$script_dir/check-update.sh" >/dev/null 2>&1; then
  check_output="$($script_dir/check-update.sh)"
  check_status=$?
  if [ $check_status -eq 0 ]; then
    installed_version=$(printf "%s" "$check_output" | sed -E 's/^.*: //')
    echo "$check_output"
    printf "Reinstall anyway? [Y/NO]: "
    read -r choice
    if [ "${choice^^}" != "Y" ]; then
      exit 0
    fi
  elif [ $check_status -eq 1 ]; then
    echo "$check_output"
    printf "Install update? [Y/NO]: "
    read -r choice
    if [ "${choice^^}" != "Y" ]; then
      exit 0
    fi
  elif [ $check_status -eq 2 ]; then
    :
  else
    echo "$check_output"
  fi
fi

home_code=""
if [ -x "$HOME/vscode/bin/code" ]; then
  home_code="$HOME/vscode/bin/code"
elif [ -x "$HOME/vscode/code" ]; then
  home_code="$HOME/vscode/code"
elif [ -x "$HOME/vscode/current/bin/code" ]; then
  home_code="$HOME/vscode/current/bin/code"
elif [ -x "$HOME/vscode/current/code" ]; then
  home_code="$HOME/vscode/current/code"
fi

system_code=""
if command -v code >/dev/null 2>&1; then
  system_code="$(command -v code)"
fi

if [ -n "$system_code" ] && [ -z "$home_code" ]; then
  echo "System VS Code detected at: $system_code"
  printf "Remove system VS Code and install home-based version? [Y/NO]: "
  read -r choice
  if [ "${choice^^}" = "Y" ]; then
    removed=0
    if command -v snap >/dev/null 2>&1 && snap list 2>/dev/null | awk '{print $1}' | grep -qx "code"; then
      sudo snap remove code && removed=1 || true
    fi
    if dpkg -s code >/dev/null 2>&1; then
      sudo apt remove -y code && removed=1 || true
    fi
    if [ "$removed" -eq 0 ]; then
      echo "Unable to remove system VS Code automatically. Please remove it manually and rerun." >&2
      exit 1
    fi
  else
    echo "Skipped. Remove system VS Code to proceed with home-based install."
    exit 0
  fi
fi

vscode_home="$HOME/vscode"
mkdir -p "$vscode_home"

arch="$(uname -m)"
case "$arch" in
  x86_64)
    platform="linux-x64"
    ;;
  aarch64|arm64)
    platform="linux-arm64"
    ;;
  *)
    echo "Unsupported architecture for VS Code: $arch" >&2
    exit 1
    ;;
esac

if command -v curl >/dev/null 2>&1; then
  downloader="curl"
elif command -v wget >/dev/null 2>&1; then
  downloader="wget"
else
  bash "$script_dir/../scripts/apt-update.sh"
  sudo apt install -y curl
  downloader="curl"
fi

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT
archive="${tmp_dir}/vscode.tar.gz"
url="https://update.code.visualstudio.com/latest/${platform}/stable"

if [ "$downloader" = "curl" ]; then
  curl -fL "$url" -o "$archive"
else
  wget -qO "$archive" "$url"
fi

if [ -d "$vscode_home" ] && [ -n "$(ls -A "$vscode_home" 2>/dev/null)" ]; then
  rm -rf "$vscode_home"/* "$vscode_home"/.[!.]* "$vscode_home"/..?* 2>/dev/null || true
fi
tar -xzf "$archive" -C "$vscode_home" --strip-components=1

local_bin="$HOME/.local/bin"
mkdir -p "$local_bin"

if [ -x "$vscode_home/bin/code" ]; then
  ln -sfn "$vscode_home/bin/code" "$local_bin/code"
elif [ -x "$vscode_home/code" ]; then
  ln -sfn "$vscode_home/code" "$local_bin/code"
else
  echo "VS Code installed, but 'code' launcher not found." >&2
fi

extensions_file="$script_dir/extensions.txt"
code_bin="$vscode_home/bin/code"
if [ ! -x "$code_bin" ]; then
  code_bin="$vscode_home/code"
fi
if [ -x "$code_bin" ]; then
  if [ -z "$SINGLE_EXTENSION" ]; then
    if [ -d "$HOME/.vscode/extensions" ]; then
      rm -rf "$HOME/.vscode/extensions"
    fi
    if [ -d "$HOME/.config/Code" ]; then
      rm -rf "$HOME/.config/Code"
    fi
  fi
  install_extensions "$code_bin"
fi

if [ -f "$vscode_home/chrome-sandbox" ]; then
  sudo chown root:root "$vscode_home/chrome-sandbox"
  sudo chmod 4755 "$vscode_home/chrome-sandbox"
fi

desktop_dir="$HOME/.local/share/applications"
mkdir -p "$desktop_dir"
icon_path="$vscode_home/resources/app/resources/linux/code.png"
exec_path="$vscode_home/bin/code"
if [ ! -x "$exec_path" ]; then
  exec_path="$vscode_home/code"
fi

cat <<DESKTOP > "$desktop_dir/code.desktop"
[Desktop Entry]
Name=Visual Studio Code
Comment=Code Editing. Redefined.
Exec=$exec_path
Icon=$icon_path
Type=Application
Categories=Development;IDE;
Terminal=false
StartupWMClass=Code
DESKTOP

desktop_link_dir="$HOME/Desktop"
if [ -d "$desktop_link_dir" ]; then
  ln -sfn "$desktop_dir/code.desktop" "$desktop_link_dir/Visual Studio Code.desktop"
fi

if ! grep -q "# LOCAL_BIN_START" "$HOME/.profile" 2>/dev/null; then
  {
    echo ""
    echo "# LOCAL_BIN_START"
    echo "export PATH=\"\$HOME/.local/bin:\$PATH\""
    echo "# LOCAL_BIN_END"
  } >> "$HOME/.profile"
fi
if ! grep -q "# LOCAL_BIN_START" "$HOME/.zshrc" 2>/dev/null; then
  {
    echo ""
    echo "# LOCAL_BIN_START"
    echo "export PATH=\"\$HOME/.local/bin:\$PATH\""
    echo "# LOCAL_BIN_END"
  } >> "$HOME/.zshrc"
fi

echo "Visual Studio Code installed in $vscode_home."
echo "Launch with: code (or $vscode_home/bin/code)"
echo
if [ -n "$SINGLE_EXTENSION" ]; then
  echo "Installed requested extension during install: $SINGLE_EXTENSION"
else
  echo "Installed managed VS Code extensions from $extensions_file"
fi
echo "=== README ==="
cat "$script_dir/README.md"
