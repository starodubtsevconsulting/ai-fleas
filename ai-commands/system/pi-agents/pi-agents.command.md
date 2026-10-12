# Pi Agents

Prepare one selected workflow role's Pi CLI configuration from the profile's
explicit main and auxiliary model bindings. Legacy v1 supports `dev/coder`;
v2 declares `workflows.<workflow>.role`, `models`, and `agent_directory`.
It does not start Pi, bind a managed workflow agent, or declare readiness.

## Configuration

For v2 use `schema_version: pi-agents-command-config.v2`, retain the command,
platform and provider-catalog identity fields, and replace top-level workflow,
role, models and agent_directory with a `workflows` mapping. Each workflow
entry selects an exact roster role and its own models and output directory.
The selected workflow must register `pi-agents` and authorize the exact project.
Optional `--model ALIAS` selects an entry in that workflow's `model_choices`
mapping; `--provider ID` filters/validates that configured binding and cannot
introduce an unconfigured provider. Choices replace only the main binding.
Bindings may declare `input: [text, image]` and `max_tokens`; these are explicit
provider metadata, not proof that a live endpoint accepts images. Context and
maximum output tokens must reflect the actual endpoint (for example 8192),
and maximum output cannot exceed context. Omitted metadata keeps Pi defaults.

The root launcher accepts `--scenario PATH` for a regular, nonempty UTF-8 `.md`
file no larger than 256 KiB. It validates the file before preparation and passes
its text unchanged inside one prompt argument after `--` to Pi without a shell.
The prompt begins with the selected profile, workflow configuration, project, model and
authorized working directory. Optional `--scenario-context PATH` appends a
separate Markdown context section with the same file validation. `--print`
requires a scenario and runs Pi noninteractively with a 10 minute timeout;
stdout/stderr remain available to the invoking terminal for capture. Preparation
does not execute the Markdown or assert managed role readiness.

The complete launch-context/scenario/context prompt is bounded to 64 KiB of UTF-8
before preparation. Scenario launches pin the configured provider and model on
Pi's command line so project defaults cannot silently replace that binding.
Scenario launches additionally pass Pi's `--no-context-files`, `--no-skills`,
`--no-prompt-templates`, and `--no-approve` controls to suppress automatic context,
skill and prompt-template loading and project approval/loading. These flags are
limited to scenario mode; ordinary role previews retain their existing behavior.
The explicit launch prompt carries the scenario, authorized scope and human
controls even when automatic context loading is disabled.
Scenario mode also supplies a concise `--system-prompt` retaining folder bounds,
platform safety, human controls and source-document isolation, with `--tools read,bash`.
This avoids unrelated coding instructions and tool schemas. File-size validation
is not a context-budget guarantee: the scenario and context must fit the endpoint's
actual token window, including Pi's output reservation and tool definitions.

Scenario launches pass `--scenario-mode` to both check and prepare. They validate
the configured roster selection but write into `<agent_directory>/<project>/scenario/`.
The generated AGENTS contains only the selected scope, model, human task controls
and stop conditions; it contains no workflow role text or self-command references.
Workflow processing and INIT are not part of scenario execution. Ordinary launches
without `--scenario` preserve role preparation and the v1 Dev preview behavior.

Register `pi-agents` in the work profile and declare `pi-cli` under
`platforms.available`. Use the sanitized configuration in
`ai-profile/example/commands-config/pi-agents/config.yml`.

`check` and `prepare` may run while another platform is selected for the
workflow. They prepare an optional Pi CLI environment and do not switch the
workflow's effective platform. A future managed Pi role initialization must
first verify that `pi-cli` is the effective platform for that role and follow
the [Pi lifecycle contract](../../../platforms/pi-cli/agents/initialization.md).

`models.main` selects the primary model. `models.auxiliary` selects the model
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

Select an exact project ID registered under that profile's selected workflow.
`--profile-root PATH` selects an explicit alternative profile catalog.
`check` reads configuration only and does not contact the provider.

`prepare` writes `models.json`, `settings.json`, `AGENTS.md`,
`auxiliary-model.json`, and `auxiliary-compaction.ts` under
the selected `agent_directory/<project>/<role>/` (v1 retains
`<profile>/.local/pi-agents/dev/<project>/coder/`). Repeating preparation
refreshes these five generated files from the canonical configuration;
unrelated settings keys, packages, and extension entries are preserved.
The generated auxiliary extension is listed exactly once. Malformed existing
`settings.json` stops preparation before any file is overwritten. Other files,
credentials, and sessions in that directory are preserved.
For ordinary role previews, instructions come from the workflow roster's declared
role file, with canonical role and self-command references retained. Scenario
preparation excludes those instructions and references.

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
and independent review requirements still apply when a role performs work.
The agent directory may serve multiple Pi sessions and does not identify any
one of them. Pi's adapter remains an execution interface without roster
lifecycle support.

## Effects and errors

Only the selected profile's ignored `.local/pi-agents` directory is changed.
No installation, network call, launch, or host task mutation occurs. Missing
or duplicate profile, command, workflow, project, provider, model, or role
configuration stops preparation with `PI_AGENTS_CONFIGURATION_ERROR`.
Symlinks in profile source and output paths are rejected.
