# Hermes Agents Command Configuration

This directory contains configuration files for the `hermes-agents` command that interfaces with the Hermes Desktop app.

## Key Files

* `setup-hermes-profile.sh` - Script that creates Hermes profile directories and config files for workflow agents
* `spec.md` - Technical specification for the hermes-agents command behavior
* `hermes-agents.command.sh` - Main command shell script
* `src/resolve-workflow-scope.mjs` - Node.js script that resolves workflow configuration and outputs profile info

## Important Behaviors

* The command uses `HERMES_HOME` internally to locate the Hermes Desktop app's data directory
* Running the command while `HERMES_HOME` is set externally (e.g., to `/Users/sergii/.hermes/profiles/sc-dev-coder`) causes path calculation errors
* The `setup-hermes-profile.sh` script uses a 3-dot path (`../..`) to locate the hermes-agents directory - this assumes the script is run from `ai-commands/system/hermes-agents/setup-hermes-profile.sh`
* The `resolve-workflow-scope.mjs` script validates that workflow roles are declared exactly once across both `ai-workflows/<workflow>/agents.yml` and `ai-profile/sc/commands-config/hermes-agents/config.yml`

## Debugging

To verify configuration consistency:
```bash
node ai-commands/system/hermes-agents/src/resolve-workflow-scope.mjs /Users/sergii/projects/sc/ai-fleas/ai-profile sc <workflow-id>
```

If this fails with "role X is not declared exactly once", check:
1. The agent is in `ai-workflows/<workflow>/agents.yml`
2. The agent is in `ai-profile/sc/commands-config/hermes-agents/config.yml`
3. The agent's role definition file exists in `ai-workflows/<workflow>/agents/roles/`

## Workflow Initialization

To initialize or update a workflow's Hermes profiles:
```bash
./ai-commands/system/hermes-agents/hermes-agents.command.sh reconcile --work-profile sc --workflow <workflow-id>
```

This command:
1. Reads the workflow configuration from `ai-workflows/<workflow>/agents.yml`
2. Reads runtime configuration from `ai-profile/sc/commands-config/hermes-agents/config.yml`
3. Creates/updates Hermes profile directories under `~/.hermes/profiles/sc-<workflow>-<agent>`
4. Writes binding receipts to `ai-profile/sc/.local/hermes-agents/bindings.yml`
