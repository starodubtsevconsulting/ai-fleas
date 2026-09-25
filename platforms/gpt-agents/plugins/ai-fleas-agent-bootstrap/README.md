# AI Fleas Agent Bootstrap

This GPT/Codex plugin restores trusted AI Fleas agent identity at session start and gates first-time initialization by an exact task-ID receipt.

It is the platform bootstrap layer, not an agent and not a workflow Router. Codex loads the plugin; the plugin reads a host-owned registry; only the lifecycle controller writes bindings.

## Security model

- A title, prompt, previous conversation, working directory, or nearby file never grants identity.
- An unbound task receives no injected agent context.
- A pending binding belongs to one exact task/session ID.
- First-time activation requires the exact host-registered initialization prompt and the configured readiness token in the same turn.
- `SessionStart` restores active identity after startup, resume, clear, or compaction.
- Missing or unverifiable declared sources keep the task read-only.

## Host transaction

1. Resolve the intended agent, exact scope, canonical sources, memory route, and next generation outside the new task.
2. Create a fresh task without copied conversation history.
3. Register the pending binding and deliver the exact prompt through the desktop task owner's queue:

   ```sh
   PLUGIN_DATA=/trusted/plugin/data node scripts/queue-agent-initialization.mjs \
     <exact-session-id> binding.json initialization-prompt.txt
   ```

4. The helper uses `codex queue`, which causes `UserPromptSubmit` to run in the exact existing task. Cross-task tool
   messages represented as function-call output are not valid lifecycle delivery and must not be substituted.
5. The hook requires the configured readiness token and atomically promotes the binding to `active`.
6. The lifecycle controller may then pin the successor and archive its predecessor.

The plugin deliberately does not create tasks, select a human profile, or grant lifecycle authority. Those remain GPT Agents adapter responsibilities.

## Test

```sh
node --test scripts/agent-bootstrap-hook.test.mjs
```
