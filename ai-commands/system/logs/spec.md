# Logs Command Specification

This document describes the logs inspection command for inspecting service logs on remote servers.

## Overview

The `logs` command provides a quick way to inspect service logs on remote servers via SSH and journalctl. It categorizes log entries by type and reports a summary of recent activity.

## Use Cases

- Check recent errors on a production service
- Review 404 responses (common in web applications)
- Monitor service uptime and restarts
- Investigate issues after deployment

## Command Syntax

```
logs.command.sh --host <host> --service <service> [--since <time>]
```

## Flags

| Flag | Required | Description |
|---|---|---|
| `--host` | Yes | SSH host to connect to (e.g., `infra-01`) |
| `--service` | Yes | systemd service name (e.g., `umbrella-v2.service`) |
| `--since` | No | Time range (e.g., `'yesterday'`, `'2026-10-01'`, `'10-07 00:00:00'`). Defaults to `'yesterday'` |
| `--help` | No | Show help message |

## Log Categories

The command categorizes log entries as:

- **ERROR**: Error-level log entries
- **WARNING**: Warning-level log entries
- **404**: HTTP 404 (not found) responses
- **INFO**: Informational messages
- **OTHER**: Other log entries

## Example Output

```
=== Service Status ===
Active: active (running) since Thu 2026-10-01 22:11:51 EDT
Main PID: 2262554 (MainThread)
Loaded: loaded (/etc/systemd/user/umbrella-v2.service; enabled; vendor preset: enabled)

=== Log Summary (Last 1h) ===
ERROR: 0
WARNING: 0
404: 12
INFO: 5
OTHER: 3

=== Sample Error Entries (Last 5) ===
Oct 08 14:27:44 infra-01 start.sh[2262554]: [Nest] 2262554  - 10/08/2026, 2:27:44 PM   ERROR [ExceptionsHandler] [Error: ENOENT: no such file or directory, stat '/home/sergii/projects/sc/sc-services/apps/ai-fleas-site/public/wp-login.php']

=== Service Uptime ===
ActiveEnterTimestamp=Thu 2026-10-01 22:11:51 EDT
NRestarts=0
```

## Integration with AI Commands

This command is designed to work with the AI Fleas command system. It can be invoked through:

```
${AI_COMMANDS_ROOT}/logs/logs.command.sh --host infra-01 --service umbrella-v2.service
```

## Configuration

Copy `logs.command.example.config` to your profile and set values as needed:

```yaml
name: logs
config:
  - name: default_since
    type: string
    default: 1h
  - name: ssh_user
    type: string
    default: sergii
```

## Notes

- Requires SSH access to the target host
- Uses `journalctl` for log retrieval (systemd-based servers)
- Log parsing is simple pattern matching - no structured log parsing
- Error counts are case-insensitive matches of keywords
