# Secrets command

`secrets` is the provider-neutral AI Fleas capability for resolving credential values required by commands and runtimes at execution time.

The command is a thin adapter over a configured secret-management backend. Workflows and consuming commands depend on this contract rather than directly depending on Infisical, Vault/OpenBao, an OS keychain, or another implementation.

## Profile boundary

A profile selects the provider and contains only non-secret configuration and logical secret references. The public example profile uses fictional values. Real profile names, domains, hosts, machine identities, service mappings, project/environment names, and other private deployment details belong in the user's private profile/configuration repository, not in the public AI Fleas contract.

Actual credential values belong only in the configured secret backend. They must not be committed to Git, written to Governor memory, embedded in diagrams, or printed to logs.

## Initial provider

The first intended provider is self-hosted Infisical. This is an implementation choice, not part of the portable command contract.

Conceptually:

```text
workflow / command / agent
          |
          | logical secret name
          v
       secrets
          |
          | configured provider adapter
          v
      Infisical
          |
          v
 value returned only to the authorized execution
```

A deployment may host Infisical on an always-on private infrastructure machine and expose it to authorized remote clients through a secure private/tunnel path. Public documentation must use fictional/non-routable names and domains; deployment-specific topology belongs to the private profile.

## Intended operations

The portable surface should remain small:

- resolve/get a named secret for an authorized execution;
- validate provider connectivity/authentication without printing secret values;
- report capability/provider health without exposing credentials.

Provider administration, installation, backup, recovery, identity provisioning, and rotation are infrastructure/provider concerns rather than reasons for workflows to depend directly on a vendor.

## Runtime policy

- resolve values only when execution requires them;
- grant least privilege to each machine/runtime/agent identity;
- support unattended identities for explicitly authorized 24/7 agents;
- never place resolved values in prompts, durable agent context, memory, source control, reports, or ordinary logs;
- fail closed when provider authentication or authorization is unavailable;
- keep provider selection replaceable through profile configuration.

## Example configuration

See `ai-profile/example/commands-config/secrets/config.example.yml` for a fictional profile-owned example.

## Installation

Installation of the initial backend belongs under the existing `install` capability as a reusable `install/infisical` package. That package should document target qualification, persistence, restart-on-boot, health verification, backup/recovery, and generic architecture diagrams without publishing a user's real infrastructure details.
