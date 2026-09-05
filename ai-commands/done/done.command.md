# done.command

## Roles

- `planner`

Use to confirm the Definition of Done checklist before merging or closing work.
Ensure active session context and tracked scope are fully covered (all items completed); the checklist below extends that.

The canonical reusable checklist is `definition-of-done.json`. Definition of Done is a machine-operational session-plan
checkpoint, not a ticket comment or informal PR checklist. Each applicable item is `passed` with evidence,
`not-applicable` with a concrete reason, or `blocked` with the next action. Implementation, commit, push, draft PR, or
tracker status never marks an unresolved item complete.

## Definition of Done

- Code changes are reviewed and align with requirements. (use `commands/review/review.command.md`)
- After push, run review and resolve all required findings. (use `commands/review/review.command.md`)
- Documentation exists and reflects the final behavior. (use `commands/doc/doc.command.md` or
`commands/new-feature-doc/new-feature-doc.command.md`)
- Tests cover the changes. (use `commands/test/test.command.md` and `commands/sonar-qube/sonar-qube.command.md`)
- Integration tests execute when behavior crosses module, service, or persistence boundaries.
- If controller changes exist, Hurl tests are present. (use `commands/smoke-tests/smoke-tests.command.md` or
`commands/hurl-test-runner/hurl-test-runner.command.md`)
- If changes are complex, documentation includes Mermaid diagrams. (use `commands/doc/doc.command.md`)
- Changes are deployable: build is green, safe to deploy to `main`, and test env deploy/validation is done. (use
`commands/test/test.command.md`, `commands/sonar-qube/sonar-qube.command.md`, and
`commands/smoke-tests/smoke-tests.command.md`)
- Ensure the service is runnable from aws-local locally against dev before deploying to dev. (use
`commands/springboot/springboot.command.md` and `commands/smoke-tests/smoke-tests.command.md`)
- Snyk report is clean/acceptable post-merge to `main`, unless the selected project entry in
`commands/projects/projects-registry.yml` marks Snyk as not required. (use `commands/snyk/snyk.command.md`)
- IDE settings are aligned for the project. (use `commands/ide/ide.command.md`)
- A short spoken wrap-up is generated via `commands/voice-report/app.sh` according to
`commands/voice-report/voice-report.command.md`; final completion is mandatory here, and milestone-level use may happen
earlier in the workflow.

## Steps

1. Start from `definition-of-done.json` and validate every applicable item against the current change set.
2. Update the active `session-plan.md` verification matrix with status, evidence or reason, owner, and next action.
3. Report missing or blocked items and route the next applicable gate.
4. State that Definition of Done is met only when every applicable item is `passed` with evidence.
5. When work is done, run `commands/voice-report/app.sh --text "..."` with a brief spoken summary of what was completed
and any important follow-up. Do not call `voice-report.command.sh` directly from done flow.

## Inputs

- See command description
- AI_FLOW_PROJECT_DIR / AI_FLOW_OUTPUT_DIR when applicable

## Output

- Updated files/logs/reports described above
- Terminal output and exit status
