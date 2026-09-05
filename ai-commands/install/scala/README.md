# Scala setup

Installs Scala 3 from GitHub releases into your home directory.

What it gives you:

- Scala 3.4.1 in `~/scala/3.4.1` (version controlled via `v_matrix.json`)
- Latest Scala 3 release in `~/scala/latest` when enabled in `v_matrix.json`
- `~/scala/current` symlink pointing at the selected version
- `~/scala/switch.sh` (or `scala-switch`) to switch between installed versions
- Optional: set `SCALA_VERSION_OVERRIDE=<version>` when running `./install.sh` to override the matrix.

Run:

```bash
./install.sh
```

The script adds `~/scala/current/bin` to your PATH in `~/.profile`.
Note: setup may update `~/.profile` and `~/.zshrc` for PATH defaults.
Scala requires a JDK (run `./java/install.sh` first if needed).
