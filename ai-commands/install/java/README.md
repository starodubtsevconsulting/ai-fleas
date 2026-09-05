# Java setup

Installs AWS Corretto JDK tarballs into your home directory.

What it gives you:

- Java in `~/java/<major>-aws` based on `v_matrix.json`
- the latest Corretto JDK in `~/java/latest-aws`
- `~/java/current` symlink to the latest installed JDK
- `~/java/switch.sh` (or `java-switch`) to switch between installed versions

Run:

```bash
./install.sh
```

The script adds `~/java/current/bin` to your PATH in `~/.profile`.
Note: setup may update `~/.profile` and `~/.zshrc` for PATH defaults.
For Java (and other runtimes), version selection is defined in `v_matrix.json`
at the repo root.
