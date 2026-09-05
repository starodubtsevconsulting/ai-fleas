# Agent platforms

AI Fleas workflows define logical roles, authority, collaboration, and required outcomes. A platform adapter maps those
logical agents to concrete runtime objects such as GPT/Codex tasks, Hermes bots, Pi sessions, or another host's agents.

Built-in public adapters are registered in `registry.yml`. External adapters are resolved only through explicit host
configuration; AI Fleas never discovers sibling repositories by name or location.

Platform-specific task lifecycle, messaging, model selection, persistence, and host API instructions belong under the
selected adapter. Portable workflow and role contracts must express requirements without assuming those mechanics.
