# Pi Agents

Prepare a single Dev Coder's Pi CLI configuration from the selected profile's
explicit main and auxiliary model bindings. This command supports only `dev/coder`.
It does not start Pi, bind a managed workflow agent, or declare readiness.

## Configuration

Register `pi-agents` in the work profile and declare `pi-cli` under
`platforms.available`. Use the sanitized configuration in
`ai-profile/example/commands-config/pi-agents/config.yml`.

`check` and `prepare` may run while another platform is selected for the Dev
workflow. They prepare an optional Pi CLI environment and do not switch the
workflow's effective platform. A future managed Pi Coder initialization must
first verify that `pi-cli` is the effective platform for that role and follow
the [Pi lifecycle contract](../../../platforms/pi-cli/agents/initialization.md).

`models.main` selects the coding model. `models.auxiliary` selects the model
used for automatic compaction and `/compact`. Each binding declares `provider`,
`model` (catalog alias), `connection`, and `context_window_tokens`. These bindings
are independent of the Hermes command configuration. Both models are registered
in Pi; only the main model becomes the startup default.

Models resolve through the declared `providers_config` catalog. Endpoint
variable overrides and environment-backed headers are supported; header secrets
are resolved when Pi makes a request. Local OpenAI-compatible providers use a
dummy `local` API key. Separate API key support is not implemented.

The generated extension uses Pi's native compaction implementation with the
auxiliary model, preserving recent turns, split turns, previous summaries,
file-operation records, custom `/compact` instructions, and usage accounting.
Pi keeps its normal compaction thresholds. Cancellation stops compaction.
A missing auxiliary model, request failure, incomplete output, or empty summary
falls back to normal compaction with the active model. A notification identifies
which model is compacting and reports fallback without displaying provider errors.
The auxiliary request uses low thinking when its model supports reasoning.
Fallback uses the active Pi model and its current thinking settings.
This configuration does not add `/goal` or a goal continuation loop.

## Usage

From the visible repository checkout:

```bash
./ai-commands/system/pi-agents/pi-agents.command.sh check \
  --work-profile example --workflow dev --project example-public-project
./ai-commands/system/pi-agents/pi-agents.command.sh prepare \
  --work-profile example --workflow dev --project example-public-project
```

Select an exact project ID registered under that profile's Dev workflow.
`--profile-root PATH` selects an explicit alternative profile catalog.
`check` reads configuration only and does not contact the provider.

`prepare` writes `models.json`, `settings.json`, `AGENTS.md`,
`auxiliary-model.json`, and `auxiliary-compaction.ts` under
`<profile>/.local/pi-agents/dev/<project>/coder/`. Repeating preparation
refreshes these five generated files from the canonical configuration;
unrelated settings keys, packages, and extension entries are preserved.
The generated auxiliary extension is listed exactly once. Malformed existing
`settings.json` stops preparation before any file is overwritten. Other files,
credentials, and sessions in that directory are preserved.
The Coder role instructions come from the workflow roster's declared role
file, with canonical role and self-command references retained.

To open the prepared configuration, set `PI_CODING_AGENT_DIR` to the absolute
`agentDirectory` printed by the command, change to its `workingDirectory`,
and run `pi`. Existing environment-backed header secrets must be present in
that process. Pi project settings can override directory defaults; inspect
any `.pi/settings.json` before relying on the selected startup model.

After changing canonical bindings or upgrading this generator, rerun `prepare`
and restart Pi (or use `/reload` for extension changes). Test `/compact` during a
real session: Pi should report the auxiliary model and retain the recent turns.
If the auxiliary endpoint is unavailable, Pi should report fallback and use the
active model. Inspect the resulting summary before relying on long task continuity.

Preparation is not managed `INIT`. Repository authority, workflow identity,
and independent review requirements still apply when the Coder performs work.
The agent directory may serve multiple Pi sessions and does not identify any
one of them. Pi's adapter remains an execution interface without roster
lifecycle support.

## Effects and errors

Only the selected profile's ignored `.local/pi-agents` directory is changed.
No installation, network call, launch, or host task mutation occurs. Missing
or duplicate profile, command, workflow, project, provider, model, or role
configuration stops preparation with `PI_AGENTS_CONFIGURATION_ERROR`.
Symlinks in profile source and output paths are rejected.
