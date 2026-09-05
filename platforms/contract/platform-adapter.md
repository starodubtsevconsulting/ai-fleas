# Agent platform adapter contract

A platform adapter implements logical AI Fleas agents for one concrete host.

Every adapter declares a stable ID, contract version, runtime-object type, capabilities, initialization entry point, and
role-overlay root. It accepts an exact profile, workflow, complete logical-project ID, and work target; validates host
capabilities before mutation; maps logical roles without changing their authority; binds exact runtime-owned instance IDs;
preserves all scope and communication boundaries; and fails closed when any mapping or permission is missing.

## Portable vocabulary

Public workflow and role contracts use only these runtime-neutral concepts:

- **logical agent**: a configured actor that implements one or more portable roles;
- **agent instance**: one live realization of a logical agent on the selected platform;
- **instance ID**: the platform-returned immutable identifier for that realization;
- **runtime scope**: the platform container that isolates one logical project;
- **activate/deactivate**: make an instance eligible/ineligible for routing while preserving history when the platform can;
- **send/receive**: platform-mediated delivery between exact initialized instances.

An adapter maps those concepts to its host. Host nouns such as task, thread, bot, chat, session, runtime project, archive,
model, reasoning level, or MCP operation belong only to an adapter or private implementation. An adapter may strengthen a role's
runtime checks, but it may not change the role's authority, capability ownership, communication topology, or approval
requirements.

The selected profile names an `agent_platform`. Resolve that exact ID from `platforms/registry.yml` or an explicitly
provided external registry. Never derive a folder name or scan sibling repositories. An unresolved ID returns
`BLOCKED_AGENT_PLATFORM_NOT_AVAILABLE` with zero runtime mutation.
