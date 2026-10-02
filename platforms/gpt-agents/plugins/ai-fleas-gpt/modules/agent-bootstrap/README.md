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

## Infrastructure map

The portable roster declares the role and common rules. Profile/workflow/per-agent
configuration selects the platform; the platform realization supplies its endpoint.
The lifecycle controller resolves those sources and verifies actual human approval,
host identity, project folders, plugin trust, and readiness. The plugin does not
discover a profile or create an Admin merely because its hooks are installed.

- `SessionStart`: automatically injects the exact active task's identity and source references.
- `UserPromptSubmit`: automatically checks the pending permit's exact prompt, nonce,
  expiry, task and turn for native user-prompt delivery.
- `Stop`: automatically activates only the matching initialized turn with the exact
  configured readiness token; it does not certify that a model actually read sources.
- `register-agent-initialization.mjs`: explicitly called by the lifecycle controller
  to register a pending binding; registration alone is not initialization.
- Native controller utilities: explicitly imported by a trusted host integration;
  discover complete catalogs, create or reuse one exact Admin, deliver INIT once,
  and verify completed-turn readiness and controller release.
- Owning-app adapter: explicitly supplied trusted send/live-thread ports correlate
  one exact INIT nonce acknowledgement to the actual live turn. The normal Stop hook
  still performs activation; an acknowledgement is not readiness.

For an agent's operational procedure, use
[Admin-only initialization](../../../../agents/admin-only-initialization.md).
It applies to any authorized workflow with the required Admin declaration and
platform realization, not just the workflow used for the live experiment. Other
platforms need their own supported lifecycle route; there is no automatic fallback.

## Native Admin controller transaction

Use exported `initializeNativeAdmin(request, options)` from
`platforms/gpt-agents/initialize-native-admin.mjs`, or the six-port
`initializeWorkflowAdmin(preparedPlan, host)` contract documented in the procedure.
There is no effectful `launcher.mjs initialize-admin` CLI. Its `preflight-admin`
command only builds and validates a plan. Hook installation does not automatically
run either controller API.

The transaction verifies fresh complete saved-project roots and active/archived
task catalogs. It reuses only an exact active ready Admin, otherwise creates only
one Admin with canonical references and the approved project subset. It registers
the exact permit, submits INIT once, and requires both the active receipt and the
actual completed host turn to prove `ADMIN_READY`. Missing configuration, ambiguous
identity, unsupported host evidence, platform mismatch, or failed readiness stops
without full-roster initialization or a partial readiness claim.

Native submission and app steering are different transports. Native `turn/start`
uses the user-prompt hook path. App steering uses the explicit nonce handshake
adapter; plain cross-task messages do not count as native UserPromptSubmit events.
Select the integration explicitly; do not send both routes or retry uncertain
delivery blindly. Same-task recovery must recheck identity, scope, prior attempt,
human approval, and plugin trust before renewing an expired permit.

## Queue-based host transaction

1. Resolve the intended agent, exact scope, canonical sources, memory route, and next generation outside the new task.
2. Create a fresh task without copied conversation history.
3. Register the pending binding and deliver the exact prompt through the desktop task owner's queue:

   ```sh
   PLUGIN_DATA=/trusted/plugin/data node scripts/queue-agent-initialization.mjs \
     <exact-session-id> binding.json initialization-prompt.txt
   ```

4. The helper uses `codex queue`, which causes `UserPromptSubmit` to run in the exact existing task. Cross-task tool
   messages represented as function-call output are not valid lifecycle delivery and must not be substituted. If queue
   delivery fails, the helper transactionally restores the registry state from before registration so an undelivered
   initialization cannot appear pending.
5. The hook requires the configured readiness token and atomically promotes the binding to `active`. A blocking report,
   missing token, wrong token, or token from another turn leaves the receipt pending without forcing the agent into a
   retry loop. The lifecycle controller must resolve the reported condition and re-dispatch initialization.
6. The lifecycle controller may then pin the successor when authorized and supported.
   Archiving a predecessor is a separate authorized lifecycle operation, not an
   automatic consequence of registration or readiness.

The plugin deliberately does not create tasks, select a human profile, or grant lifecycle authority. Those remain GPT Agents adapter responsibilities.

## Authority, storage, and limitations

Human approval permits one exact Admin bootstrap. An authorized controller may send
the exact INIT through the one-use scoped permit: INIT is the narrow exception to
the Admin's human-only direction rule. It does not authorize ordinary follow-ups,
execution-mode selection, CLONE/END/STOP, worker creation, or full-roster babysitting.
After verified handoff, the human directs Admin. Admin readiness is never full-roster
readiness. These role-followed instructions are not an app-level message firewall.

The generic `agent-bindings.json` lives in the host's plugin data directory, not in
the portable workflow or a second Admin registry. Keep real profiles, runtime
receipts, task IDs, local machine paths, prompts and logs outside public commits;
use fictional configuration examples. Source drift is evaluated against canonical
files, not a committed source-hash inventory. Atomic file replacement is not
cross-process compare-and-swap: controllers must serialize registry mutations.

Controller lease release/unloading does not prove the human can type in the UI.
Likewise, a binding does not prove the task remains present or archiveable: reread
the host catalog. These Admin initialization helpers do not implement an archive
or END transaction and do not guarantee native/app archival eligibility. On an
archive failure, inspect the exact task's live state and host error; do not treat a
sidebar disappearance, readiness token, or receipt deletion as verified archival
and disabled future delivery. Do not delete bindings to bypass a host error.

## Test

```sh
node --test scripts/agent-bootstrap-hook.test.mjs
```
