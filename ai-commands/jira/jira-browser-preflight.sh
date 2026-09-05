#!/usr/bin/env bash
set -euo pipefail

OS_NAME="${JIRA_OS_NAME:-$(uname -s)}"
if [[ "$OS_NAME" != "Darwin" ]]; then
  echo "JIRA_BROWSER_PREFLIGHT: skipped ($OS_NAME)"
  exit 0
fi

OSASCRIPT_BIN="${JIRA_OSASCRIPT_BIN:-osascript}"
if ! command -v "$OSASCRIPT_BIN" >/dev/null 2>&1; then
  echo "Jira active-browser integration requires osascript on macOS." >&2
  exit 1
fi

if ! output=$("$OSASCRIPT_BIN" \
  -e 'tell application id "com.google.Chrome"' \
  -e 'if (count of windows) is 0 then error "NO_ACTIVE_CHROME_WINDOW"' \
  -e 'return execute active tab of front window javascript "document.title"' \
  -e 'end tell' 2>&1); then
  if [[ "$output" == *"Executing JavaScript through AppleScript is turned off"* ]]; then
    echo "Jira requires JavaScript access to the active Chrome session." >&2
    echo "In Chrome enable: View > Developer > Allow JavaScript from Apple Events" >&2
  elif [[ "$output" == *"application id \"com.google.Chrome\""* || "$output" == *"(-1728)"* ]]; then
    echo "JIRA_APPLE_EVENTS_ACCESS_UNAVAILABLE: the current runtime could not address Google Chrome through Apple Events." >&2
    echo "Retry the same registered Jira command once with desktop/Apple Events escalation before classifying Chrome or Jira as unavailable." >&2
    echo "Observed AppleScript result: $output" >&2
  else
    echo "Jira could not access an active Chrome window: $output" >&2
  fi
  exit 1
fi

echo "JIRA_BROWSER_PREFLIGHT: active Chrome JavaScript enabled"
