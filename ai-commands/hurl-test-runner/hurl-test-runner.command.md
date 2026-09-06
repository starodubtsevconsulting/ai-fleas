# hurl-test-runner.command

## Purpose

Use `hurl-test-runner` to execute configured Hurl HTTP tests and return request-level validation evidence.

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
| `hurl-test-runner/hurl-test-runner.sh` | Shell executable | Activate the selected profile and workflow, then invoke through the host's profile-aware command runner. |

Every invocation is profile-aware: the host must verify that the active workflow allows this command, resolve `AI_COMMANDS_ROOT`, and provide any profile-owned configuration before this entry point is used.

Committed configuration template: `hurl-test-runner/hurl-test-runner.command.example.config`. Copy it into the selected profile, set only supported command value overrides, reference the copied file through `commands[].config`, and let the host expose it as `AI_COMMAND_CONFIG_PATH`. The committed example is documentation and must never be used as operational configuration.

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
   `${AI_COMMANDS_ROOT}/hurl-test-runner/hurl-test-runner.sh --service-name <svc> --stage <stage> --region <region> --secret-id
<secret> --hurl-file <path>`
4. Capture output and note whether the failure reproduces.

## Notes

- For local runs (localhost), `--secret-id` is optional.
- Expected interface is the target repo's `smoke-tests/hurl-api-caller.sh`.
- Falls back to the reusable command catalog's runner only when the project caller is missing.
