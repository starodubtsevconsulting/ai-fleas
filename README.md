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
- `platforms/` defines the adapter contract and tracked public agent-platform implementations such as `gpt-app`.

Files intended for this repository must be safe to publish. Machine paths, credentials, private providers, client data,
runtime state, UI/backend implementations, and private adapters belong in AI Fleas Platform.

Public workflow manifests describe only portable identity, rule entry points, and required command capabilities. They do
not declare MCP servers, transports, endpoints, frontend/backend processes, event storage, or host-specific runtime
commands. A consuming platform may bind those mechanics in a separate private implementation catalog.

## Initialization and host extensions

AI Fleas always runs through an agent platform. It ships with the public `gpt-app` adapter, so GPT/Codex App users do not
need an additional platform repository. Start the AI task in the repository where the work will happen, load this
repository's rules, and select an AI Profile. The profile—not the shell working directory—defines the platform, active
workflows, commands, projects, and permitted work scope.

A direct setup is self-contained:

1. Create or copy an AI Profile using `ai-profile/example/` as the structure.
2. Select an exact registered `agent_platform` and configure the workflows, commands, projects, and scope.
3. Start the AI host with the intended work repository as its project root and the selected profile as configuration.
4. Keep writes inside that project root unless the profile and the user's request explicitly authorize cross-repository
   work.

An organization may also build a host-specific companion such as `ai-fleas-my-platform`. A companion
may provide a launcher, UI, backend, transport, persistence, provider integration, or private profiles. It consumes and
implements the contracts in AI Fleas; it must not silently replace, weaken, or duplicate the common rules. Host-specific
rules are appropriate only for behavior owned by that host itself.

Initialization must not infer a companion repository merely because one exists nearby. A task initialized from
`ai-fleas` uses AI Fleas as-is unless the selected profile or an explicit user instruction names a companion. If a task is
already rooted in another repository, changing its shell working directory does not re-scope it; create or open a task
rooted in the intended repository instead.
