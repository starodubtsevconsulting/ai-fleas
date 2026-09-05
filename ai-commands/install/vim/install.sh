#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root_dir="$(cd "$script_dir/.." && pwd)"
# shellcheck disable=SC1091
source "$root_dir/scripts/report-log.sh"
report_log_init "vim/install.sh" "$root_dir"
if ! "$script_dir/../scripts/confirm-reinstall.sh" "Vim" "command -v vim"; then
  exit 0
fi

# Install Vim and dependencies
bash "$script_dir/../scripts/apt-update.sh"
sudo apt install -y vim curl git

# Backup existing vimrc if present
if [ -f "$HOME/.vimrc" ]; then
  cp "$HOME/.vimrc" "$HOME/.vimrc.bak.$(date +%Y%m%d-%H%M%S)"
fi

# Install vim-plug
curl -fLo "$HOME/.vim/autoload/plug.vim" --create-dirs \
  https://raw.githubusercontent.com/junegunn/vim-plug/master/plug.vim

# Write .vimrc
cat <<'VIMRC' > "$HOME/.vimrc"
" ~/.vimrc

call plug#begin('~/.vim/plugged')
Plug 'tpope/vim-sensible'
Plug 'sheerun/vim-polyglot'
Plug 'editorconfig/editorconfig-vim'
Plug 'vim-airline/vim-airline'
Plug 'vim-airline/vim-airline-themes'
Plug 'morhetz/gruvbox'
call plug#end()

set number
set relativenumber
set tabstop=2
set shiftwidth=2
set expandtab
set clipboard=unnamedplus
set termguicolors
set background=dark

silent! colorscheme gruvbox

" Keep statusline simple (no special fonts required)
let g:airline_powerline_fonts = 0
VIMRC

# Install plugins (best effort)
if command -v vim >/dev/null 2>&1; then
  vim +PlugInstall +qall || true
fi

mkdir -p "$HOME/bin"
cp "$script_dir/switch-theme.sh" "$HOME/bin/vim-switch-theme"
chmod +x "$HOME/bin/vim-switch-theme"

echo "Vim setup complete"
echo
echo "=== README ==="
cat "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/README.md"
