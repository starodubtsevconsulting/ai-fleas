# Infisical installer

Install a persistent, package-owned Infisical stack on one explicitly selected Linux Docker host.

See [requirements and reconstruction specification](spec.md) and
[usage, configuration, HTTPS, SMTP and recovery](infisical.command.md). Run the
[offline mechanics tests](infisical.command.test.sh) before releasing changes. The installer neither adopts nor
reinstalls an existing manual deployment.

For an authorized separate Linux deployment, use the [real-host acceptance scenario](infisical.scenario.md) and
[smoke-test launcher](infisical.command.smoke.test.sh). The harness stops its test stack and retains keys/data.
