# Lodgify

## Purpose

Use `lodgify` to inspect or perform explicitly authorized Lodgify property and reservation operations.

## Inputs

| Input | Required | Source | Description |
|---|---|---|---|
| Active AI Profile and workflow | Yes | Host activation | Authorizes the command and resolves profile-owned configuration. |
| Command-specific input | Yes | User, workflow, profile, or source artifact | Lodgify operation, date/property scope, and profile-owned credentials/configuration. |

## Outputs

| Output | Destination | Description |
|---|---|---|
| Command result | Caller, configured artifact path, or authorized external system | API result, report artifact, or explicit blocked/failure result. |

`lodgify connection-test` is a separately authorized, minimal read-only
`GET /v1/properties` probe using `X-ApiKey`; it returns only a bounded status
and confirms that the configured `RENTAL_ID` is accessible. `lodgify
quarter-report` produces an export only after an explicit approved output
directory is supplied; it is never Accounting ingestion. Output is built
mode 0600 and atomically published without overwrite as
`YYYY-qN_lodgify_booking-report.csv`.

Connection statuses are closed and redacted: `connected`, `authentication-failed`,
`bad-request`, `endpoint-not-found`, `service-unavailable`, `network-failed`,
`rate-limited`, `timeout`, `property-not-accessible`, `schema-drift`, or
`request-failed`.

Operational configuration must live under the selected profile, never beside this reusable command. The host passes its
resolved profile override through `LODGIFY_CONFIG_PATH` (or the generic `AI_COMMAND_CONFIG_PATH`). The command refuses to
run without that explicit path. `USER_ID` is never sent. P4 remains blocked.

Live acceptance is prohibited until the user rotates the previously exposed API
key. Synthetic tests exercise all request paths without contacting Lodgify.

Uses `GET /v2/reservations/bookings?HouseId=<property>` with `X-ApiKey`, per the
verified Augmenta capability map/source adapter. The v1 offline endpoint is not
used. Contract tests own the required response schema; schema drift fails closed.

Only calendar-quarter check-in inclusion is emitted. Current-quarter end is the
execution date; completed or closed quarters need explicit authorization.
Cross-quarter stays remain whole and are flagged for Accounting review. The
command is read-only, bounded, and never logs API keys, identifiers, URLs,
responses, or guest data. It stages a mode-0600 RFC4180 CSV and atomically
publishes it without overwrite to the approved output directory; Accounting
handoff/P4 is blocked pending an approved prepare endpoint.

Live reads require separate authorization. `--dry-run` validates local config
without contacting Lodgify.

`LODGIFY_TEST_ORIGIN=1` is reserved for the synthetic test harness. It permits
only a loopback `LODGIFY_API_BASE_URL`; it is not a CLI option and cannot
authorize a live read. Normal command execution accepts only the Lodgify API
origin.

For bounded retries, `Retry-After` supports numeric seconds only and is capped
at one second within the single request-operation deadline.

The profile-owned config maps `API_KEY` to the `X-ApiKey` header and `RENTAL_ID` to the
v2 `HouseId` query parameter, following the verified Augmenta source contract.
`USER_ID` is local context only and is never transmitted by this endpoint.
This mapping is stub-contract verified only; it requires separate confirmation
before any live read. P4 Accounting handoff remains blocked.

## Entry Point

| Entry point | Type | Profile-aware invocation |
|---|---|---|
| `lodgify/lodgify.command.mjs` | Node executable | Activate the selected profile and workflow, then invoke through the host's profile-aware command runner. |

Every invocation is profile-aware: the host must verify that the active workflow allows this command, resolve `AI_COMMANDS_ROOT`, and provide any profile-owned configuration before this entry point is used.

Committed configuration template: `lodgify/lodgify.command.example.config`. Copy it into the selected profile, set only supported command value overrides, reference the copied file through `commands[].config`, and let the host expose it as `AI_COMMAND_CONFIG_PATH`. The committed example is documentation and must never be used as operational configuration.
