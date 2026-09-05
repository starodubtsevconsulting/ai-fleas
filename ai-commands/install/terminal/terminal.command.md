## Tags

#command #install #terminal #tmux

Install terminal prerequisites used by the AI Workflow Suite, currently focused on `tmux`.

## Behavior

- Detect whether `tmux` is already installed; if yes, exit successfully without changes.
- Detect the local platform/package manager:
  - macOS: `brew`
  - Ubuntu/Debian: `apt-get`
  - Fedora/RHEL: `dnf` or `yum`
  - Arch: `pacman`
- Prompt before installing when running interactively.
- Exit non-zero with a clear message when no supported installer is available.

## Usage

```bash
./commands/install/terminal/terminal.sh
./commands/install/terminal/terminal.sh --ensure-tmux
```

## Notes

- `start.sh` and terminal tmux launchers may call this command automatically when `tmux` is missing.
- Installation may require `sudo` on Linux.
