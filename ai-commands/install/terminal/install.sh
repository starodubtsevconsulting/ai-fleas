#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root_dir="$(cd "$script_dir/.." && pwd)"
# shellcheck disable=SC1091
source "$root_dir/scripts/report-log.sh"
report_log_init "terminal/install.sh" "$root_dir"
if ! "$script_dir/../scripts/confirm-reinstall.sh" "Terminal (zsh)" "command -v zsh"; then
  exit 0
fi

# Install packages
bash "$script_dir/../scripts/apt-update.sh"
sudo apt install -y zsh zsh-autosuggestions zsh-syntax-highlighting fzf bat eza

# Ensure "bat" command exists on Ubuntu (package provides batcat)
if command -v batcat >/dev/null 2>&1 && ! command -v bat >/dev/null 2>&1; then
  mkdir -p "$HOME/.local/bin"
  ln -sfn "$(command -v batcat)" "$HOME/.local/bin/bat"
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
fi

# Set zsh as default shell for this user
chsh -s "$(command -v zsh)"

# Backup existing zshrc if present
if [ -f "$HOME/.zshrc" ]; then
  cp "$HOME/.zshrc" "$HOME/.zshrc.bak.$(date +%Y%m%d-%H%M%S)"
fi

# Write .zshrc
cat <<'ZSHRC' > "$HOME/.zshrc"
# ~/.zshrc

# Enable completion system
autoload -Uz compinit
compinit

# History
HISTSIZE=10000
SAVEHIST=10000
HISTFILE=~/.zsh_history
setopt append_history
setopt share_history
setopt hist_ignore_dups
setopt hist_reduce_blanks

# Key bindings (use emacs-style)
bindkey -e

# Better globbing
setopt extended_glob

# Colors
autoload -Uz colors && colors

# Prompt with git info (powerline-like, ASCII)
autoload -Uz vcs_info
precmd() { vcs_info }
setopt prompt_subst
zstyle ':vcs_info:git:*' formats '%b'

_prompt_status() {
  local exit_code=$?
  if (( exit_code != 0 )); then
    echo "%F{red}x${exit_code}%f"
  fi
}

PROMPT='%F{white}%K{blue} %n@%m %k%f'
PROMPT+='%F{blue}|%f'
PROMPT+='%F{white}%K{blue} %~ %k%f'
PROMPT+='${vcs_info_msg_0_:+%F{blue}|%f%F{white}%K{green} ${vcs_info_msg_0_} %k%f}'
PROMPT+='%F{green}|%f %(?.%F{white}%K{green} ok %k%f.%F{white}%K{red} err %k%f) %# '

RPROMPT='$(_prompt_status)'

# Autosuggestions
source /usr/share/zsh-autosuggestions/zsh-autosuggestions.zsh

# Syntax highlighting (should be last)
source /usr/share/zsh-syntax-highlighting/zsh-syntax-highlighting.zsh

# fzf key bindings and completion (if installed)
if [ -f /usr/share/doc/fzf/examples/key-bindings.zsh ]; then
  source /usr/share/doc/fzf/examples/key-bindings.zsh
fi
if [ -f /usr/share/doc/fzf/examples/completion.zsh ]; then
  source /usr/share/doc/fzf/examples/completion.zsh
fi

# Helpful aliases
alias ll='ls -alF'
alias la='ls -A'
alias l='ls -CF'
if command -v batcat >/dev/null 2>&1; then
  alias cat='batcat'
elif command -v bat >/dev/null 2>&1; then
  alias cat='bat'
fi
if command -v eza >/dev/null 2>&1; then
  alias ls='eza --color=auto'
  alias ll='eza -alF --color=auto'
fi
ZSHRC

# Auto-start zsh for interactive bash shells
AUTO_ZSH_BLOCK='\n# AUTO_ZSH_START\nif [ -t 1 ] && [ -z "$ZSH_VERSION" ] && [ -n "$BASH_VERSION" ]; then\n    exec zsh\nfi\n# AUTO_ZSH_END\n'

if ! grep -q "AUTO_ZSH_START" "$HOME/.bashrc" 2>/dev/null; then
  printf "%b" "$AUTO_ZSH_BLOCK" >> "$HOME/.bashrc"
fi

if ! grep -q "AUTO_ZSH_START" "$HOME/.profile" 2>/dev/null; then
  printf "%b" "$AUTO_ZSH_BLOCK" >> "$HOME/.profile"
fi

echo "Done. Open a new terminal or run: exec zsh"
echo
echo "=== README ==="
cat "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/README.md"
