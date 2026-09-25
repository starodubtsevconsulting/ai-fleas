# GPT/Codex App adapter

## Start on macOS

The current launcher supports macOS. Install the ChatGPT desktop application and Codex CLI, then clone this repository.
The `.command` links on GitHub are source previews and cannot execute in a browser. Open the cloned repository in Finder,
navigate to `platforms/gpt-agents/macos`, and completely quit ChatGPT with **ChatGPT → Quit ChatGPT** or `⌘Q` so the
app cannot retain an earlier plugin snapshot. Then Control-click `Setup AI Fleas GPT.command`, choose **Open**, and
confirm **Open** the first time macOS asks. The setup launcher runs the complete idempotent platform sequence: install or
update, migrate legacy plugin data, verify health, and reopen ChatGPT. It installs one user-facing plugin, **AI Fleas
GPT**. Agent Bootstrap and Workflow Router remain separate internal modules.

ChatGPT requires a human to review and trust new or changed plugin hooks. Approve those hooks and start a new Codex task.
For later sessions, open `AI Fleas GPT.command` from the same Finder folder. You can drag that daily launcher to the Dock
for easier access.

After setup, the Plugins page should show one repository-managed entry named **AI Fleas GPT**. Local Hermes is an
optional, independent integration and is not installed by this launcher.

The **Try now** button is diagnostic only. It creates an ordinary unbound task, so `No trusted AI Fleas bootstrap binding`
is the expected result. It does not initialize a Governor or workflow agent. Personal Governor initialization must be an
explicit `initialize-governor` controller transaction for an exact human profile; the bootstrap then activates only the
exact task ID registered by that transaction.

After updating the plugin, fully quit and reopen ChatGPT before testing in a new task. Existing tasks and a still-running
desktop process may continue using the previous cached plugin version.

Terminal equivalents:

```sh
platforms/gpt-agents/setup.sh
```

To record a private work profile at the same time:

```sh
platforms/gpt-agents/setup.sh --profile /absolute/path/to/work-profile.yml
```

The underlying launcher remains available for individual diagnostics and daily launch:

```sh
node platforms/gpt-agents/launcher.mjs doctor
node platforms/gpt-agents/launcher.mjs launch
```

If `doctor` reports `migration-required`, either the same AI Fleas plugin is still enabled from an older marketplace or
the `ai-fleas` marketplace points to a different checkout. Review `conflictingPlugins`, `marketplaceRoot`, and
`expectedMarketplaceRoot`, then migrate explicitly:

```sh
node platforms/gpt-agents/launcher.mjs setup --migrate
```

The normal setup and launch paths fail closed when duplicate or legacy plugin names are enabled or the marketplace source
is not the repository running the launcher. Migration relocates a mismatched marketplace, installs the repository-managed
plugin, copies legacy plugin data into its new data directory without overwriting conflicts, and only then removes the
reported older plugin copies. Orphaned legacy data is copied too, so a previously uninstalled marketplace copy does not
silently lose its identity receipts.

The selected profile path is stored locally and is not committed. Agent creation and reconciliation remain operations of
the profile-aware `gpt-agents` command; the launcher does not duplicate that lifecycle logic. Other operating systems may
implement the same launcher contract, but this first executable intentionally fails closed outside macOS.

## GPT plugin development

GPT-specific plugins are source-controlled under `platforms/gpt-agents/plugins/`. That directory is authoritative.
Installed plugin copies, Codex caches, marketplace state, task bindings, and dispatch receipts are local runtime
artifacts; do not develop against them or copy them back into the repository as source.

Use this sequence for every plugin implementation or hook change:

1. Edit the plugin under `platforms/gpt-agents/plugins/<plugin-id>/`.
2. Run every test in that plugin's `scripts/` directory.
3. Validate the tracked plugin manifest with the plugin-creator validator.
4. Update the tracked manifest's single Codex cachebuster.
5. Install the tracked plugin through the configured local marketplace.
6. Start a new Codex task and verify the affected lifecycle path.
7. Commit the tracked source, tests, documentation, and manifest together.

Workflow maps and runtime bindings are different concerns: portable maps remain under `ai-workflows/`, while exact
task IDs and runtime receipts remain local and must be reconciled separately on each machine.

Repository ownership is uniform for every GPT integration:

| Concern | Authoritative location |
| --- | --- |
| portable role, flow, state machine, and runtime logic | `ai-workflows/` |
| explicit operator/controller action | `ai-commands/system/gpt-agents/` |
| automatic GPT/Codex lifecycle hook or delivery adapter | `platforms/gpt-agents/plugins/` |
| GPT-specific workflow or role mapping | `platforms/gpt-agents/workflows/` and `platforms/gpt-agents/agents/` |
| installed plugin, cache, task binding, permit, or receipt | local runtime data; never authoritative source |

Apply this split to the whole feature, not one file at a time. For example, the Workflow Router keeps its portable state
machine under `ai-workflows/_common/runtime/` and its Codex hooks under `platforms/gpt-agents/plugins/`; agent bootstrap
uses the same split.

The GPT Personal Governor initializer is also the platform-specific owner of opportunistic utility-subagent routing. It
activates only from an explicit human Governor binding, selects that binding's model/reasoning route per dispatch, and keeps
Governor judgment and workflow-role independence outside utility helpers.

## Common task bootstrap

The [`agent-bootstrap`](plugins/ai-fleas-gpt/modules/agent-bootstrap/README.md) module inside the single
[`ai-fleas-gpt`](plugins/ai-fleas-gpt/README.md) plugin is the GPT host bootstrap layer shared
by workflow-independent and workflow-owned agents. Codex loads it before an agent can reason about its own role. The plugin
restores only exact receipt-backed task identity and gates first-time initialization with a task-ID- and prompt-bound
transaction. It never infers identity from a title, conversation, working directory, or nearby files.

The lifecycle controller remains responsible for creating a fresh task, resolving canonical initialization sources,
registering the pending binding, delivering the exact initialization prompt, verifying readiness, and performing any
successor cutover. Workflow Router behavior begins only after this common bootstrap resolves a workflow-owned identity.
