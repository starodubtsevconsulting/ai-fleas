# AI Fleas GPT

This directory is the generated installable distribution. Its readable source
and tests are maintained in the private `ai-fleas-platform/gpt-plugin/src/`
checkout. The compiled Node ESM modules retain stable entry points for the
public launcher and Codex hooks. Do not edit generated modules here; the
`build-manifest.json` records their hashes. The distributed JavaScript is
inspectable on a user's machine even though its source repository is private.

This is the single user-facing GPT/Codex plugin for AI Fleas. Install and trust this one plugin; its internal modules keep the two lifecycle responsibilities separate:

- `modules/agent-bootstrap/` restores or activates an exact receipt-backed agent identity.
- `modules/workflow-router/` enforces the hidden workflow transition contract for workflow-owned tasks.

Both modules run on the relevant Codex lifecycle events, but remain independently testable and documented. An ordinary unbound task stays unbound. The plugin never infers authority from a title, prompt, directory, or nearby file.

## Personal Governor onboarding

The macOS **AI Fleas GPT** Dock launcher uses the same receipt-bound lifecycle route: it opens an existing verified
Governor, or asks only for the exact human ID when needed and attempts fresh projectless initialization. The plugin
does not create a task merely because a hook runs.

From any Codex chat, `Initialize Personal Governor for <human-profile-id>` (or `Personal Governor INIT`
when a verified receipt identifies the human) starts the Governor lifecycle route. The requesting chat keeps its
current role and project; the controller creates a separate fresh-history projectless Governor task. No Admin is
required, and the only possible setup question is the exact human profile ID. Submitting the plugin's default
starter prompt performs the same trusted lifecycle-registry check before any profile or workflow selection:

- no active or pending receipt: offer **Create Personal Governor** and require an exact human profile ID from a trusted host catalog or the human;
- pending receipt: verify the exact host task and reconcile or retry it only if it is unarchived;
- active receipt: offer **Open Personal Governor** and never create a duplicate;
- malformed registry: fail closed with `BLOCKED_UNVERIFIED_TASK_IDENTITY`.

If an active or pending receipt points to an archived task, record that host state and create a new projectless task.
Never reopen or recover an archived Governor. Only one Governor binding may be active for a human on a platform.
The starter check does not bind the current chat, grant agent identity, or initialize a Governor by itself. Creation
still uses the receipt-bound host lifecycle transaction and must complete the configured readiness handshake.
Profiles and workflows are deliberately deferred until the mandatory Governor is ready.

Local Hermes is a separate optional integration. It is not installed, enabled, or required by this plugin.

Tests run against private source before building, and the private build's
`--check` mode verifies that this package matches it byte-for-byte.
