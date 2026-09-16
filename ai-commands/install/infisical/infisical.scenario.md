# Infisical real-host acceptance scenario

## Outcome

Exercise the public command on an explicitly selected disposable Linux Docker deployment. Verify initial provisioning,
idempotent reconciliation, truthful stopped status, restart, and preservation of keys, database data and persistent-volume
identity. End with the test services stopped and resources retained.

This scenario is distinct from adopting or reinstalling a manual deployment. The harness uses only the profile's explicit
SSH/root/project/image selection; it never scans for or removes another service.

## Preconditions

The operator authorizes a real-host test and selects its profile/workflow. That workflow permits `infisical` and binds its
private `config.env`. The SSH user has a trusted host key, batch authentication, writable deployment parent, Python 3,
Docker access, and Compose 2 or later. Fresh capacity and port checks must pass.

Choose approved real image digests and a separate root/project. The harness requires both root basename and project name
to end in `-test`, `ACCESS_MODE=core`, a loopback HTTP `SITE_URL`, and no SMTP reference. This scenario deliberately tests
the three-service core topology; Cloudflare mode needs the separate end-to-end TLS and Access checks in the specification.
Those are test-target constraints, not restrictions on ordinary installer configurations. An unchanged catalog template
cannot execute.

Illustrative non-secret values, to put in the selected private config with its other required settings:

```dotenv
SSH_TARGET="example-server"
REMOTE_ROOT="/opt/example-secret-service-test"
PROJECT_NAME="example-secrets-test"
SITE_URL="http://127.0.0.1:18080"
ACCESS_MODE="core"
BACKEND_PORT=18080
SMTP_ENV_FILE=""
```

The parent must already exist and be writable; the command does not elevate privileges. Do not use this fixture against
a real secret-bearing deployment merely by renaming its identity.

## Invocation

Activate the selected private profile/workflow through the normal host, then run:

```bash
"${AI_COMMANDS_ROOT}/install/infisical/infisical.command.smoke.test.sh" --apply
```

The launcher applies the common profile guard. The explicit `--apply` covers install/start/stop operations and creation
of a test-only database marker. Its companion [smoke_test.py](smoke_test.py) invokes the actual public entry point, not a
replacement provisioning script.

## Required checks

| Step | Check |
|---|---|
| 1 | `validate` returns validated with no network. |
| 2 | `qualify` returns qualified for the selected Linux host. |
| 3 | `install --apply` provisions or reconciles only the package-owned core test stack and reports all three services healthy. For initial-install evidence, start with a fresh unused test root/project. |
| 4 | `status` reports healthy with actual image, ownership, network and listener checks. |
| 5 | Capture private SHA-256 fingerprints of the three credential files and persistent-volume names/creation times. Store them in protected remote `smoke-test-baseline.json`; never print them. |
| 6 | Insert `persistent-marker` into the test database's dedicated `ai_fleas_installer_acceptance.marker` table. No real secret is enrolled. |
| 7 | Rerun `install --apply`; verify original fingerprints, volume identities and marker. |
| 8 | `stop --apply` returns stopped. |
| 9 | `status` returns blocked/nonzero for stopped services. |
| 10 | `start --apply` returns all three services healthy. |
| 11 | Verify unchanged keys/volume identities and the stored database marker again. |
| 12 | Final `stop --apply` succeeds, preserving test data and configuration. |

The probe verifies package ownership and files before touching the test database. It executes local `psql` inside only
the selected database container and does not transmit passwords to the agent. Existing protected baselines are checked,
not rewritten to hide a mismatch. Failures return the failed stage and completed stages without raw tool output, database
contents or credential values. If execution has begun, the harness attempts a final scoped stop; a failed stop is reported
with resources retained. It never deletes volumes or claims restoration succeeded.

Successful output includes `status: PASSED`, completed stages, `testStackStopped: true`, `keysAndDataPreserved: true`.
Success exit is 0; failure is nonzero. Keep the receipt with private test evidence. A stopped test stack remains available
for investigation or another explicitly selected run; cleanup/purge needs a separate preservation decision.

## Limits and integration acceptance

This verifies application/database/cache startup and persistence on the selected host and pins. It does not create an
owner account, test real user login, install HTTPS/SMTP, restore backups, implement runtime secret retrieval, or reboot the
machine. Complete those separate criteria in [spec.md](spec.md) before claiming production acceptance.

When another live service shares the host, capture its file/key fingerprints, containers, volumes, and normal verified
health before testing, then compare them afterward through a private operator procedure. The public harness must not
infer that service's deployment root or credential locations. Keep real hostnames, certificate paths, controller routes,
tokens and the preservation baseline in private configuration/evidence.
