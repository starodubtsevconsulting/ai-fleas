# Agent platform adapter contract

A platform adapter implements logical AI Fleas agents for one concrete host.

Every adapter declares a stable ID, contract version, runtime-object type, capabilities, initialization entry point, and
role-overlay root. It accepts an exact profile, workflow, complete logical-project ID, and work target; validates host
capabilities before mutation; maps logical roles without changing their authority; binds exact runtime-owned instance IDs;
preserves all scope and communication boundaries; and fails closed when any mapping or permission is missing.

The selected profile names an `agent_platform`. Resolve that exact ID from `platforms/registry.yml` or an explicitly
provided external registry. Never derive a folder name or scan sibling repositories. An unresolved ID returns
`BLOCKED_AGENT_PLATFORM_NOT_AVAILABLE` with zero runtime mutation.
