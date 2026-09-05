# Install command framework

This directory hosts installer modules used by `install.sh`.

## Structure

- `install.sh`: orchestrates all module installers
- `check.sh`: reports installed vs missing tools
- `<tool>/install.sh`: tool-specific installer (required for module discovery)
- `<tool>/README.md`: module notes and usage (recommended)
- `<tool>/is-installed.step.sh`: custom installed check (optional but recommended)
- `scripts/`: shared helpers used by installers
- `logs/install.log`: required execution log file (auto-created)

## Logging requirement

- Every installer must call `report_log_init "<module>/install.sh" "$root_dir"` early.
- Logs are written to `logs/install.log` in this install framework root.
- Logs are local artifacts and must not be committed.

## Matrix usage (`v_matrix.json`)

- Update `v_matrix.json` only for tools with explicit version-selection policy in the framework (for example: Python,
Node.js, Java, Maven, Scala, sbt).
- Tools installed from package managers/CLI defaults without framework-managed version mapping (such as Whisper CLI) do
not require matrix entries.
