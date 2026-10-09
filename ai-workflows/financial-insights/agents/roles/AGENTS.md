# Workflow Agent Roles

This directory contains role definitions for financial-insights workflow agents.

## Current Roles

### bookkeeper.md

The **bookkeeper** agent handles:
* Bookkeeping tasks (income, expenses, reconciliations)
* Tax preparation and filing
* Financial analysis and reporting
* Bank statement processing

## Role File Structure

Each role file follows this structure:

```markdown
schemaVersion: role-definition.v1
agentId: <agent-id>
description: |
  Detailed description of what this agent does
capabilities:
  - capability-1
  - capability-2
workflowContext: |
  How this agent fits into the workflow
```

## When Adding New Roles

1. Create `<agent-id>.md` in this directory
2. Add entry in `../agents.yml` with:
   * `agentId` matching the filename
   * `roleDefinition` pointing to this file
   * Proper lifecycle and schedule settings
3. Update `../../ai-profile/sc/commands-config/hermes-agents/config.yml` to add to roles and callers
4. Run `hermes-agents reconcile` to initialize the profile

## Naming Conventions

* Use lowercase with hyphens: `financial-analyst.md`, `tax-specialist.md`
* The `agentId` in the file must match the filename (without `.md`)
* Role files must be referenced in both `agents.yml` and `config.yml`

## Self-Learning

When you add or modify agent roles:

1. **Check this AGENTS.md first** for naming conventions and structure
2. **Extract learnings** when you discover new patterns
3. **Use self-learning command** to formalize:
   ```bash
   self-learning extract roles
   ```

This AGENTS.md captures role-specific patterns - use it before adding new roles.

See `ai-commands/utility/self-learning/self-learning.command.md` for the full self-learning contract.
