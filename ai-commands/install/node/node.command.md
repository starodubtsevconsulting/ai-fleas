## Tags

#command #install #node #npm #dependency

Install Node/npm package dependencies needed by ai-config commands.

## Behavior

- Detects whether a requested Node package can be resolved from a target directory.
- Installs missing packages with `npm install --prefix <dir> <package>` by default.
- Supports command-local installs so command dependencies do not require repo-root package metadata.
- Exits successfully without changes when the package is already available.
- Network access is required when a package must be installed.

## Usage

```bash
./commands/install/node/node.sh --package mermaid --prefix commands/show-context
```

## Notes

- Use this for npm-backed renderers or CLIs that ai-config commands need locally.
- Prefer command-local detection before calling this installer so startup remains fast when dependencies are already present.
