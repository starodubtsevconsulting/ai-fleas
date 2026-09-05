# new-feature-doc.command

## Roles

- `developer`

Purpose: ensure every effort has a documentation page (in `/documentation/`) that reads like the final artifact, not a
ticket placeholder. Name it after the feature/outcome (e.g., `dependency-vulnerability-remediation.md`), not the Jira
ID.

Steps:

1. Configure defaults
   - See `commands/new-feature-doc/new-feature-doc.command.conf` (example template included).
2. Create/update doc
   - If no doc exists, add `/documentation/<descriptive-name>.md` (no ticket number in filename).
   - Title should be human-readable (e.g., “Dependency Vulnerability Remediation (Snyk/Sonar)”).
   - Write it as a final, done-state narrative/decision log (not a task checklist) and keep it ticket-neutral (no
timeboxes or ticket numbers). Lead with context written as achieved (“has refreshed…”, “delivers…”), scope, decisions,
links, testing/validation notes; use TODO placeholders where inputs are missing.
   - Include a top-level `## Show Context` section when the feature needs manual UI validation, external docs,
Slack/support links, generated reports, or local artifact paths. This section is the preferred input for
`show-context`; keep it short and focused on what should be opened for human understanding.
   - Include a top-level `## Deploy Risk Report` section for any feature that may ship to prod or be used in prod
readiness. Use `- Report: TODO` until the deploy risk report exists, then replace it with a link or repo-relative path
to that report. Use `- Report: N/A - <reason>` only for docs unrelated to prod runtime rollout readiness.
   - Keep it updated as work progresses (versions applied, test evidence, follow-ups).
3. Reference in session/output context
   - Add the doc path to the active session notes/output artifacts (for example under `.ai/`).
4. Keep in sync
   - Update after major changes, before PR, and after validation runs (tests/Snyk/Sonar).
5. Commit policy
   - The doc should be committed with the feature work (session/runtime state stays local).

## Test authoring reminders (for new/updated tests)

- Use `@DisplayName("Should ...")` on tests.
- Use inline `// GIVEN // WHEN // THEN` comments in test bodies to clarify intent.

## Inputs

- See command description
- AI_FLOW_PROJECT_DIR / AI_FLOW_OUTPUT_DIR when applicable

## Output

- Updated files/logs/reports described above
- Terminal output and exit status
