# permanent-memory command specification

## Purpose

Provide a provider-neutral command contract for canonical permanent human-readable memory.

`permanent-memory` owns stable AI-facing operations and delegates physical access to the provider selected by the active binding. Provider commands remain flat and directly callable, for example `permanent-memory-synology`.

## Provider contract

A provider implements compatible operations: `check`, `info`, `list`, `read`, `recent`, `inbox`, `write`, and guarded `delete`.

## Bindings and scope

Permanent memory is a bindable capability, not something owned exclusively by Personal Governor.

A profile may define one or many named permanent-memory bindings. Authorized consumers reference a binding rather than hard-coding a provider or physical root.

Bindings may be used at profile, Personal Governor, workflow, or another explicitly authorized scope. Different bindings may use different providers, accounts, roots, access modes, or memory methods.

Example future shape:

```yaml
permanentMemory:
  personal:
    provider: permanent-memory-synology
  dev:
    provider: permanent-memory-local
  investment:
    provider: permanent-memory-synology
```

A workflow can reference its own binding:

```yaml
memory:
  permanent:
    ref: dev
```

A workflow memory binding is not automatically Personal Governor memory. Sharing must be explicit even when two bindings happen to point to the same physical vault/provider.

V1 example configuration defines only one `personal` binding. The multi-binding contract is documented now so additional workflow memories do not require redesigning the abstraction.

## Profile configuration

The profile owns binding selection, provider selection, and provider-specific values. Public examples use placeholders only. Credentials/private keys remain in private profile configuration or external secret facilities.

## Semantics

Permanent memory is canonical, durable, human-readable knowledge. It may use the common Zettelkasten-inspired organization, but the command contract does not require specific physical directory names.

## AI use

Personal Governor and workflow agents should normally call `permanent-memory` through their authorized binding, not a concrete provider. Provider commands are appropriate for provider-specific setup, diagnostics, or administration.
