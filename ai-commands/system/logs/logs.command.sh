#!/bin/bash
# logs.command.sh
# Purpose: Inspect service logs on remote servers via SSH and journalctl for specific apps
# Called by: ai-commands command runner
# Inputs: --host <host> --app <app> [--since <time>]
# Effects: Reads remote logs via SSH, reports summary to stdout

set -e

# Default values
HOST=""
APP=""
SINCE="yesterday"
SHOW_HELP=false

# Resolve service name from app name (using if/else instead of associative array for compatibility)
resolve_service() {
    case "$1" in
        sc-website|chaletwhisper|ai-fleas)
            echo "umbrella-v2.service"
            ;;
        locusesse)
            echo "locusesse-local.service"
            ;;
        *)
            echo ""
            ;;
    esac
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --host)
            HOST="$2"
            shift 2
            ;;
        --app)
            APP="$2"
            shift 2
            ;;
        --since)
            SINCE="$2"
            shift 2
            ;;
        --help)
            SHOW_HELP=true
            shift
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Show help if requested or required flags missing
if $SHOW_HELP || [[ -z "$HOST" ]] || [[ -z "$APP" ]]; then
    echo "Usage: $0 --host <host> --app <app> [--since <time>]"
    echo ""
    echo "Inspect service logs on remote servers via SSH and journalctl for specific apps"
    echo ""
    echo "Options:"
    echo "  --host <host>     SSH host to connect to (required)"
    echo "  --app <app>       App name (required). Supported: sc-website, chaletwhisper, locusesse, ai-fleas"
    echo "  --since <time>    Time range (e.g., 'yesterday', '2026-10-01', '10-07 00:00:00'). Defaults to 'yesterday'"
    echo "  --help            Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 --host infra-01 --app sc-website"
    echo "  $0 --host infra-01 --app chaletwhisper --since 'yesterday'"
    echo "  $0 --host infra-01 --app locusesse --since '2026-10-07 00:00:00'"
    exit 0
fi

# Resolve service name from app name
SERVICE=$(resolve_service "$APP")
if [[ -z "$SERVICE" ]]; then
    echo "Error: Unknown app '$APP'. Supported apps: sc-website, chaletwhisper, locusesse, ai-fleas"
    exit 1
fi

# Connect to remote server and fetch logs
echo "=== App: $APP ==="
echo "=== Service Status ==="
ssh "$HOST" "systemctl --user status $SERVICE | grep -E 'Active|Main PID|Loaded' | head -5"
echo ""

# Fetch and categorize logs
echo "=== Log Summary (Last $SINCE) ==="

# Get logs for the specified time range
LOGS=$(ssh "$HOST" "journalctl --user -u $SERVICE --since '$SINCE' --no-pager 2>/dev/null" || echo "")

# Count errors
ERROR_COUNT=$(echo "$LOGS" | grep -ci "ERROR" 2>/dev/null | head -1 || echo "0")
ERROR_COUNT=${ERROR_COUNT:-0}

# Count warnings  
WARNING_COUNT=$(echo "$LOGS" | grep -ci "WARNING" 2>/dev/null | head -1 || echo "0")
WARNING_COUNT=${WARNING_COUNT:-0}

# Count 404s (common in nginx/Node.js logs)
ERROR_404_COUNT=$(echo "$LOGS" | grep -ci "404" 2>/dev/null | head -1 || echo "0")
ERROR_404_COUNT=${ERROR_404_COUNT:-0}

# Count INFO messages
INFO_COUNT=$(echo "$LOGS" | grep -ci "INFO" 2>/dev/null | head -1 || echo "0")
INFO_COUNT=${INFO_COUNT:-0}

# Count OTHER entries
OTHER_COUNT=$(echo "$LOGS" | grep -cvE "ERROR|WARNING|404|INFO" 2>/dev/null | head -1 || echo "0")
OTHER_COUNT=${OTHER_COUNT:-0}

echo "ERROR: $ERROR_COUNT"
echo "WARNING: $WARNING_COUNT"
echo "404: $ERROR_404_COUNT"
echo "INFO: $INFO_COUNT"
echo "OTHER: $OTHER_COUNT"
echo ""

# Show sample errors if any
if [[ "$ERROR_COUNT" -gt 0 ]] || [[ "$ERROR_404_COUNT" -gt 0 ]]; then
    echo "=== Sample Error Entries (Last 5) ==="
    echo "$LOGS" | grep -E "ERROR|404" | tail -5
    echo ""
fi

# Show service uptime
echo "=== Service Uptime ==="
ssh "$HOST" "systemctl --user show $SERVICE | grep -E 'ActiveEnterTimestamp|NRestarts' | head -2"
