# Vim setup

Installs Vim and a small set of plugins for better filetype support,
formatting helpers, and a nicer color theme.

What it gives you:

- Vim with sensible defaults
- filetype support for many languages
- EditorConfig integration for consistent formatting
- gruvbox color theme
- a lightweight statusline

Run:

```bash
./install.sh
```

Note: setup may update `~/.profile` and `~/.zshrc` for PATH defaults.

After install, open Vim and run `:PlugInstall` if plugins were not installed
automatically.

Theme switching:

- `vim-switch-theme` (installed into `~/bin`) shows available themes and updates `~/.vimrc`.

Handy command: `:Ex` opens the file explorer so you can navigate files without
leaving the keyboard.

More tips: https://vim.rtorr.com/

Respect: https://github.com/derekwyatt/vim-config and
https://vimeo.com/6999927 (best ever).
