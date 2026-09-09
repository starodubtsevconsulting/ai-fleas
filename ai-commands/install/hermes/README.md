# Hermes installation command

Canonical command ID: `hermes`. Human aliases include `Hermes` and `Hermes Agents`.

This target owns physical Hermes package status, installation, stable update checks, and upgrades. It delegates to the
existing reviewed Hermes installer while the legacy `hermes-agents install` route remains compatible. Uninstall fails
closed until an ownership-safe uninstaller is implemented; it never deletes profiles, conversations, or workflow groups.

Local support is `Darwin/arm64` only. After install or upgrade, the adapter runs isolated `--version` and offline `--help`
probes with a temporary home and blocked proxy environment.
