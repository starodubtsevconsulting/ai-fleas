#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$script_dir/scripts/report-log.sh"
report_log_init "check.sh" "$script_dir"
matrix_file="$script_dir/v_matrix.json"

missing_count=0

has_cmd() {
  command -v "$1" >/dev/null 2>&1
}

print_item() {
  local label="$1"
  local status="$2"
  local note="${3-}"
  local mark="[ ]"
  local tag="$status"

  case "$status" in
    OK)
      mark="[x]"
      tag="OK"
      ;;
    MISSING)
      mark="[ ]"
      tag="MISSING"
      missing_count=$((missing_count + 1))
      ;;
    *)
      mark="[~]"
      tag="$status"
      ;;
  esac

  if [ -n "$note" ]; then
    printf "  %s %s - %s (%s)\n" "$mark" "$label" "$tag" "$note"
  else
    printf "  %s %s - %s\n" "$mark" "$label" "$tag"
  fi
}

echo "Terminal"
if has_cmd zsh; then
  print_item "zsh" "OK"
else
  print_item "zsh" "MISSING"
fi

zsh_path="$(command -v zsh || true)"
current_shell="$(getent passwd "$USER" | cut -d: -f7 || true)"
if [ -n "$zsh_path" ] && [ "$current_shell" = "$zsh_path" ]; then
  print_item "default shell" "OK"
else
  print_item "default shell" "NOT DEFAULT"
fi

if [ -f /usr/share/zsh-autosuggestions/zsh-autosuggestions.zsh ]; then
  print_item "zsh autosuggestions" "OK"
else
  print_item "zsh autosuggestions" "MISSING"
fi

if [ -f /usr/share/zsh-syntax-highlighting/zsh-syntax-highlighting.zsh ]; then
  print_item "zsh syntax highlighting" "OK"
else
  print_item "zsh syntax highlighting" "MISSING"
fi

if has_cmd fzf; then
  print_item "fzf" "OK"
else
  print_item "fzf" "MISSING"
fi

if has_cmd bat || has_cmd batcat; then
  print_item "bat" "OK"
else
  print_item "bat" "MISSING"
fi

if has_cmd eza; then
  print_item "eza" "OK"
else
  print_item "eza" "MISSING"
fi

echo
echo "Git"
if has_cmd gh; then
  print_item "gh" "OK"
else
  print_item "gh" "MISSING"
fi

echo
echo "Vim"
if has_cmd vim; then
  print_item "vim" "OK"
else
  print_item "vim" "MISSING"
fi

if [ -f "$HOME/.vimrc" ]; then
  print_item "vimrc" "OK"
else
  print_item "vimrc" "MISSING"
fi

if [ -f "$HOME/.vim/autoload/plug.vim" ]; then
  print_item "vim-plug" "OK"
else
  print_item "vim-plug" "MISSING"
fi

if [ -d "$HOME/.vim/plugged" ]; then
  print_item "plugins dir" "OK"
else
  print_item "plugins dir" "MISSING"
fi

echo
echo "IDE"
if has_cmd code; then
  print_item "VS Code" "OK"
else
  vscode_home="$HOME/vscode"
  if [ -x "${vscode_home}/bin/code" ] || [ -x "${vscode_home}/code" ]; then
    print_item "VS Code" "OK" "home"
  else
    print_item "VS Code" "MISSING"
  fi
fi

if has_cmd zed; then
  print_item "Zed" "OK"
else
  if [ -x "$HOME/.local/bin/zed" ]; then
    print_item "Zed" "OK" "home"
  else
    print_item "Zed" "MISSING"
  fi
fi

echo
echo "Docker"
if has_cmd docker; then
  print_item "docker" "OK"
else
  print_item "docker" "MISSING"
fi

if has_cmd docker && docker compose version >/dev/null 2>&1; then
  print_item "docker compose plugin" "OK"
else
  print_item "docker compose plugin" "MISSING"
fi

if getent group docker >/dev/null 2>&1; then
  if id -nG "$USER" | grep -qw docker; then
    print_item "docker group" "OK"
  else
    print_item "docker group" "NOT ADDED"
  fi
else
  print_item "docker group" "MISSING"
fi

echo
echo "Python"
python_home="$HOME/python"
python_current="${python_home}/current/bin/python3"
pip_current="${python_home}/current/bin/pip3"

if [ -x "$python_current" ]; then
  python_version="$("$python_current" -c 'import sys; print(".".join(map(str, sys.version_info[:3])))')"
  print_item "python3" "OK" "$python_version"
else
  if has_cmd python3; then
    print_item "python3" "SYSTEM"
  else
    print_item "python3" "MISSING"
  fi
fi

if [ -x "$pip_current" ]; then
  print_item "pip3" "OK" "home"
else
  if has_cmd pip3; then
    print_item "pip3" "SYSTEM"
  else
    print_item "pip3" "MISSING"
  fi
fi

if [ -x "$python_current" ] && "$python_current" -m venv --help >/dev/null 2>&1; then
  print_item "venv module" "OK"
else
  print_item "venv module" "MISSING"
fi

if [ -d "${python_home}/3.12" ]; then
  print_item "python 3.12 dir" "OK"
else
  print_item "python 3.12 dir" "MISSING"
fi

echo
echo "Java"
java_home="$HOME/java"
java_current="${java_home}/current/bin/java"
javac_current="${java_home}/current/bin/javac"

if [ -x "$java_current" ]; then
  java_major="$("$java_current" -version 2>&1 | head -n1 | sed -E 's/.*"([0-9]+).*/\1/')"
  print_item "java" "OK" "${java_major:-unknown}"
else
  if has_cmd java; then
    print_item "java" "SYSTEM"
  else
    print_item "java" "MISSING"
  fi
fi

if [ -x "$javac_current" ]; then
  javac_major="$("$javac_current" -version 2>&1 | awk '{print $2}' | cut -d. -f1)"
  print_item "javac" "OK" "${javac_major:-unknown}"
else
  if has_cmd javac; then
    print_item "javac" "SYSTEM"
  else
    print_item "javac" "MISSING"
  fi
fi

if [ -d "${java_home}/21-aws" ]; then
  print_item "java 21 dir" "OK"
else
  print_item "java 21 dir" "MISSING"
fi

if [ -d "${java_home}/latest-aws" ]; then
  print_item "java latest dir" "OK"
else
  print_item "java latest dir" "MISSING"
fi

echo
echo "Maven"
maven_home="$HOME/maven"
mvn_current="${maven_home}/current/bin/mvn"
expected_maven_version="3.9.9"
if [ -f "$matrix_file" ] && command -v python3 >/dev/null 2>&1; then
  expected_from_matrix="$(python3 - "$matrix_file" <<'PY'
import json, sys
path = sys.argv[1]
with open(path, "r", encoding="utf-8") as fh:
    data = json.load(fh)
ver = data.get("default_maven_version")
if ver:
    print(ver)
PY
)"
  expected_from_matrix="${expected_from_matrix//$'\r'/}"
  if [ -n "$expected_from_matrix" ]; then
    expected_maven_version="$expected_from_matrix"
  fi
fi

if [ -x "$mvn_current" ]; then
  maven_version="$( (set +o pipefail; "$mvn_current" -v 2>/dev/null | head -n1 | awk '{print $3}') || true)"
  print_item "mvn" "OK" "${maven_version:-unknown}"
else
  if has_cmd mvn; then
    print_item "mvn" "SYSTEM"
  else
    print_item "mvn" "MISSING"
  fi
fi

if [ -d "${maven_home}/${expected_maven_version}" ]; then
  print_item "maven ${expected_maven_version} dir" "OK"
else
  print_item "maven ${expected_maven_version} dir" "MISSING"
fi

if [ -x "${maven_home}/switch.sh" ]; then
  print_item "maven switch.sh" "OK"
else
  print_item "maven switch.sh" "MISSING"
fi

echo
echo "Scala"
scala_home="$HOME/scala"
scala_current="${scala_home}/current/bin/scala"
default_scala_version="3.4.1"
expected_scala_version="$default_scala_version"
if [ -f "$matrix_file" ] && command -v python3 >/dev/null 2>&1; then
  codename="$(. /etc/os-release && echo "$VERSION_CODENAME")"
  expected_from_matrix="$(python3 - "$matrix_file" "$codename" <<'PY'
import json
import sys

path = sys.argv[1]
codename = sys.argv[2]

with open(path, "r", encoding="utf-8") as fh:
    data = json.load(fh)

ver = data.get("default_scala_version")
for entry in data.get("ubuntu_to_scala", []):
    if entry.get("codename") == codename and entry.get("recommended_version"):
        ver = entry["recommended_version"]
        break

if ver:
    print(ver)
PY
)"
  expected_from_matrix="${expected_from_matrix//$'\r'/}"
  if [ -n "$expected_from_matrix" ]; then
    expected_scala_version="$expected_from_matrix"
  fi
fi

if [ -x "$scala_current" ]; then
  scala_version="$( (set +o pipefail; "$scala_current" -version 2>&1 | grep -oE '[0-9]+([.][0-9]+)*' | head -n1) || true)"
  print_item "scala" "OK" "${scala_version:-unknown}"
else
  if has_cmd scala; then
    print_item "scala" "SYSTEM"
  else
    print_item "scala" "MISSING"
  fi
fi

if [ -d "${scala_home}/${expected_scala_version}" ]; then
  print_item "scala ${expected_scala_version} dir" "OK"
else
  print_item "scala ${expected_scala_version} dir" "MISSING"
fi

if [ -d "${scala_home}/latest" ]; then
  print_item "scala latest dir" "OK"
else
  print_item "scala latest dir" "MISSING"
fi

echo
echo "sbt"
sbt_home="$HOME/sbt"
sbt_current="${sbt_home}/current/bin/sbt"
if [ -x "$sbt_current" ]; then
  sbt_version="$( (set +o pipefail; "$sbt_current" --version 2>/dev/null | grep -oE '[0-9]+([.][0-9]+)*' | head -n1) || true)"
  print_item "sbt" "OK" "${sbt_version:-unknown}"
else
  print_item "sbt" "MISSING"
fi
if [ -x "${scala_home}/switch.sh" ]; then
  print_item "scala switch.sh" "OK"
else
  print_item "scala switch.sh" "MISSING"
fi

echo
echo "Node.js"
node_home="$HOME/node"
node_current="${node_home}/current/bin/node"

if [ -x "$node_current" ]; then
  node_version="$("$node_current" -v 2>/dev/null | sed -E 's/^v//')"
  print_item "node" "OK" "${node_version:-unknown}"
else
  if has_cmd node; then
    print_item "node" "SYSTEM"
  else
    print_item "node" "MISSING"
  fi
fi

if [ -d "${node_home}/22" ]; then
  print_item "node 22 dir" "OK"
else
  print_item "node 22 dir" "MISSING"
fi

if [ -x "${node_home}/switch.sh" ]; then
  print_item "node switch.sh" "OK"
else
  print_item "node switch.sh" "MISSING"
fi

echo
if [ "$missing_count" -eq 0 ]; then
  echo "All good. Nothing to install."
else
  echo "Missing: $missing_count"
fi
