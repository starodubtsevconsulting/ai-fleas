# done.command

## Purpose

Use `done` to evaluate whether work satisfies its Definition of Done and report any remaining completion gates.

## Inputs

| Input | Required | Source | Description |
|---|---|---|---|
| Active AI Profile and workflow | Yes | Host activation | Authorizes execution and resolves profile-owned configuration. |
| Detailed command inputs | As documented below | User, workflow, profile, or artifact | Command-specific values and preconditions. |

- See command description
- AI_FLOW_PROJECT_DIR / AI_FLOW_OUTPUT_DIR when applicable

## Outputs

| Output | Destination | Description |
|---|---|---|
| Detailed command outputs | Caller, configured artifact path, or authorized external system | Observable results, evidence, and effects documented below. |

- Updated files/logs/reports described above
- Terminal output and exit status

## Entry Point

| Entry point | Type | Profile-aware invocation |
|---|---|---|
| `done/done.command.md` | AI-readable contract | The initialized workflow role loads this contract after the host activates the selected profile and workflow. |

Every invocation is profile-aware: the host must verify that the active workflow allows this command, resolve `AI_COMMANDS_ROOT`, and provide any profile-owned configuration before this entry point is used.

Committed configuration template: `done/done.command.example.config`. Copy it into the selected profile, set only supported command value overrides, reference the copied file through `commands[].config`, and let the host expose it as `AI_COMMAND_CONFIG_PATH`. The committed example is documentation and must never be used as operational configuration.

## Roles

- `planner`

Use to confirm the Definition of Done checklist before merging or closing work.
Ensure active session context and tracked scope are fully covered (all items completed); the checklist below extends that.

The canonical reusable checklist is `definition-of-done.json`. Definition of Done is a machine-operational session-plan
checkpoint, not a ticket comment or informal PR checklist. Each applicable item is `passed` with evidence,
`not-applicable` with a concrete reason, or `blocked` with the next action. Implementation, commit, push, draft PR, or
tracker status never marks an unresolved item complete.

## Definition of Done

- Code changes are reviewed and align with requirements. (use `ai-commands/review/review.command.md`)
- After push, run review and resolve all required findings. (use `ai-commands/review/review.command.md`)
- Documentation exists and reflects the final behavior. (use `ai-commands/doc/doc.command.md` or
`ai-commands/new-feature-doc/new-feature-doc.command.md`)
- Tests cover the changes. (use `ai-commands/test/test.command.md` and `ai-commands/sonar-qube/sonar-qube.command.md`)
- Integration tests execute when behavior crosses module, service, or persistence boundaries.
- If controller changes exist, Hurl tests are present. (use `ai-commands/smoke-tests/smoke-tests.command.md` or
`ai-commands/hurl-test-runner/hurl-test-runner.command.md`)
- If changes are complex, documentation includes Mermaid diagrams. (use `ai-commands/doc/doc.command.md`)
- Changes are deployable: build is green, safe to deploy to `main`, and test env deploy/validation is done. (use
`ai-commands/test/test.command.md`, `ai-commands/sonar-qube/sonar-qube.command.md`, and
`ai-commands/smoke-tests/smoke-tests.command.md`)
- Ensure the service is runnable from aws-local locally against dev before deploying to dev. (use
`ai-commands/springboot/springboot.command.md` and `ai-commands/smoke-tests/smoke-tests.command.md`)
- Snyk report is clean/acceptable post-merge to `main`, unless the selected project entry in
the selected profile project definition (`AI_PROFILE_PROJECT_FILE`) marks Snyk as not required. (use `ai-commands/snyk/snyk.command.md`)
- IDE settings are aligned for the project. (use `ai-commands/ide/ide.command.md`)
- A short spoken wrap-up is generated via `ai-commands/voice-report/app.sh` according to
`ai-commands/voice-report/voice-report.command.md`; final completion is mandatory here, and milestone-level use may happen
earlier in the workflow.

## Steps

1. Start from `definition-of-done.json` and validate every applicable item against the current change set.
2. Update the active `session-plan.md` verification matrix with status, evidence or reason, owner, and next action.
3. Report missing or blocked items and route the next applicable gate.
4. State that Definition of Done is met only when every applicable item is `passed` with evidence.
5. When work is done, run `ai-commands/voice-report/app.sh --text "..."` with a brief spoken summary of what was completed
and any important follow-up. Do not call `voice-report.command.sh` directly from done flow.
