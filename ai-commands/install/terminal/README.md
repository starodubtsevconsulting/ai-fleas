# Terminal setup

This folder contains the terminal and shell setup for Ubuntu/Linux and macOS.

What it gives you:

- tmux for the AI terminal layout
- zsh as the default interactive shell where supported
- autosuggestions and syntax highlighting
- fzf keybindings and completion
- a clean powerline-style prompt with git branch info
- nicer defaults for `ls` (eza) and `cat` (bat)

Why you need it:

- faster navigation and completion
- clearer prompts and git context
- consistent, repeatable terminal experience on fresh installs

Run:

```bash
./install.sh
```

Note: setup may update `~/.profile` and `~/.zshrc` for PATH defaults. On macOS, tmux installation uses Homebrew; if
Homebrew is missing, the terminal installer can bootstrap it with the official Homebrew install script, then refresh
standard Apple Silicon and Intel Homebrew paths (`/opt/homebrew/bin`, `/usr/local/bin`).
