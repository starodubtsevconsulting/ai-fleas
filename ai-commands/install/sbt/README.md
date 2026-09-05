# sbt setup

Installs sbt from GitHub releases into your home directory.

What it gives you:

- sbt 1.10.7 in `~/sbt/1.10.7` (version controlled via `v_matrix.json`)
- `~/sbt/current` symlink pointing at the installed version

Run:

```bash
./install.sh
```

The script adds `~/sbt/current/bin` to your PATH in `~/.profile`.
Optional: set `SBT_VERSION_OVERRIDE=<version>` when running `./install.sh` to override the matrix.
