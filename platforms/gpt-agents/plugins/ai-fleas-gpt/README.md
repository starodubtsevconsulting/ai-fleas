# AI Fleas GPT

This is the single user-facing GPT/Codex plugin for AI Fleas. Install and trust this one plugin; its internal modules keep the two lifecycle responsibilities separate:

- `modules/agent-bootstrap/` restores or activates an exact receipt-backed agent identity.
- `modules/workflow-router/` enforces the hidden workflow transition contract for workflow-owned tasks.

Both modules run on the relevant Codex lifecycle events, but remain independently testable and documented. An ordinary unbound task stays unbound. The plugin never infers authority from a title, prompt, directory, or nearby file.

## Personal Governor onboarding

Submitting the plugin's default starter prompt performs a trusted lifecycle-registry check before any profile or workflow selection:

- no active or pending receipt: offer **Create Personal Governor** and require an exact human profile ID from a trusted host catalog or the human;
- pending receipt: offer **Resume Personal Governor initialization**;
- active receipt: offer **Open Personal Governor** and never create a duplicate;
- malformed registry: fail closed with `BLOCKED_UNVERIFIED_TASK_IDENTITY`.

The starter check does not bind the current chat, grant agent identity, or initialize a Governor by itself. Creation still uses the receipt-bound host lifecycle transaction and must complete the configured readiness handshake. Profiles and workflows are deliberately deferred until the mandatory Governor is ready.

Local Hermes is a separate optional integration. It is not installed, enabled, or required by this plugin.

## Verify

```sh
node --test modules/agent-bootstrap/scripts/*.test.mjs
node --test modules/workflow-router/scripts/*.test.mjs
```
