# Secrets command

## Purpose

`secrets` is the provider-neutral AI Fleas capability for resolving credential values required by commands and runtimes at execution time.

The command defines a thin adapter over a configured secret-management backend. Workflows and consuming commands depend on this contract rather than directly depending on Infisical, Vault/OpenBao, an OS keychain, or another implementation.

Execution route: `command-runner`.

This package is an AI-readable adapter contract. It does not yet implement an executable provider resolver or credential
injection. Runtime retrieval must fail closed until a separately implemented and reviewed provider is selected; the
installer provisions the service and does not supply that missing resolver.

## Inputs

| Input | Required | Source | Description |
|---|---|---|---|
| Selected profile and workflow | Yes | Trusted activation | Authorizes the capability and resolves its private configuration. |
| Logical secret and consuming command | Yes | Bounded execution request | Identifies the approved backend mapping and child-process destination. |
| Provider configuration | Yes | Profile-owned configuration | Endpoint, project/environment, identity and direct bootstrap references. |

## Outputs

| Output | Destination | Description |
|---|---|---|
| Capability/configuration disposition | Caller | Sanitized readiness or blocker; no resolved credentials. |
| Future resolved environment | Authorized child process only | Requires an implemented provider resolver; never returned to agent context or stdout. |

## Entry Point

| Entry point | Type | Profile-aware invocation |
|---|---|---|
| `secrets/secrets.command.md` | AI-readable contract | Activate the selected profile/workflow, confirm permission, and evaluate the bounded capability request. |

Every invocation is profile-aware: verify the active workflow permits `secrets`, resolve `AI_COMMANDS_ROOT`, and load only
its private `AI_COMMAND_CONFIG_PATH`. Committed configuration template: `secrets/secrets.command.example.config`.
Copy that fictional template into the selected profile and bind it through `commands[].config`.

The template maps each logical secret to an explicit backend path/key and maps only declared values to a consuming
command's child-process environment. Universal Auth bootstrap credentials come directly from named environment variables,
not secret-adapter references, preventing recursive resolution. A logical `ref` is a selector, not a backend lookup by
itself. Missing mappings, provider implementations, credentials or authorization are blockers, never permission to print
a value or guess another provider.

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

- inject a named secret into an authorized consuming command's child process;
- validate provider connectivity/authentication without printing secret values;
- report capability/provider health without exposing credentials.

Provider administration, installation, backup, recovery, identity provisioning, and rotation are infrastructure/provider concerns rather than reasons for workflows to depend directly on a vendor.

There is no stdout `get` operation. Connectivity/health checks must use an implemented provider and return status only;
configuration review alone cannot establish live provider health. These operations remain unavailable in this contract
package until the executable provider and scoped injection path exist.

## Runtime policy

- resolve values only when execution requires them;
- grant least privilege to each machine/runtime/agent identity;
- support unattended identities for explicitly authorized 24/7 agents;
- never place resolved values in prompts, durable agent context, memory, source control, reports, or ordinary logs;
- fail closed when provider authentication or authorization is unavailable;
- keep provider selection replaceable through profile configuration.

## Example configuration

See [secrets.command.example.config](secrets.command.example.config) for the command template and
[the fictional profile example](../../../ai-profile/example/commands-config/secrets/config.example.yml) for a profile-owned copy.

## Installation

Installation of the initial backend belongs to [install/infisical](../../install/infisical/infisical.command.md).
That package documents target qualification, persistence, restart policies, health verification, backup/recovery,
HTTPS and optional SMTP, with fictional examples. It provisions a new package-owned stack and refuses automatic adoption
of an existing manual deployment. Installation and secret retrieval are separate capabilities.
