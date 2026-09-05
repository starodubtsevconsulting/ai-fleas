# Python setup

Installs Python from python.org tarballs into your home directory.

What it gives you:

- Python 3.12.x in `~/python/3.12`
- `~/python/current` symlink to the latest installed 3.12.x
- pip and venv via the local install
- `~/python/switch.sh` (or `python-switch`) to switch between installed versions

Run:

```bash
./install.sh
```

The script adds `~/python/current/bin` to your PATH in `~/.profile`.
Note: setup may update `~/.profile` and `~/.zshrc` for PATH defaults.
