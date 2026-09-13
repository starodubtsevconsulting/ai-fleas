#!/usr/bin/env bash
if [[ -n "${ROOT_DIR:-}" && "$(basename "$ROOT_DIR")" == "ai-commands" ]]; then
  ROOT_DIR="$(cd "$ROOT_DIR/.." && pwd -P)"
fi
source "$ROOT_DIR/.codex/session.sh"
