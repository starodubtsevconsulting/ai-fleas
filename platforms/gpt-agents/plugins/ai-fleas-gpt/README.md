# AI Fleas GPT

This is the single user-facing GPT/Codex plugin for AI Fleas. Install and trust this one plugin; its internal modules keep the two lifecycle responsibilities separate:

- `modules/agent-bootstrap/` restores or activates an exact receipt-backed agent identity.
- `modules/workflow-router/` enforces the hidden workflow transition contract for workflow-owned tasks.

Both modules run on the relevant Codex lifecycle events, but remain independently testable and documented. An ordinary unbound task stays unbound. The plugin never infers authority from a title, prompt, directory, or nearby file.

Local Hermes is a separate optional integration. It is not installed, enabled, or required by this plugin.

## Verify

```sh
node --test modules/agent-bootstrap/scripts/*.test.mjs
node --test modules/workflow-router/scripts/*.test.mjs
```
