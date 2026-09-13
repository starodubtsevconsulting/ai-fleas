#!/usr/bin/env bash
exec "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)/connect/browser/browser.command.sh" "$@"
