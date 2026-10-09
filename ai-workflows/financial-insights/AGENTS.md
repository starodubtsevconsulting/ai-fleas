# Financial Insights Workflow

This workflow configures agents for financial data analysis, bookkeeping, and tax preparation using local AI.

## Key Files

* `agents.yml` - Declares workflow agents (admin + bookkeeper)
* `agents/roles/bookkeeper.md` - Role definition for bookkeeper agent
* `financial-insights.workflow.md` - Workflow documentation
* `evidence-contract.md` - Evidence format and quality standards
* `acceptance/governor-delegation.md` - Delegation patterns for Admin

## Agent Management

### Only Bookkeeper

As of Financial Insights v2, this workflow uses only **one worker agent**:
* `bookkeeper` - Handles bookkeeping tasks, tax preparation, and financial analysis

The `admin` agent is automatically provided by the Personal Governor and is not listed in `agents.yml`.

### Why Only Bookkeeper?

The `financial-analyst` and `financial-reviewer` agents were removed because:
1. They added complexity without significant benefit
2. The bookkeeper can handle all financial tasks with proper prompting
3. Fewer agents mean lower token costs and simpler configuration

### Adding More Agents

If you need to add more agents to this workflow:

1. Create role definition in `agents/roles/<agent-id>.md`
2. Add entry to `agents.yml` with proper fields
3. Update `../../ai-profile/sc/commands-config/hermes-agents/config.yml` to add agent to roles and callers
4. Run `hermes-agents reconcile` to initialize the profile
5. Update tests in `platforms/gpt-agents/agents/financial-insights-roster.test.mjs`

See `../../AGENTS.md` for full instructions.

## Configuration

Runtime configuration is stored in `../../ai-profile/sc/commands-config/hermes-agents/config.yml`:
* `workflow_agents.financial-insights.roles` - List of agent IDs
* `auxiliary_models.financial-insights` - Model settings and task timeouts

## Common Commands

```bash
# Initialize/update Hermes profiles
./ai-commands/system/hermes-agents/hermes-agents.command.sh reconcile --work-profile sc --workflow financial-insights

# Verify configuration
node ai-commands/system/hermes-agents/src/resolve-workflow-scope.mjs /Users/sergii/projects/sc/ai-fleas/ai-profile sc financial-insights
```

## Testing

Run tests with:
```bash
node platforms/gpt-agents/agents/financial-insights-roster.test.mjs
```

This verifies that the roster contains the expected agents and roles.
