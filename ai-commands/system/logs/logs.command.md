# logs.command

## Purpose

Use `logs` to inspect service logs on a remote server and report a summary of recent activity.

## Inputs

| Input | Required | Source | Description |
|---|---|---|---|
| Active AI Profile and workflow | Yes | Host activation | Authorizes execution and resolves profile-owned configuration. |
| Server host | Yes | `--host` flag | SSH host to connect to (e.g., `infra-01`). |
| Service name | Yes | `--service` flag | systemd service name (e.g., `umbrella-v2.service`). |
| Time range | No | `--since` flag | Time range (e.g., `1h`, `30m`, `1d`). Defaults to `1h`. |

## Outputs

| Output | Destination | Description |
|---|---|---|
| Log summary | Terminal | Recent log entries categorized by type (errors, warnings, 404s, etc.) |
| Error count | Terminal | Count of error-level entries |
| Warning count | Terminal | Count of warning-level entries |
| 404 count | Terminal | Count of 404 (not found) responses |
| Service status | Terminal | Current service state (running/stopped) |

## Entry Point

| Entry point | Type | Profile-aware invocation |
|---|---|---|
| `logs/logs.command.sh` | Shell executable | Activate the selected profile and workflow, then invoke through the host's profile-aware command runner. |

## Usage

- `${AI_COMMANDS_ROOT}/logs/logs.command.sh --host <host> --service <service> [--since <time>]`

Examples:
- `logs/logs.command.sh --host infra-01 --service umbrella-v2.service`
- `logs/logs.command.sh --host infra-01 --service umbrella-v2.service --since 24h`

## Flags

- `--host <host>`: SSH host to connect to (required)
- `--service <service>`: systemd service name (required)
- `--since <time>`: Time range (e.g., `1h`, `30m`, `1d`, `24h`). Defaults to `1h`.
- `--help`: Show help message

## Steps

1. Validate required flags (`--host`, `--service`)
2. Connect to remote server via SSH
3. Check service status
4. Fetch logs for the specified time range
5. Parse and categorize log entries
6. Report summary with counts and sample entries

## Notes

- Requires `ssh` access to the target host
- Uses `journalctl` for log retrieval
- Log entries are categorized by:
  - **ERROR**: Error-level log entries
  - **WARNING**: Warning-level log entries  
  - **404**: HTTP 404 (not found) responses
  - **INFO**: Informational messages
  - **OTHER**: Other log entries

## Example Output

```
=== Service Status ===
Active: active (running) since Mon 2026-10-01 22:11:51 EDT

=== Log Summary (Last 24h) ===
ERROR: 0
WARNING: 0
404: 45
INFO: 12
OTHER: 8

=== Sample 404 Errors (Last 5) ===
Oct 08 14:27:44 infra-01 start.sh[2262554]: [Nest] 2262554  - 10/08/2026, 2:27:44 PM   ERROR [ExceptionsHandler] [Error: ENOENT: no such file or directory, stat '/home/sergii/projects/sc/sc-services/apps/ai-fleas-site/public/wp-login.php']
...
```
