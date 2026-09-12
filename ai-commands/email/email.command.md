# email

## Purpose

Use `email` for provider-neutral email search, read, compose, draft, send, reply, and related mail operations when the selected AI Profile configures a supported provider.

The command represents email semantics, not a specific mail product. A selected AI Profile resolves the concrete provider, account, allowed recipients/domains, and integration route.

## Inputs

| Input | Required | Source | Description |
|---|---|---|---|
| Active AI Profile | Yes | Host activation | Authorizes the command and resolves profile-owned configuration. |
| Email intent | Yes | User or authorized role | Search/read/send intent, recipients, subject/body context, and requested operation. |

## Outputs

| Output | Destination | Description |
|---|---|---|
| Email result | Caller or authorized external system | Provider-neutral mail evidence, draft result, delivery receipt, or message reference. |

## Entry Point

| Entry point | Type | Profile-aware invocation |
|---|---|---|
| `email/email.command.md` | AI-readable contract | Load after the host activates the selected profile and resolves `AI_COMMAND_CONFIG_PATH`. |

Command kind: `adapter`.

Adapter layer: `provider-neutral`.

## Provider-neutral resolution

The selected profile may bind providers such as Gmail, Microsoft/Outlook, IMAP/SMTP-backed services, or another registered integration.

The profile owns provider selection, account identity, allowed recipients/domains, supported operations, and the integration route. The route may be an installed plugin/connector, MCP-compatible adapter, registered provider command, API wrapper, browser automation, or another supported mechanism. This contract does not require one transport technology.

Missing, disabled, ambiguous, or unavailable provider/integration bindings fail closed.

## Authorization

Read/search access, draft creation, and sending are separate capabilities. Sending, replying, forwarding, deleting, or otherwise causing an external mail effect requires the caller's existing authority and any applicable human-authorization gate.

## Configuration boundary

No operational email addresses, account IDs, recipient allowlists, credentials, tokens, endpoints, or private integration details belong in this reusable command. They belong to the selected profile and local credential storage.
