#!/usr/bin/env bash
set -euo pipefail

API_URL_DEFAULT="http://127.0.0.1:4300/api/ui/show"
API_URL="$API_URL_DEFAULT"

PATH_ARG=""
CONTENT_ARG=""
TITLE_ARG=""
CONTEXT_LABEL_ARG=""
CONTEXT_VALUE_ARG=""
CONTEXT_PATH_ARG=""
CONTENT_TYPE_ARG=""
READ_STDIN="false"

while [ $# -gt 0 ]; do
  case "$1" in
    --api-url)
      if [ $# -lt 2 ]; then
        echo "Missing value for --api-url" >&2
        exit 2
      fi
      API_URL="$2"
      shift 2
      ;;
    --path)
      if [ $# -lt 2 ]; then
        echo "Missing value for --path" >&2
        exit 2
      fi
      PATH_ARG="$2"
      shift 2
      ;;
    --content)
      if [ $# -lt 2 ]; then
        echo "Missing value for --content" >&2
        exit 2
      fi
      CONTENT_ARG="$2"
      shift 2
      ;;
    --stdin)
      READ_STDIN="true"
      shift
      ;;
    --title)
      if [ $# -lt 2 ]; then
        echo "Missing value for --title" >&2
        exit 2
      fi
      TITLE_ARG="$2"
      shift 2
      ;;
    --context-label)
      if [ $# -lt 2 ]; then
        echo "Missing value for --context-label" >&2
        exit 2
      fi
      CONTEXT_LABEL_ARG="$2"
      shift 2
      ;;
    --context-value)
      if [ $# -lt 2 ]; then
        echo "Missing value for --context-value" >&2
        exit 2
      fi
      CONTEXT_VALUE_ARG="$2"
      shift 2
      ;;
    --context-path)
      if [ $# -lt 2 ]; then
        echo "Missing value for --context-path" >&2
        exit 2
      fi
      CONTEXT_PATH_ARG="$2"
      shift 2
      ;;
    --content-type)
      if [ $# -lt 2 ]; then
        echo "Missing value for --content-type" >&2
        exit 2
      fi
      CONTENT_TYPE_ARG="$2"
      shift 2
      ;;
    --help|-h)
      cat <<'USAGE'
Usage:
  show.command.sh --path <file> [options]
  show.command.sh --content <text> [options]
  show.command.sh --stdin [options]   # read content from stdin

Options:
  --api-url <url>           API endpoint (default: http://127.0.0.1:4300/api/ui/show)
  --title <text>            Dialog title
  --context-label <text>    Context label under title
  --context-value <text>    Context value under title
  --context-path <text>     Context path under title
  --content-type <type>     text/plain or text/markdown
USAGE
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 2
      ;;
  esac
done

if [[ "$READ_STDIN" == "true" ]]; then
  CONTENT_ARG="$(cat)"
fi

if [[ -z "$PATH_ARG" && -z "$CONTENT_ARG" ]]; then
  echo "Provide --path, --content, or --stdin." >&2
  exit 2
fi

json_escape() {
  local s="$1"
  s="${s//\\/\\\\}"
  s="${s//\"/\\\"}"
  s="${s//$'\n'/\\n}"
  s="${s//$'\r'/\\r}"
  s="${s//$'\t'/\\t}"
  printf '%s' "$s"
}

payload="{"
first="true"
add_field() {
  local key="$1"
  local value="$2"
  if [[ -z "$value" ]]; then
    return
  fi
  if [[ "$first" == "true" ]]; then
    first="false"
  else
    payload+=","
  fi
  payload+="\"$key\":\"$(json_escape "$value")\""
}

add_field "path" "$PATH_ARG"
add_field "content" "$CONTENT_ARG"
add_field "title" "$TITLE_ARG"
add_field "contextLabel" "$CONTEXT_LABEL_ARG"
add_field "contextValue" "$CONTEXT_VALUE_ARG"
add_field "contextPath" "$CONTEXT_PATH_ARG"
add_field "contentType" "$CONTENT_TYPE_ARG"
payload+="}"

curl -sS -X POST "$API_URL" \
  -H 'Content-Type: application/json' \
  -d "$payload"
