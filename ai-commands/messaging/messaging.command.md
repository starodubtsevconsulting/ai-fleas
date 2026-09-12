# messaging

## Purpose

Use `messaging` for provider-neutral instant messaging and text-message communication, including chat, direct-message, channel, and SMS-style delivery when the selected AI Profile configures a supported provider.

The command represents messaging semantics, not a specific product. A selected AI Profile resolves the concrete provider, account/workspace, allowed destinations, and integration route.

## Inputs

| Input | Required | Source | Description |
|---|---|---|---|
| Active AI Profile | Yes | Host activation | Authorizes the command and resolves profile-owned configuration. |
| Messaging intent | Yes | User or authorized role | Message content, destination intent, channel type, and requested operation. |

## Outputs

| Output | Destination | Description |
|---|---|---|
| Messaging result | Caller or authorized external system | Provider-neutral delivery result, message reference, or read/search evidence. |

## Entry Point

| Entry point | Type | Profile-aware invocation |
|---|---|---|
| `messaging/messaging.command.md` | AI-readable contract | Load after the host activates the selected profile and resolves `AI_COMMAND_CONFIG_PATH`. |

Command kind: `adapter`.

Adapter layer: `provider-neutral`.

## Provider-neutral resolution

The selected profile may bind providers such as Slack, Microsoft Teams, Signal-compatible/local messaging, SMS gateways, or another registered integration. SMS is a messaging channel, not a separate top-level capability in this contract.

The profile owns provider selection, account/workspace identity, allowed channels or recipients, supported operations, and the integration route. The route may be an installed plugin/connector, MCP-compatible adapter, registered provider command, API wrapper, browser automation, or another supported mechanism. This contract does not require one transport technology.

Missing, disabled, ambiguous, or unavailable provider/integration bindings fail closed.

## Authorization

Read/search access and message-send access are separate. Sending, editing, deleting, reacting, or otherwise causing an external messaging effect requires the caller's existing authority and any applicable human-authorization gate.

## Configuration boundary

No operational workspace IDs, phone numbers, recipient lists, credentials, tokens, endpoints, or private integration details belong in this reusable command. They belong to the selected profile and local credential storage.
