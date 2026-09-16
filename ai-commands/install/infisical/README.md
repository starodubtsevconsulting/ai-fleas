# Infisical installer

Install one persistent, package-owned Infisical Compose project on an explicitly selected Linux Docker host. Core mode
owns the backend, PostgreSQL, and authenticated Redis. Cloudflare mode also owns the Nginx TLS proxy and tunnel connector,
with exact network separation between tunnel, proxy, backend, and datastores.

See [requirements and reconstruction specification](spec.md) and
[usage, configuration, HTTPS, SMTP and recovery](infisical.command.md). Run the
[offline mechanics tests](infisical.command.test.sh) before releasing changes. The installer neither adopts nor
reinstalls an existing manual deployment.

For an authorized separate Linux deployment, use the [real-host acceptance scenario](infisical.scenario.md) and
[smoke-test launcher](infisical.command.smoke.test.sh). The harness stops its test stack and retains keys/data.
