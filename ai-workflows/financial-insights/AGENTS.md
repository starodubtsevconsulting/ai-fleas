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

`agents.yml` declares `admin` as its initializer and `bookkeeper` as its worker.
Admin follows the canonical human-owned bootstrap contract; it is not an
automatically initialized Governor-provided worker.

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

Runtime configuration belongs to the selected authorized profile's configurable
command roots. Do not assume the repository-local private `ai-profile/sc` tree
is the operational source. The following Hermes keys apply to that profile's
`commands-config/hermes-agents/config.yml`:
* `workflow_agents.financial-insights.roles` - List of agent IDs
* `auxiliary_models.financial-insights` - Model settings and task timeouts

Effective platform selection uses the profile default, then workflow platform,
then role platform override. Pi version-2 model choices belong to that
profile's existing `pi-agents` configuration; optional scenario sessions do not
initialize managed roles. See the [compatible benchmark scenario](acceptance/financial-insights-compatible.scenario.md)
and its [configuration guide](../../notes/benchmarks/local-models/fixtures/financial-insights-compatible/README.md#selecting-configuration).
Test variant IDs are benchmark settings, not new work-profile authority.

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

## Self-Learning

When you work on the financial-insights workflow:

1. **Check this AGENTS.md first** for workflow patterns and agent management
2. **Extract learnings** when you discover new patterns
3. **Use self-learning command** to formalize:
   ```bash
   self-learning extract financial-insights
   ```

This AGENTS.md captures workflow-specific patterns - use it before modifying workflow config.

See `ai-commands/utility/self-learning/self-learning.command.md` for the full self-learning contract.
