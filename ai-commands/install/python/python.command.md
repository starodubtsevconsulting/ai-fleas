## Tags

#command #install #python #pip #dependency

Install Python package dependencies needed by ai-config commands.

## Behavior

- Detects whether a requested Python import is already available.
- Installs missing packages with `python3 -m pip install --user <package>` by default.
- Supports `--package <name>` and `--import <module>` for command-specific dependencies.
- Exits successfully without changes when the import is already available.
- Network access is required when a package must be installed.

## Usage

```bash
./commands/install/python/python.sh --package Pygments --import pygments
```

## Notes

- This helper is intended for lightweight Python dependencies used by ai-config command scripts.
- Prefer command-local detection before calling this installer so startup remains fast when dependencies are already present.
