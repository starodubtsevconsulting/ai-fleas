# Node.js setup

Installs Node.js from official tarballs into your home directory. The default
major can be controlled via `v_matrix.json` in the repo root.

What it gives you:

- Node.js 22.x in `~/node/22`
- latest Node.js major in `~/node/latest`
- `~/node/current` symlink to the installed 22.x
- `~/node/switch.sh` (or `node-switch`) to switch between installed versions

Run:

```bash
./install.sh
```

The script adds `~/node/current/bin` to your PATH in `~/.profile`.
Note: setup may update `~/.profile` and `~/.zshrc` for PATH defaults. The
`switch.sh` script only repoints the `current` symlink.
The setup also installs a global helper at `~/bin/node-switch`.
