# Lodgify

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

The private `lodgify.config` is ignored and never read except by the command at
execution. `USER_ID` is never sent. P4 remains blocked.

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

Local config maps `API_KEY` to the `X-ApiKey` header and `RENTAL_ID` to the
v2 `HouseId` query parameter, following the verified Augmenta source contract.
`USER_ID` is local context only and is never transmitted by this endpoint.
This mapping is stub-contract verified only; it requires separate confirmation
before any live read. P4 Accounting handoff remains blocked.
