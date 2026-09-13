#!/usr/bin/env bash
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/../_runtime/profile" && pwd -P)/command-profile.guard.sh"
ai_command_require_profile "cloudflare" || exit $?
set -euo pipefail

config_path="${CLOUDFLARE_COMMAND_CONF:-${AI_COMMAND_CONFIG_PATH:-}}"

fail() {
  printf 'BLOCKED_CLOUDFLARE_CONFIG: %s\n' "$1" >&2
  exit 2
}

usage() {
  printf '%s\n' \
    'Usage: cloudflare.command.sh validate|token-check|run-tunnel|verify-access|ui' \
    '       cloudflare.command.sh install-connector --apply' \
    '       cloudflare.command.sh create-tunnel --apply --token-output ABSOLUTE_PATH' \
    '       cloudflare.command.sh install-service --apply'
}

install_connector() {
  local installer="${AI_COMMANDS_ROOT}/install/cloudflare/cloudflare-connector.command.sh"
  [[ -x "$installer" ]] || fail 'cloudflare-connector installer command is missing or not executable'
  "$installer" install --apply
}

[[ -n "$config_path" ]] || fail 'AI_COMMAND_CONFIG_PATH or CLOUDFLARE_COMMAND_CONF is required'
[[ -f "$config_path" ]] || fail 'configured command file does not exist'

# shellcheck disable=SC1090
source "$config_path"

public_url="${CLOUDFLARE_PUBLIC_URL:-}"
origin_url="${CLOUDFLARE_ORIGIN_URL:-}"
tunnel_name="${CLOUDFLARE_TUNNEL_NAME:-}"
tunnel_token_env="${CLOUDFLARE_TUNNEL_TOKEN_ENV:-}"
tunnel_token_file="${CLOUDFLARE_TUNNEL_TOKEN_FILE:-}"
api_token_env="${CLOUDFLARE_API_TOKEN_ENV:-}"
account_id="${CLOUDFLARE_ACCOUNT_ID:-}"
zone_id="${CLOUDFLARE_ZONE_ID:-}"
allowed_emails="${CLOUDFLARE_ALLOWED_EMAILS:-}"
access_login_suffix="${CLOUDFLARE_ACCESS_LOGIN_SUFFIX:-.cloudflareaccess.com}"
api_base="https://api.cloudflare.com/client/v4"

if [[ "${CLOUDFLARE_TEST_ORIGIN:-}" == '1' ]]; then
  api_base="${CLOUDFLARE_API_BASE_URL:-}"
  [[ "$api_base" =~ ^http://(127\.0\.0\.1|localhost):[0-9]+(/.*)?$ ]] ||
    fail 'test API origin must be loopback HTTP'
fi

validate_env_name() {
  [[ "$1" =~ ^[A-Z_][A-Z0-9_]*$ ]] || fail "$2 must name an uppercase environment variable"
}

validate_config() {
  [[ "$public_url" =~ ^https://[A-Za-z0-9.-]+(:[0-9]+)?/?$ ]] ||
    fail 'CLOUDFLARE_PUBLIC_URL must be a credential-free HTTPS origin without path, query, or fragment'
  [[ "$origin_url" =~ ^https?://([^/:]+)(:[0-9]+)?/?$ ]] ||
    fail 'CLOUDFLARE_ORIGIN_URL must be an HTTP(S) origin without path, query, or fragment'

  local origin_host="${BASH_REMATCH[1]}"
  case "$origin_host" in
    localhost|127.*|10.*|192.168.*|*.internal|*.local|*.localhost) ;;
    172.*)
      local second_octet="${origin_host#172.}"
      second_octet="${second_octet%%.*}"
      [[ "$second_octet" =~ ^[0-9]+$ ]] && (( second_octet >= 16 && second_octet <= 31 )) ||
        fail 'CLOUDFLARE_ORIGIN_URL must use a private or loopback host'
      ;;
    *) fail 'CLOUDFLARE_ORIGIN_URL must use a private or loopback host' ;;
  esac

  [[ "$tunnel_name" =~ ^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$ ]] ||
    fail 'CLOUDFLARE_TUNNEL_NAME is missing or invalid'
  validate_env_name "$tunnel_token_env" 'CLOUDFLARE_TUNNEL_TOKEN_ENV'
  [[ -z "$tunnel_token_file" || "$tunnel_token_file" == /* ]] ||
    fail 'CLOUDFLARE_TUNNEL_TOKEN_FILE must be empty or an absolute path'
  validate_env_name "$api_token_env" 'CLOUDFLARE_API_TOKEN_ENV'
  [[ "$account_id" =~ ^[A-Fa-f0-9]{32}$ ]] || fail 'CLOUDFLARE_ACCOUNT_ID must be a 32-character hexadecimal ID'
  [[ "$zone_id" =~ ^[A-Fa-f0-9]{32}$ ]] || fail 'CLOUDFLARE_ZONE_ID must be a 32-character hexadecimal ID'
  [[ -n "${allowed_emails//[[:space:],]/}" ]] || fail 'CLOUDFLARE_ALLOWED_EMAILS must contain exact approved addresses'
  local allowed_emails_lower
  allowed_emails_lower="$(printf '%s' "$allowed_emails" | tr '[:upper:]' '[:lower:]')"
  [[ "$allowed_emails_lower" != *'*'* ]] || fail 'wildcard Access identities are prohibited'
  [[ "$allowed_emails_lower" != *'everyone'* && "$allowed_emails_lower" != *'any'* ]] ||
    fail 'unrestricted Access identities are prohibited'
  local identity
  while IFS= read -r identity; do
    identity="${identity//[[:space:]]/}"
    [[ "$identity" =~ ^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]] ||
      fail 'CLOUDFLARE_ALLOWED_EMAILS must contain only exact email addresses'
  done < <(tr ',' '\n' <<<"$allowed_emails")
  [[ "$access_login_suffix" =~ ^\.[A-Za-z0-9.-]+$ ]] || fail 'CLOUDFLARE_ACCESS_LOGIN_SUFFIX is invalid'
}

read_secret() {
  local variable_name="$1"
  local value="${!variable_name:-}"
  [[ -n "$value" ]] || fail "required secret environment variable $variable_name is not set"
  printf '%s' "$value"
}

read_tunnel_secret() {
  local value="${!tunnel_token_env:-}"
  if [[ -n "$value" ]]; then
    printf '%s' "$value"
    return
  fi
  [[ -n "$tunnel_token_file" && -f "$tunnel_token_file" ]] ||
    fail "required secret environment variable $tunnel_token_env is not set and no tunnel token file is available"
  local mode
  mode="$(stat -f '%Lp' "$tunnel_token_file" 2>/dev/null || stat -c '%a' "$tunnel_token_file" 2>/dev/null || true)"
  [[ "$mode" == '600' ]] || fail 'CLOUDFLARE_TUNNEL_TOKEN_FILE must have mode 0600'
  value="$(<"$tunnel_token_file")"
  [[ -n "$value" ]] || fail 'CLOUDFLARE_TUNNEL_TOKEN_FILE is empty'
  printf '%s' "$value"
}

json_value() {
  local field="$1"
  python3 -c 'import json,sys; value=json.load(sys.stdin); print(value["result"][sys.argv[1]])' "$field"
}

require_api_success() {
  python3 -c 'import json,sys; value=json.load(sys.stdin); sys.exit(0 if value.get("success") is True else 1)'
}

api_request() {
  local method="$1" path="$2" payload="$3" token="$4"
  curl --silent --show-error --fail-with-body --max-time 20 \
    --request "$method" \
    --header "Authorization: Bearer $token" \
    --header 'Content-Type: application/json' \
    --data "$payload" \
    "${api_base%/}$path"
}

operation="${1:-}"
shift || true

case "$operation" in
  ui)
    [[ $# -eq 0 ]] || fail 'ui accepts no additional arguments'
    validate_config
    exec "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)/app.sh"
    ;;
  validate)
    [[ $# -eq 0 ]] || fail 'validate accepts no additional arguments'
    validate_config
    printf 'cloudflare configuration valid: tunnel=%s public_host=%s approved_identities=%s\n' \
      "$tunnel_name" "${public_url#https://}" "$(tr ',' '\n' <<<"$allowed_emails" | sed '/^[[:space:]]*$/d' | wc -l | tr -d ' ')"
    ;;
  token-check)
    [[ $# -eq 0 ]] || fail 'token-check accepts no additional arguments'
    validate_config
    command -v curl >/dev/null 2>&1 || fail 'curl is required'
    api_token="$(read_secret "$api_token_env")"
    response="$(curl --silent --show-error --fail-with-body --max-time 15 \
      -H "Authorization: Bearer $api_token" \
      https://api.cloudflare.com/client/v4/user/tokens/verify)" || {
        printf 'cloudflare API token verification failed\n' >&2
        exit 1
      }
    [[ "$response" == *'"success":true'* || "$response" == *'"success": true'* ]] || {
      printf 'cloudflare API token is not active\n' >&2
      exit 1
    }
    printf 'cloudflare API token active\n'
    ;;
  create-tunnel)
    [[ "${1:-}" == '--apply' && "${2:-}" == '--token-output' && -n "${3:-}" && $# -eq 3 ]] ||
      fail 'create-tunnel requires --apply --token-output ABSOLUTE_PATH'
    token_output="$3"
    validate_config
    command -v curl >/dev/null 2>&1 || fail 'curl is required'
    command -v python3 >/dev/null 2>&1 || fail 'python3 is required'
    [[ "$token_output" == /* ]] || fail 'tunnel token output must be an absolute path'
    [[ ! -e "$token_output" ]] || fail 'tunnel token output already exists; refusing overwrite'
    [[ -d "$(dirname "$token_output")" ]] || fail 'tunnel token output parent directory does not exist'
    api_token="$(read_secret "$api_token_env")"
    public_host="${public_url#https://}"
    public_host="${public_host%/}"

    create_payload="$(python3 -c 'import json,sys; print(json.dumps({"name":sys.argv[1],"config_src":"cloudflare"},separators=(",",":")))' "$tunnel_name")"
    create_response="$(api_request POST "/accounts/$account_id/cfd_tunnel" "$create_payload" "$api_token")" || {
      printf 'cloudflare tunnel creation failed\n' >&2
      exit 1
    }
    require_api_success <<<"$create_response" || { printf 'cloudflare tunnel creation was rejected\n' >&2; exit 1; }
    tunnel_id="$(json_value id <<<"$create_response")"
    tunnel_token="$(json_value token <<<"$create_response")"
    [[ "$tunnel_id" =~ ^[A-Fa-f0-9-]{36}$ && -n "$tunnel_token" ]] || {
      printf 'cloudflare tunnel response was missing credentials\n' >&2
      exit 1
    }
    umask 077
    printf '%s' "$tunnel_token" >"$token_output"

    ingress_payload="$(python3 -c 'import json,sys; print(json.dumps({"config":{"ingress":[{"hostname":sys.argv[1],"service":sys.argv[2],"originRequest":{}},{"service":"http_status:404"}]}},separators=(",",":")))' "$public_host" "$origin_url")"
    ingress_response="$(api_request PUT "/accounts/$account_id/cfd_tunnel/$tunnel_id/configurations" "$ingress_payload" "$api_token")" || {
      printf 'tunnel created but ingress configuration failed; token retained at the requested output path\n' >&2
      exit 1
    }
    require_api_success <<<"$ingress_response" || {
      printf 'tunnel created but ingress configuration was rejected; token retained at the requested output path\n' >&2
      exit 1
    }

    dns_payload="$(python3 -c 'import json,sys; print(json.dumps({"type":"CNAME","proxied":True,"name":sys.argv[1],"content":sys.argv[2]+".cfargotunnel.com"},separators=(",",":")))' "$public_host" "$tunnel_id")"
    dns_response="$(api_request POST "/zones/$zone_id/dns_records" "$dns_payload" "$api_token")" || {
      printf 'tunnel and ingress created but DNS creation failed; token retained at the requested output path\n' >&2
      exit 1
    }
    require_api_success <<<"$dns_response" || {
      printf 'tunnel and ingress created but DNS creation was rejected; token retained at the requested output path\n' >&2
      exit 1
    }
    printf 'cloudflare tunnel created: tunnel=%s id=%s public_url=%s token_file=%s\n' \
      "$tunnel_name" "$tunnel_id" "$public_url" "$token_output"
    printf 'Access policy must be configured and verify-access must pass before user handoff\n'
    ;;
  run-tunnel)
    [[ $# -eq 0 ]] || fail 'run-tunnel accepts no additional arguments'
    validate_config
    command -v cloudflared >/dev/null 2>&1 ||
      fail 'cloudflared is required; run install-connector --apply'
    tunnel_token="$(read_tunnel_secret)"
    exec cloudflared tunnel --no-autoupdate run --token "$tunnel_token"
    ;;
  install-connector)
    [[ "${1:-}" == '--apply' && $# -eq 1 ]] ||
      fail 'install-connector requires the exact --apply flag'
    install_connector
    ;;
  install-service)
    [[ "${1:-}" == '--apply' && $# -eq 1 ]] || fail 'install-service requires the exact --apply flag'
    validate_config
    command -v cloudflared >/dev/null 2>&1 ||
      fail 'cloudflared is required; run install-connector --apply'
    tunnel_token="$(read_tunnel_secret)"
    if [[ "$(id -u)" -eq 0 ]]; then
      exec cloudflared service install "$tunnel_token"
    fi
    command -v sudo >/dev/null 2>&1 || fail 'sudo is required to install the service'
    exec sudo cloudflared service install "$tunnel_token"
    ;;
  verify-access)
    [[ $# -eq 0 ]] || fail 'verify-access accepts no additional arguments'
    validate_config
    command -v curl >/dev/null 2>&1 || fail 'curl is required'
    headers="$(mktemp)"
    trap 'rm -f "$headers"' EXIT
    status="$(curl --silent --show-error --max-time 15 --output /dev/null --dump-header "$headers" \
      --write-out '%{http_code}' "$public_url")" || {
        printf 'public hostname is unreachable\n' >&2
        exit 1
      }
    location="$(awk 'BEGIN{IGNORECASE=1} /^location:/{sub(/^[^:]+:[[:space:]]*/, ""); sub(/\r$/, ""); print; exit}' "$headers")"
    case "$status" in 301|302|303|307|308) ;; *)
      printf 'Access verification failed: unauthenticated request returned HTTP %s\n' "$status" >&2
      exit 1
      ;;
    esac
    [[ "$location" == https://*"$access_login_suffix"/* ]] || {
      printf 'Access verification failed: redirect is not a Cloudflare Access login\n' >&2
      exit 1
    }
    printf 'cloudflare Access gate verified for %s\n' "$public_url"
    ;;
  -h|--help|help)
    usage
    ;;
  *)
    usage >&2
    exit 2
    ;;
esac
