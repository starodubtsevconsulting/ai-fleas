#!/usr/bin/env bash
set -euo pipefail

TEMPLATE=$(cat <<'EOF'
# Story: This script simulates <who/role> requesting <what>, overrides <which data>, and expects <result> across <entry points>.
# Data source: <S3 URL / fixture file / dataset reference>
# Example override: <override input / query param / payload>
# Expected shape (v1/v2): <compact JSON sketch or key fields>
EOF
)

append_file=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --file) append_file="$2"; shift 2;;
    -h|--help)
      echo "Usage: comment.command.sh [--file <path>]"
      exit 0
      ;;
    *) echo "Unknown argument: $1" >&2; exit 1;;
  esac
done

if [[ -n "$append_file" ]]; then
  printf "%s\n" "$TEMPLATE" >>"$append_file"
fi

printf "%s\n" "$TEMPLATE"
