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

## Secret references and naming

Profiles and reusable configuration must refer to credentials explicitly with the canonical annotation
`${secret:<logical-name>}`. A field is not treated as secret merely because its name contains `password`, `token`, `key`,
or a similar word. Explicit annotation makes secret use reviewable and prevents accidental implicit resolution.

Logical names use this canonical shape:

```text
<scope>.<environment>.<service>.<credential>
```

Use lowercase ASCII letters, digits and hyphens inside each segment, with dots only as segment separators. Names should
identify the owner/use of the credential rather than its current storage location. Examples:

```text
${secret:example.prod.database.password}
${secret:example.prod.mail.api-token}
${secret:infrastructure.prod.cloudflare.api-token}
${secret:multimedia.prod.voice-provider.api-key}
```

`scope` identifies the bounded project/product/infrastructure area, `environment` distinguishes such contexts as `dev`,
`test`, `staging`, and `prod`, `service` identifies the consuming or external service, and `credential` identifies the
credential's role. Do not use generic logical names such as `api-token`, `password`, `database.password`, or `prod.key`.
Do not encode the provider name, Infisical project ID, physical host, backend path, current secret value, username/email,
or other deployment detail into the logical name unless that concept is genuinely part of the credential's stable
business identity.

Example profile configuration may therefore contain:

```yaml
database:
  password: "${secret:example.prod.database.password}"
cloudflare:
  api_token: "${secret:infrastructure.prod.cloudflare.api-token}"
```

The profile-owned `secrets` configuration maps those stable logical names to provider-specific locations:

```text
${secret:example.prod.database.password}
                 |
                 v
          connect/secrets
                 |
                 v
       configured provider mapping
                 |
                 v
 Infisical project/environment/path/key
```

The logical reference is therefore independent of Infisical. Replacing the backend with another provider changes the
private mapping/adapter, not every workflow and application configuration that consumes the logical secret.

### Collision and alias policy

A logical secret name must resolve to exactly one mapping in the activated profile. Duplicate definitions, multiple
provider mappings for the same logical name, malformed references, unknown logical names, and ambiguous aliases must fail
validation. Resolution must never select the first match, search neighboring scopes, infer an environment, or fall back to
a similarly named environment variable.

Aliases, when needed for migration, must be explicit one-to-one mappings maintained in private configuration. Alias
chains, cycles, wildcard aliases, prefix matching, and implicit aliases are not permitted. A rename should normally update
the logical reference deliberately; an alias is a temporary compatibility mechanism, not a second namespace.

Logical-name uniqueness is required within the activated profile. Different profiles may intentionally use the same
logical name because profile activation establishes a separate configuration boundary. Within one profile, environment
is part of the name specifically so that `dev` and `prod` credentials cannot collide.

### Resolution and storage rules

- Commit logical `${secret:...}` references, never resolved values.
- Resolve only after profile/workflow authorization and immediately before the authorized execution needs the value.
- Inject a resolved value only into the bounded child process or equivalent provider-supported runtime channel.
- Never substitute a resolved value back into a profile/configuration file.
- Never include resolved values in stdout, receipts, prompts, Governor memory, durable agent context, screenshots, test fixtures, telemetry, or ordinary logs.
- Do not cache resolved values on disk merely to improve convenience. Provider-supported short-lived runtime caching may be used only when explicitly designed and bounded.
- Keep bootstrap credentials separate from ordinary logical secret references so resolving the secret store does not recursively require the secret store.
- Give each machine/runtime identity only the mappings it needs. Sharing one universal machine identity defeats the purpose of central secret management.
- Prefer rotation/revocation at the backend while preserving the logical reference, so consumers do not change when a credential value changes.

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

## FAQ

### Why not use environment-variable names as the logical secret names?

Environment variables are an injection mechanism, not a durable identity for a credential. Different consumers may need
the same logical secret under different environment-variable names, and environment names tend to expose implementation
details. The logical name remains stable while the consuming-command mapping decides the final environment-variable name.

### How are collisions prevented?

The full `<scope>.<environment>.<service>.<credential>` name is the identity. Within an activated profile it may have only
one mapping. Duplicate, ambiguous, wildcard, or inferred mappings fail closed. `dev` and `prod` are different names rather
than two values selected implicitly from context.

### What happens if the backend changes from Infisical?

The logical `${secret:...}` references remain unchanged. Only the private provider configuration and adapter mapping change.
This is the reason workflows should depend on `connect/secrets`, not on Infisical paths or APIs directly.

### Why does the secret store itself still need a credential?

Authentication cannot be eliminated; it can be reduced and scoped. A machine keeps a bootstrap identity credential that
proves who it is to the provider. That identity is then authorized only for the logical secrets required by that runtime.
Bootstrap credentials are not resolved through `${secret:...}` because doing so would create a recursive dependency.

### Should several machines share one bootstrap credential?

No by default. Independent machine/runtime identities allow least privilege, auditing, and revocation of one compromised
client without replacing every other client's access. An unattended 24/7 agent should have its own narrowly scoped
identity rather than inheriting a human administrator credential.

### Where should actual secret values appear?

Only in the configured secret backend and transiently in the authorized runtime that needs them. Profiles, Git, Governor
memory, agent prompts, documentation, receipts, and logs contain logical references or redacted metadata, not values.

## Example configuration

See [secrets.command.example.config](secrets.command.example.config) for the command template and
[the fictional profile example](../../../ai-profile/example/commands-config/secrets/config.example.yml) for a profile-owned copy.

## Installation

Installation of the initial backend belongs to [install/infisical](../../install/infisical/infisical.command.md).
That package documents target qualification, persistence, restart policies, health verification, backup/recovery,
HTTPS and optional SMTP, with fictional examples. It provisions a new package-owned stack and refuses automatic adoption
of an existing manual deployment. Installation and secret retrieval are separate capabilities.
