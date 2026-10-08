# Logs Command Specification

This document describes the logs inspection command for inspecting service logs on remote servers for specific apps.

## Overview

The `logs` command provides a quick way to inspect service logs on remote servers via SSH and journalctl. It categorizes log entries by type and reports a summary of recent activity for specific apps.

## Use Cases

- Check recent errors on a production service
- Review 404 responses (common in web applications)
- Monitor service uptime and restarts
- Investigate issues after deployment

## Command Syntax

```
logs.command.sh --host <host> --app <app> [--since <time>] [--until <time>]
```

## Flags

| Flag | Required | Description |
|---|---|---|
| `--host` | Yes | SSH host to connect to (e.g., `infra-01`) |
| `--app` | Yes | App name (e.g., `sc-website`, `chaletwhisper`, `locusesse`, `ai-fleas`) |
| `--since` | No | Start time range (e.g., `'yesterday'`, `'1h'`, `'1d'`, `'1w'`, `'2026-10-01'`, `'10-07 00:00:00'`). Defaults to `'yesterday'` |
| `--until` | No | End time range (e.g., `'now'`, `'1h'`, `'2026-10-08 23:59:59'`). Defaults to `'now'` |
| `--help` | No | Show help message |

## App Mapping

The command maps app names to service names and log paths:

| App | Service | Log Path |
|---|---|---|
| `sc-website` | `umbrella-v2.service` | `/home/sergii/projects/sc/sc-services` |
| `chaletwhisper` | `umbrella-v2.service` | `/home/sergii/projects/sc/sc-services` |
| `locusesse` | `locusesse-local.service` | `/home/sergii/projects/sc/sc-services` |
| `ai-fleas` | `umbrella-v2.service` | `/home/sergii/projects/sc/sc-services` |

## Time Range Formats

The command supports multiple time range formats:

| Format | Example | Description |
|---|---|---|
| Relative time | `'1h'` | Last hour |
| Relative time | `'1d'` | Last 24 hours |
| Relative time | `'1w'` | Last week |
| Relative time | `'yesterday'` | Yesterday |
| Absolute date | `'2026-10-01'` | October 1st |
| Absolute datetime | `'10-07 00:00:00'` | Oct 7th 00:00:00 |
| Absolute datetime | `'2026-10-07 00:00:00'` | Full date with time |

## Log Categories

The command categorizes log entries as:

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

=== Log Summary (Last yesterday to now) ===
ERROR: 5623
WARNING: 0
404: 9370
INFO: 70
OTHER: 31147

=== Sample Error Entries (Last 5) ===
Oct 08 15:05:01 infra-01 start.sh[2262554]:   statusCode: 404,
Oct 08 15:05:01 infra-01 start.sh[2262554]:   status: 404
Oct 08 15:05:02 infra-01 start.sh[2262554]: [Nest] 2262554  - 10/08/2026, 3:05:02 PM   ERROR [ExceptionsHandler] [Error: ENOENT: no such file or directory, stat '/home/sergii/projects/sc/sc-services/dist/apps/chaletwhisper/chaletwhisper-frontend/browser/mal.php'] {
Oct 08 15:05:02 infra-01 start.sh[2262554]:   statusCode: 404,
Oct 08 15:05:02 infra-01 start.sh[2262554]:   status: 404

=== Service Uptime ===
ActiveEnterTimestamp=Thu 2026-10-01 22:11:51 EDT
ActiveEnterTimestampMonotonic=647195880103
```

## Integration with AI Commands

This command is designed to work with the AI Fleas command system. It can be invoked through:

```
${AI_COMMANDS_ROOT}/logs/logs.command.sh --host infra-01 --app sc-website
```

## Configuration

Copy `logs.command.example.config` to your profile and set values as needed:

```yaml
name: logs
config:
  - name: default_since
    type: string
    default: yesterday
  - name: ssh_user
    type: string
    default: sergii
```

## Notes

- Requires SSH access to the target host
- Uses `journalctl` for log retrieval (systemd-based servers)
- Log parsing is simple pattern matching - no structured log parsing
- Error counts are case-insensitive matches of keywords
