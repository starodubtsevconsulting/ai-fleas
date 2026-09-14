# docker

## Purpose

Use `docker` through the parent `install` command to inspect, install, and smoke-test Docker Engine and the Compose plugin.
The reviewed mutating installer supports Ubuntu. Read-only status and smoke testing use the installed Docker CLI on any
host, while unsupported lifecycle actions fail closed.

## Entry Point

Invoke `install/install.sh docker <action>` after activating a profile and workflow that authorize the `install` command.
The Docker child adapter revalidates that parent command scope before execution.

## Actions

- `status` reports the CLI and Compose versions without mutation.
- `smoke-test` verifies the CLI, daemon, and Compose plugin.
- `install` installs Docker from Docker's official Ubuntu repository and requires sudo.
- `check-update`, `update`, `upgrade`, and `uninstall` fail closed until reviewed adapters exist.
