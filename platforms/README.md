# Agent platforms

AI Fleas workflows define logical roles, authority, collaboration, and required outcomes. A platform defines how those logical agents are realized and run. It may use a UI, terminal, launcher, service, or another runtime mechanism.

A profile resolves lifecycle platform selection from `agent_platforms.default`, then workflow `agent_platform`, then workflow `agent_overrides[agentId].agent_platform`. Every declaration must be registered and available. Runtime initializer selection verifies the effective platform; it does not override configuration. Workload harness selection remains independent. See [dispatch contract](DISPATCH_PLAN.md). Mixed-platform roster orchestration is unsupported.

Built-in public platform contracts are registered in `registry.yml`. External implementations are resolved only through explicit host configuration; AI Fleas never discovers sibling repositories by name or location.

Platform-specific lifecycle, messaging, model selection, persistence, UI, navigation, and host API behavior belongs to the selected platform implementation. Portable workflow and role contracts must express requirements without assuming those mechanics.

All adapters follow the [portable agent bootstrap contract](contract/agent-bootstrap.md): host startup restores only an
exact trusted instance binding, while first-time identity assignment remains a lifecycle-controller transaction.

## Supported platforms

| Platform | Runtime | Getting started |
| --- | --- | --- |
| [GPT Agents](gpt-agents/) | Codex tasks in the ChatGPT desktop application | macOS setup and one-click launcher available |
| [Hermes](hermes/) | Hermes agents | Adapter contract and profile-driven initialization |
| [SC](sc/) | SC platform runtime | Adapter contract |
