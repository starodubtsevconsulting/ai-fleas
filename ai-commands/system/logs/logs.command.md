# logs.command

## Purpose

Use `logs` to inspect service logs for a specific app on a remote server and report a summary of recent activity.

## Inputs

| Input | Required | Source | Description |
|---|---|---|---|
| Active AI Profile and workflow | Yes | Host activation | Authorizes execution and resolves profile-owned configuration. |
| Server host | Yes | `--host` flag | SSH host to connect to (e.g., `infra-01`). |
| App name | Yes | `--app` flag | App name (e.g., `sc-website`, `chaletwhisper`, `locusesse`, `ai-fleas`). |
| Time range | No | `--since` flag | Time range (e.g., `'yesterday'`, `'2026-10-01'`). Defaults to `'yesterday'`. |

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

- `${AI_COMMANDS_ROOT}/logs/logs.command.sh --host <host> --app <app> [--since <time>]`

Examples:
- `logs/logs.command.sh --host infra-01 --app sc-website`
- `logs/logs.command.sh --host infra-01 --app chaletwhisper --since 'yesterday'`

## Flags

- `--host <host>`: SSH host to connect to (required)
- `--app <app>`: App name (required). Supported apps: `sc-website`, `chaletwhisper`, `locusesse`, `ai-fleas`
- `--since <time>`: Time range (e.g., `'yesterday'`, `'2026-10-01'`). Defaults to `'yesterday'`
- `--help`: Show help message

## Steps

1. Validate required flags (`--host`, `--app`)
2. Map app name to service name and log path
3. Connect to remote server via SSH
4. Check service status
5. Fetch logs for the specified time range
6. Parse and categorize log entries
7. Report summary with counts and sample entries

## App Mapping

The command maps app names to service names and log paths:

| App | Service | Log Path |
|---|---|---|
| `sc-website` | `umbrella-v2.service` | `/home/sergii/projects/sc/sc-services` |
| `chaletwhisper` | `umbrella-v2.service` | `/home/sergii/projects/sc/sc-services` |
| `locusesse` | `locusesse-local.service` | `/home/sergii/projects/sc/sc-services` |
| `ai-fleas` | `umbrella-v2.service` | `/home/sergii/projects/sc/sc-services` |

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
=== App: sc-website ===
=== Service Status ===
     Loaded: loaded (/home/sergii/.config/systemd/user/umbrella-v2.service; enabled; preset: enabled)
     Active: active (running) since Thu 2026-10-01 22:11:51 EDT; 6 days ago
   Main PID: 2262554 (MainThread)

=== Log Summary (Last yesterday) ===
ERROR: 5376
WARNING: 0
404: 8876
INFO: 70
OTHER: 29665

=== Sample Error Entries (Last 5) ===
Oct 08 14:27:44 infra-01 start.sh[2262554]: [Nest] 2262554  - 10/08/2026, 2:27:44 PM   ERROR [ExceptionsHandler] [Error: ENOENT: no such file or directory, stat '/home/sergii/projects/sc/sc-services/apps/ai-fleas-site/public/wp-login.php']

=== Service Uptime ===
ActiveEnterTimestamp=Thu 2026-10-01 22:11:51 EDT
ActiveEnterTimestampMonotonic=647195880103
```
