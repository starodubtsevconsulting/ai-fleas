# Profile resolver

Resolve one exact registered profile, workflow, optional safe workflow instance, catalog roots, command binding, and
governance-rule surface. The base logical project is `<profile>-<workflow>`; `--instance ID` resolves
`<profile>-<workflow>-<instance>` without changing profile, workflow, commands, or role contracts. Unsafe IDs, unregistered
workflows or commands, missing roots, and missing or unsafe governance-surface paths are `PROFILE_BLOCKED`.

The resolver emits `PROFILE_ID`, `WORKFLOW_ID`, `WORKFLOW_INSTANCE_ID`, `LOGICAL_PROJECT_ID`, `AI_COMMANDS_ROOT`,
`AI_WORKFLOWS_ROOT`, `AI_GOVERNANCE_RULES_REPOSITORY`, `AI_GOVERNANCE_RULES_ROOT`,
`AI_GOVERNANCE_RULES_SURFACE`, and optional `COMMAND_CONFIG`. It grants no product, tracker, repository mutation, browser,
or agent-lifecycle authority.
