#!/usr/bin/env bash
exec "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)/utility/show-context/show-context.command.sh" "$@"
