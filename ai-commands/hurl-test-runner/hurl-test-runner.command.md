# hurl-test-runner.command

## Roles

- `qa`

Use when you need to run a single Hurl file with the correct service context
without executing the full smoke test suite.

## Steps

1. Identify the target Hurl file and the owning service repo.
2. Choose stage/region and confirm AWS auth for non-local usage.
   - Ensure the required AWS auth is active for the target environment.
   - Run from a terminal session that has the required AWS credentials.
3. Run:
   `./commands/hurl-test-runner/hurl-test-runner.sh --service-name <svc> --stage <stage> --region <region> --secret-id
<secret> --hurl-file <path>`
4. Capture output and note whether the failure reproduces.

## Notes

- For local runs (localhost), `--secret-id` is optional.
- Expected interface is the target repo's `smoke-tests/hurl-api-caller.sh`.
- Falls back to the reusable command catalog's runner only when the project caller is missing.

## Inputs

- See command description
- AI_FLOW_PROJECT_DIR / AI_FLOW_OUTPUT_DIR when applicable

## Output

- Updated files/logs/reports described above
- Terminal output and exit status
