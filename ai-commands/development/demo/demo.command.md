# Demo command

Use `demo` to discover, inspect, guide, or execute a repository-owned demo package.

A demo package combines deterministic helpers (shell/API/fixture steps) with a human-readable Markdown scenario that can also describe UI-visible actions and observations. The command is provider-neutral: visual/browser execution is delegated to an authorized platform capability rather than hard-coding Playwright, coordinates, or one computer-use implementation.

## Usage

```text
demo discover [path]
demo inspect <demo-path>
demo guide <demo-path>
demo run <demo-path>
demo verify <demo-path>
```

- `discover`: find repository-owned demo packages without executing them.
- `inspect`: summarize the scenario, deterministic helpers, prerequisites, expected observations, and unresolved dependencies.
- `guide`: present the ordered scenario for a human presenter/operator; do not mutate state.
- `run`: execute the scenario using authorized deterministic and visual capabilities.
- `verify`: evaluate existing demo evidence against declared observations without changing the expected behavior.

The selected project/repository owns its demo artifacts. This command owns the portable interpretation/execution contract; it does not copy project demos into AI Fleas.

See `spec.md`.
