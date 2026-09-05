# AI Fleas

AI Fleas is the public rules layer used by AI Fleas Platform. It contains reusable commands, workflow contracts, roles,
governance rules, and a sanitized profile example. It does not contain the private launcher, UI, backend, operational
profiles, credentials, project bindings, or workflow application implementations.

The dependency direction is one-way: `ai-fleas-platform` consumes this repository; this repository never imports or
depends on the private platform.

## Repository structure

- `ai-commands/` contains portable command contracts and their self-contained implementations.
- `ai-workflows/` contains reusable workflow rules, roles, guides, and declarative contracts.
- `ai-profile/` defines the profile structure and provides a sanitized example.

Files intended for this repository must be safe to publish. Machine paths, credentials, private providers, client data,
runtime state, UI/backend implementations, and private adapters belong in AI Fleas Platform.

Public workflow manifests describe only portable identity, rule entry points, and required command capabilities. They do
not declare MCP servers, transports, endpoints, frontend/backend processes, event storage, or host-specific runtime
commands. A consuming platform may bind those mechanics in a separate private implementation catalog.
