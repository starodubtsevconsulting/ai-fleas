# Visual Studio Code setup

Installs Visual Studio Code into the home folder (no system-wide packages).

This installer is update-aware: it can detect newer versions and prompt to update instead of blindly reinstalling.

## Run

```bash
./install.sh
```

Install only the managed extension list without reinstalling VS Code:

```bash
./install.sh --extensions-only
```

Install one specific extension into the existing VS Code install:

```bash
./install.sh --extensions-only --extension bierner.markdown-mermaid
```

Check for updates without reinstalling:

```bash
./check-update.sh
```

## Install layout

- `~/vscode` contains the VS Code files
- `~/.local/bin/code` launcher symlink
- Default extensions are installed from `vscode/extensions.txt`, so adding an extension there makes `./install.sh` install it automatically
- `--extensions-only` reuses the existing `code` launcher and skips the VS Code download/reinstall path
- `--extension <publisher.extensionId>` installs one extension directly

Note: setup may update `~/.profile` and `~/.zshrc` for PATH defaults.
