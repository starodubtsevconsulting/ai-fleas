#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXAMPLE_CONF="$SCRIPT_DIR/sms.command.example.config"
CONF_FILE="$SCRIPT_DIR/sms.command.config"
POMODORO_PRELUDE_SH="$SCRIPT_DIR/../pomodoro/pomodoro.prelude.sh"
if [[ -x "$POMODORO_PRELUDE_SH" ]]; then
  "$POMODORO_PRELUDE_SH" || true
fi

function require_cmd() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Required command not found: $cmd" >&2
    exit 2
  fi
}

function normalize_phone_number() {
  local raw="$1"
  local cleaned digits
  cleaned="$(printf '%s' "$raw" | tr -d '[:space:]')"
  if [[ "$cleaned" == +* ]]; then
    # Keep + and digits only.
    cleaned="+$(printf '%s' "$cleaned" | tr -cd '0-9')"
    if [[ "$cleaned" == "+" ]]; then
      return 1
    fi
    printf '%s' "$cleaned"
    return 0
  fi

  digits="$(printf '%s' "$cleaned" | tr -cd '0-9')"
  if [[ ${#digits} -eq 10 ]]; then
    # Default North America (+1) when user gave local formatting.
    printf '+1%s' "$digits"
    return 0
  fi
  if [[ ${#digits} -eq 11 && "${digits:0:1}" == "1" ]]; then
    printf '+%s' "$digits"
    return 0
  fi
  return 1
}

function recipient_config_path() {
  if [[ -n "${SMS_RECIPIENT_CONFIG_PATH:-}" ]]; then
    printf '%s' "$SMS_RECIPIENT_CONFIG_PATH"
    return 0
  fi
  if [[ -n "${SMS_WORKFLOW_CONFIG_PATH:-}" ]]; then
    printf '%s' "$SMS_WORKFLOW_CONFIG_PATH"
    return 0
  fi
  printf '%s' "$CONF_FILE"
}

function read_user_phone_number() {
  local path="$1"
  if [[ ! -f "$path" ]]; then
    return 1
  fi
  # Expected format: user-phone-number: 514-839-7770
  awk -F':' 'tolower($1) ~ /^[[:space:]]*user-phone-number[[:space:]]*$/ {sub(/^[[:space:]]+/, "", $2); sub(/[[:space:]]+$/, "", $2); print $2; exit 0}' "$path"
}

if [[ ! -f "$EXAMPLE_CONF" ]]; then
  echo "Missing example config: $EXAMPLE_CONF" >&2
  exit 1
fi

if [[ ! -f "$CONF_FILE" ]]; then
  cp "$EXAMPLE_CONF" "$CONF_FILE"
  cat <<'EOF' >> "$CONF_FILE"

# Personal/local overrides (gitignored by *.config)
EOF
  echo "Created $CONF_FILE; edit as needed." >&2
fi

# shellcheck source=/dev/null
source "$EXAMPLE_CONF"
# shellcheck source=/dev/null
source "$CONF_FILE"

PROVIDER="${SMS_PROVIDER:-twilio}"
TO_RAW=""
MESSAGE=""
FROM_OVERRIDE=""
RECIPIENT_CONFIG_OVERRIDE=""
HEALTHCHECK=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --provider)
      PROVIDER="$2"; shift 2 ;;
    --to)
      TO_RAW="$2"; shift 2 ;;
    --from)
      FROM_OVERRIDE="$2"; shift 2 ;;
    --message|--body)
      MESSAGE="$2"; shift 2 ;;
    --recipient-config|--workflow-config)
      RECIPIENT_CONFIG_OVERRIDE="$2"; shift 2 ;;
    --healthcheck)
      HEALTHCHECK=1; shift ;;
    --help|-h)
      cat <<'EOF'
Usage: sms.command.sh [options]
  --message "<text>"          Message body (required)
  --to "<number>"             Recipient phone number (optional)
  --from "<number>"           Sender (Twilio From). Defaults to TWILIO_FROM_NUMBER
  --provider twilio|console   Provider (default from config)
  --recipient-config <path>   Override the recipient configuration path
  --workflow-config <path>    Deprecated alias for --recipient-config
  --healthcheck               Validate SMS setup/connectivity without sending SMS
EOF
      exit 0
      ;;
    *)
      echo "Unknown arg: $1" >&2
      exit 2 ;;
  esac
done

if [[ "$HEALTHCHECK" != "1" && -z "$MESSAGE" ]]; then
  echo "Missing --message" >&2
  exit 2
fi

RECIPIENT_CONFIG="$(recipient_config_path)"
if [[ -n "$RECIPIENT_CONFIG_OVERRIDE" ]]; then
  RECIPIENT_CONFIG="$RECIPIENT_CONFIG_OVERRIDE"
fi

TO=""
if [[ "$HEALTHCHECK" != "1" ]]; then
  if [[ -z "$TO_RAW" ]]; then
    TO_RAW="${SMS_DEFAULT_TO:-}"
  fi
  if [[ -z "$TO_RAW" ]]; then
    TO_RAW="$(read_user_phone_number "$RECIPIENT_CONFIG" || true)"
  fi
  if [[ -z "$TO_RAW" ]]; then
    echo "No recipient found. Provide --to, set SMS_DEFAULT_TO, or set user-phone-number: in $RECIPIENT_CONFIG" >&2
    exit 2
  fi

  if ! TO="$(normalize_phone_number "$TO_RAW")"; then
    echo "Invalid phone number '$TO_RAW'. Use E.164 (+15145551234) or a 10-digit North America number." >&2
    exit 2
  fi
fi

case "$PROVIDER" in
  console)
    if [[ "$HEALTHCHECK" = "1" ]]; then
      echo "SMS healthcheck OK (provider=console)"
      exit 0
    fi
    echo "To: $TO"
    echo "Body: $MESSAGE"
    exit 0
    ;;
  twilio)
    require_cmd curl
    ACCOUNT_SID="${TWILIO_ACCOUNT_SID:-}"
    AUTH_TOKEN="${TWILIO_AUTH_TOKEN:-}"
    FROM="${FROM_OVERRIDE:-${TWILIO_FROM_NUMBER:-}}"
    MSG_SVC_SID="${TWILIO_MESSAGING_SERVICE_SID:-}"

    if [[ -z "$ACCOUNT_SID" || -z "$AUTH_TOKEN" ]]; then
      cat >&2 <<EOF
Missing Twilio configuration.
Set env vars or commands/sms/sms.command.config:
  - TWILIO_ACCOUNT_SID
  - TWILIO_AUTH_TOKEN
  - TWILIO_MESSAGING_SERVICE_SID (recommended) OR TWILIO_FROM_NUMBER (or pass --from)
EOF
      exit 2
    fi

    if [[ "$HEALTHCHECK" = "1" ]]; then
      hc_url="https://api.twilio.com/2010-04-01/Accounts/${ACCOUNT_SID}.json"
      hc_tmp="$(mktemp)"
      hc_err="$(mktemp)"
      if ! hc_code="$(
        curl -sS -o "$hc_tmp" -w '%{http_code}' \
          -u "${ACCOUNT_SID}:${AUTH_TOKEN}" \
          2>"$hc_err" \
          "$hc_url"
      )"; then
        echo "SMS healthcheck failed (provider=twilio, transport error)." >&2
        cat "$hc_err" >&2 || true
        cat "$hc_tmp" >&2 || true
        rm -f "$hc_err"
        rm -f "$hc_tmp"
        exit 1
      fi
      if [[ "$hc_code" =~ ^2 ]]; then
        echo "SMS healthcheck OK (provider=twilio, account reachable)"
        rm -f "$hc_err"
        rm -f "$hc_tmp"
        exit 0
      fi
      echo "SMS healthcheck failed (provider=twilio, http=$hc_code)." >&2
      cat "$hc_err" >&2 || true
      cat "$hc_tmp" >&2 || true
      rm -f "$hc_err"
      rm -f "$hc_tmp"
      exit 1
    fi

    declare -a twilio_args=()
    if [[ -n "$MSG_SVC_SID" ]]; then
      twilio_args+=(--data-urlencode "MessagingServiceSid=${MSG_SVC_SID}")
    else
      if [[ -z "$FROM" ]]; then
        echo "Missing Twilio sender. Set TWILIO_MESSAGING_SERVICE_SID or TWILIO_FROM_NUMBER (or pass --from)." >&2
        exit 2
      fi
      FROM_NORM=""
      if ! FROM_NORM="$(normalize_phone_number "$FROM")"; then
        echo "Invalid From number '$FROM'. Use E.164 (+1...)." >&2
        exit 2
      fi
      twilio_args+=(--data-urlencode "From=${FROM_NORM}")
    fi

    url="https://api.twilio.com/2010-04-01/Accounts/${ACCOUNT_SID}/Messages.json"

    # Capture body + HTTP status without requiring jq.
    tmp="$(mktemp)"
    curl_err="$(mktemp)"
    if ! http_code="$(
      curl -sS -o "$tmp" -w '%{http_code}' \
        -u "${ACCOUNT_SID}:${AUTH_TOKEN}" \
        --data-urlencode "To=${TO}" \
        "${twilio_args[@]}" \
        --data-urlencode "Body=${MESSAGE}" \
        2>"$curl_err" \
        "$url"
    )"; then
      echo "Twilio send failed (transport error)." >&2
      cat "$curl_err" >&2 || true
      cat "$tmp" >&2 || true
      rm -f "$curl_err"
      rm -f "$tmp"
      exit 1
    fi

    if [[ "$http_code" =~ ^2 ]]; then
      echo "Sent via Twilio: to=${TO}"
      rm -f "$curl_err"
      rm -f "$tmp"
      exit 0
    fi

    echo "Twilio send failed (http=$http_code)." >&2
    cat "$curl_err" >&2 || true
    cat "$tmp" >&2 || true
    rm -f "$curl_err"
    rm -f "$tmp"
    exit 1
    ;;
  *)
    echo "Unsupported provider: $PROVIDER (supported: twilio, console)" >&2
    exit 2
    ;;
esac
