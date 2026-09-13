# permanent-memory command specification

## Purpose

Provide the provider-neutral command contract for a profile's canonical permanent human-readable memory.

`permanent-memory` owns the stable AI-facing operations and delegates physical access to the provider selected by the active profile. Provider commands remain flat and directly callable, for example `permanent-memory-synology`.

## Provider contract

A provider must implement the compatible operations:

- `check`
- `info`
- `list [relative-path]`
- `read <relative-path>`
- `recent [days]`
- `inbox`
- `write <relative-path> [--force]`
- `delete <relative-path> --confirm`

The generic command forwards the operation and arguments to the configured provider without embedding provider-specific connection details.

## Profile configuration

The profile owns provider selection and provider-specific values. Public examples use placeholders only. Credentials/private keys must remain in private profile configuration or external secret facilities.

## Semantics

Permanent memory is canonical, durable, human-readable knowledge. It may use the common Zettelkasten-inspired organization but the command contract does not require specific physical directory names.

## AI use

Personal Governor and other agents should normally call `permanent-memory`, not a concrete provider. They may call a provider directly only when explicitly performing provider-specific setup, diagnostics, or administration.
