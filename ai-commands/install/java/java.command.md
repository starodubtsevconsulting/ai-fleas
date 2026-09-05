## Tags

#command #install #java #jdk

Install AWS Corretto JDKs into the local `~/java/<major>-aws` layout used by the developer workstation.

## Behavior

- Installs the requested Corretto major version from AWS tarballs.
- Supports `x86_64`, `aarch64`, and `arm64` hosts.
- Keeps installs under `~/java` by default; override with `JAVA_HOME_BASE`.
- Does not switch `~/java/current` unless `--switch` is provided.
- Reuses `~/confs/java/switch.sh` as `~/java/switch.sh` and `~/bin/java-switch` when available.

## Usage

```bash
./commands/install/java/java.sh --major 11 --switch
./commands/install/java/java.sh --major 21
./commands/install/java/java.sh --major 11 --force --switch
```

## Notes

- This helper is for project-specific JDK needs that differ from the default `~/confs/java/setup.sh` matrix.
- Network access is required to download Corretto from `corretto.aws`.
