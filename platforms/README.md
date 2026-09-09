# Agent platforms

AI Fleas workflows define logical roles, authority, collaboration, and required outcomes. A platform defines how those logical agents are realized and run. It may use a UI, terminal, launcher, service, or another runtime mechanism.

A profile may declare multiple available platforms. Starting a profile selects one platform for that run; the profile itself is not permanently bound to one platform. An optional default may be used when the runtime does not select one explicitly.

Built-in public platform contracts are registered in `registry.yml`. External implementations are resolved only through explicit host configuration; AI Fleas never discovers sibling repositories by name or location.

Platform-specific lifecycle, messaging, model selection, persistence, UI, navigation, and host API behavior belongs to the selected platform implementation. Portable workflow and role contracts must express requirements without assuming those mechanics.
