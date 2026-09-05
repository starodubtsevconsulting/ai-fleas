# Maven setup

Installs Apache Maven binary tarballs into your home directory.

What it gives you:

- Maven 3.9.9 in `~/maven/3.9.9` (version controlled via `v_matrix.json`)
- `~/maven/current` symlink pointing at the installed version
- `~/maven/switch.sh` (or `maven-switch`) to repoint `current`

Run:

```bash
./install.sh
```

The script adds `~/maven/current/bin` to your PATH in `~/.profile` and `~/.zshrc`.
Optional: set `MAVEN_VERSION_OVERRIDE=<version>` when running `./install.sh` to override the matrix.
