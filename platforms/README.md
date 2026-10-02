# Agent platforms

AI Fleas workflows define logical roles, authority, collaboration, and required outcomes. A platform defines how those logical agents are realized and run. It may use a UI, terminal, launcher, service, or another runtime mechanism.

A profile resolves application platform selection from `platforms.default`, then workflow `platform`, then workflow `agent_overrides[agentId].platform`. Every declaration must be registered and available. A platform includes its bundled harness; model/provider settings remain separate. Initializer selection verifies the effective platform rather than overriding configuration. Legacy `agent_platform(s)` and a separately selected workflow harness are rejected. See [dispatch contract](DISPATCH_PLAN.md). Mixed-platform roster orchestration is unsupported.

Built-in public platform contracts are registered in `registry.yml`. External implementations are resolved only through explicit host configuration; AI Fleas never discovers sibling repositories by name or location.

Platform-specific lifecycle, messaging, model selection, persistence, UI, navigation, and host API behavior belongs to the selected platform implementation. Portable workflow and role contracts must express requirements without assuming those mechanics.

All adapters follow the [portable agent bootstrap contract](contract/agent-bootstrap.md): host startup restores only an
exact trusted instance binding, while first-time identity assignment remains a lifecycle-controller transaction.

## Supported platforms

| Platform | Runtime | Getting started |
| --- | --- | --- |
| [Codex App (`codex-app`)](gpt-agents/) | Desktop UI; Codex harness | macOS setup and one-click launcher available |
| [Codex CLI (`codex-cli`)](codex-cli/platform.yml) | Terminal; Codex harness | Execution contract only; no desktop roster lifecycle |
| [Hermes App (`hermes-app`)](hermes/) | Desktop UI; Hermes harness | App bots configured through installed CLI lifecycle tooling |
| [Hermes CLI (`hermes-cli`)](hermes-cli/platform.yml) | Terminal; Hermes harness | Profile-based terminal execution and lifecycle tooling |

Platform IDs identify an interface with its bundled harness, not a model or provider. App variants are the normal interactive examples; CLI variants are optional terminal interfaces. `codex-app` and `codex-cli` do not share desktop task lifecycle support. Hermes App and CLI share installed tooling, but selection is explicit and does not establish identical live instance identity. The existing `sc` entry is a custom host contract, not a claimed app/CLI implementation. Command IDs and folders (`gpt-agents`, `hermes-agents`) remain unchanged.
| [SC](sc/) | SC platform runtime | Adapter contract |
