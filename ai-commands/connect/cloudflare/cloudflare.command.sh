#!/usr/bin/env bash
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)/_runtime/profile/command-profile.guard.sh"
ai_command_require_profile "cloudflare" || exit $?
set -euo pipefail

config_path="${CLOUDFLARE_COMMAND_CONF:-${AI_COMMAND_CONFIG_PATH:-}}"

fail() {
  printf 'BLOCKED_CLOUDFLARE_CONFIG: %s\n' "$1" >&2
  exit 2
}

usage() {
  printf '%s\n' \
    'Usage: cloudflare.command.sh list-targets|validate|token-check|server-status|origin-status|connector-status|run-tunnel|stop-tunnel|verify-access|ui' \
    '       cloudflare.command.sh install-connector --apply' \
    '       cloudflare.command.sh create-tunnel --apply --token-output ABSOLUTE_PATH' \
    '       cloudflare.command.sh install-service --apply' \
    '       cloudflare.command.sh install-controller-service --apply'
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

operation="${1:-}"
shift || true
server_id="${CLOUDFLARE_SERVER_ID:-${CLOUDFLARE_PROVIDER_ID:-${AI_MODEL_PROVIDER_ID:-}}}"
server_targets="${CLOUDFLARE_SERVER_TARGETS:-${CLOUDFLARE_PROVIDER_TARGETS:-}}"

load_server_target() {
  [[ -n "$server_targets" ]] || return 0
  [[ "$server_id" =~ ^[A-Za-z0-9][A-Za-z0-9._-]*$ ]] || fail 'CLOUDFLARE_SERVER_ID is required and must be safe'
  local pair target_ref='' target_path config_dir
  IFS=',' read -r -a pairs <<<"$server_targets"
  for pair in "${pairs[@]}"; do
    [[ "${pair%%=*}" == "$server_id" ]] && { target_ref="${pair#*=}"; break; }
  done
  [[ -n "$target_ref" ]] || fail "no Cloudflare target is configured for server $server_id"
  [[ "$target_ref" =~ ^[A-Za-z0-9][A-Za-z0-9._/-]*$ && "$target_ref" != *'..'* && "$target_ref" != /* ]] || fail 'server target path must be safe and relative'
  config_dir="$(cd "$(dirname "$config_path")" && pwd -P)"
  target_path="$config_dir/$target_ref"
  [[ -f "$target_path" ]] || fail "server target file is missing for $server_id"
  # shellcheck disable=SC1090
  source "$target_path"
}

list_targets() {
  if [[ -z "$server_targets" ]]; then printf '%s\n' "${AI_MODEL_PROVIDER_ID:-default}"; return; fi
  local pair id
  IFS=',' read -r -a pairs <<<"$server_targets"
  for pair in "${pairs[@]}"; do
    id="${pair%%=*}"
    [[ "$id" =~ ^[A-Za-z0-9][A-Za-z0-9._-]*$ && "${pair#*=}" != "$pair" ]] || fail 'CLOUDFLARE_SERVER_TARGETS is invalid'
    printf '%s\n' "$id"
  done
}

if [[ "$operation" == 'list-targets' ]]; then
  [[ $# -eq 0 ]] || fail 'list-targets accepts no arguments'
  list_targets
  exit 0
fi
[[ "$operation" == 'ui' || "$operation" == 'token-check' ]] || load_server_target

public_url="${CLOUDFLARE_PUBLIC_URL:-}"
origin_url="${CLOUDFLARE_ORIGIN_URL:-}"
origin_scope="${CLOUDFLARE_ORIGIN_SCOPE:-host}"
origin_health_path="${CLOUDFLARE_ORIGIN_HEALTH_PATH:-/}"
origin_server_name="${CLOUDFLARE_ORIGIN_SERVER_NAME:-}"
origin_ca_pool="${CLOUDFLARE_ORIGIN_CA_POOL:-}"
server_probe_host="${CLOUDFLARE_SERVER_PROBE_HOST:-}"
server_probe_port="${CLOUDFLARE_SERVER_PROBE_PORT:-22}"
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

  local origin_host="${BASH_REMATCH[1]}" origin_scheme="${origin_url%%://*}"
  [[ "$origin_scope" == 'host' || "$origin_scope" == 'container' ]] ||
    fail 'CLOUDFLARE_ORIGIN_SCOPE must be host or container'
  if [[ "$origin_scope" == 'container' ]]; then
    [[ "$origin_host" =~ ^[a-z][a-z0-9-]{0,62}$ ]] ||
      fail 'container-scoped CLOUDFLARE_ORIGIN_URL must use a single safe service name'
    [[ "$origin_scheme" == 'https' ]] ||
      fail 'container-scoped CLOUDFLARE_ORIGIN_URL must use HTTPS'
  else
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
  fi
  [[ -z "$origin_server_name" || "$origin_server_name" =~ ^[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?$ ]] ||
    fail 'CLOUDFLARE_ORIGIN_SERVER_NAME must be an origin certificate hostname'
  [[ -z "$origin_ca_pool" || ( "$origin_ca_pool" == /* && "$origin_ca_pool" != *$'\n'* && "$origin_ca_pool" != *'..'* ) ]] ||
    fail 'CLOUDFLARE_ORIGIN_CA_POOL must be empty or an absolute CA bundle path without parent traversal'
  if [[ "$origin_scheme" == 'http' ]]; then
    [[ -z "$origin_server_name" && -z "$origin_ca_pool" ]] ||
      fail 'CLOUDFLARE_ORIGIN_SERVER_NAME and CLOUDFLARE_ORIGIN_CA_POOL require an HTTPS origin'
  fi
  if [[ "$origin_scope" == 'container' && -z "$origin_server_name" ]]; then
    fail 'container-scoped HTTPS origin requires CLOUDFLARE_ORIGIN_SERVER_NAME'
  fi

  [[ "$origin_health_path" =~ ^/[A-Za-z0-9._~:/@%+-]*$ ]] ||
    fail 'CLOUDFLARE_ORIGIN_HEALTH_PATH must be an absolute path without a query or fragment'
  [[ -z "$server_probe_host" || "$server_probe_host" =~ ^[A-Za-z0-9.-]+$ ]] ||
    fail 'CLOUDFLARE_SERVER_PROBE_HOST is invalid'
  [[ "$server_probe_port" =~ ^[0-9]+$ ]] && (( server_probe_port >= 1 && server_probe_port <= 65535 )) ||
    fail 'CLOUDFLARE_SERVER_PROBE_PORT must be between 1 and 65535'

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

server_status() {
  [[ -n "$server_probe_host" ]] || fail 'CLOUDFLARE_SERVER_PROBE_HOST is required for server-status'
  command -v python3 >/dev/null 2>&1 || fail 'python3 is required for server-status'
  if python3 - "$server_probe_host" "$server_probe_port" <<'PY'
import socket
import sys
try:
    with socket.create_connection((sys.argv[1], int(sys.argv[2])), timeout=2):
        pass
except (OSError, ValueError):
    raise SystemExit(1)
PY
  then
    printf 'server online: host=%s port=%s\n' "$server_probe_host" "$server_probe_port"
    return
  fi
  printf 'server offline: host=%s port=%s\n' "$server_probe_host" "$server_probe_port"
  return 1
}

origin_status() {
  command -v curl >/dev/null 2>&1 || fail 'curl is required for origin-status'
  [[ "$origin_scope" != 'container' ]] ||
    fail 'origin-status for a container-scoped origin must run inside the connector network; use the owning service status check'
  local probe_url="${origin_url%/}${origin_health_path}" status
  local -a curl_args=(--silent --show-error --connect-timeout 2 --max-time 4 --output /dev/null --write-out '%{http_code}')

  if [[ "$origin_url" == https://* && -n "$origin_server_name" ]]; then
    [[ "$origin_url" =~ ^https://([^/:]+)(:([0-9]+))?/?$ ]] ||
      fail 'CLOUDFLARE_ORIGIN_URL must be an HTTPS origin without path, query, or fragment'
    local origin_host="${BASH_REMATCH[1]}" origin_port="${BASH_REMATCH[3]:-443}"
    probe_url="https://${origin_server_name}:${origin_port}${origin_health_path}"
    curl_args+=(--connect-to "${origin_server_name}:${origin_port}:${origin_host}:${origin_port}")
  fi
  [[ -z "$origin_ca_pool" ]] || curl_args+=(--cacert "$origin_ca_pool")

  status="$(curl "${curl_args[@]}" "$probe_url")" || status='000'
  if [[ "$status" =~ ^[23][0-9][0-9]$ ]]; then
    printf 'origin healthy: url=%s status=%s\n' "$probe_url" "$status"
    return
  fi
  printf 'origin unavailable: url=%s status=%s\n' "$probe_url" "$status"
  return 1
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

runtime_lock_root() {
  local lock_root="${AI_FLEAS_RUNTIME_LOCK_DIR:-}"
  if [[ -z "$lock_root" ]]; then
    if [[ "$(uname -s)" == Darwin ]]; then
      lock_root="$HOME/Library/Caches/AI Fleas/runtime-locks"
    else
      lock_root="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}/ai-fleas/runtime-locks"
    fi
  fi
  [[ "$lock_root" == /* ]] || fail 'AI_FLEAS_RUNTIME_LOCK_DIR must be absolute'
  mkdir -p "$lock_root"
  chmod 700 "$lock_root"
  printf '%s' "$lock_root"
}

connector_status() {
  local lock_root
  lock_root="$(runtime_lock_root)"
  local lock_name="${tunnel_name//[^A-Za-z0-9._-]/_}"
  local lock_pid_file="${lock_root%/}/ai-fleas-cloudflare-${lock_name}.lock/pid"
  local existing_pid=''
  [[ -f "$lock_pid_file" ]] && existing_pid="$(<"$lock_pid_file")"
  if [[ "$existing_pid" =~ ^[0-9]+$ ]] && kill -0 "$existing_pid" 2>/dev/null; then
    printf 'connector open: tunnel=%s pid=%s\n' "$tunnel_name" "$existing_pid"
    return
  fi
  printf 'connector closed: tunnel=%s\n' "$tunnel_name"
}

stop_tunnel() {
  local lock_root
  lock_root="$(runtime_lock_root)"
  local lock_name="${tunnel_name//[^A-Za-z0-9._-]/_}"
  local lock_pid_file="${lock_root%/}/ai-fleas-cloudflare-${lock_name}.lock/pid"
  local existing_pid=''
  [[ -f "$lock_pid_file" ]] && existing_pid="$(<"$lock_pid_file")"
  [[ "$existing_pid" =~ ^[0-9]+$ ]] || fail "connector is not running for tunnel $tunnel_name"
  kill -0 "$existing_pid" 2>/dev/null || fail "connector is not running for tunnel $tunnel_name"
  local command_line
  command_line="$(ps -p "$existing_pid" -o command= 2>/dev/null || true)"
  [[ "$command_line" == *cloudflare.command.sh*run-tunnel* ]] ||
    fail 'connector lock PID does not belong to an AI Fleas tunnel process'
  kill -TERM "$existing_pid"
  printf 'connector stop requested: tunnel=%s pid=%s\n' "$tunnel_name" "$existing_pid"
}

run_tunnel_exclusive() {
  command -v pgrep >/dev/null 2>&1 || fail 'pgrep is required for duplicate connector prevention'
  local lock_root
  lock_root="$(runtime_lock_root)"
  local lock_name="${tunnel_name//[^A-Za-z0-9._-]/_}"
  local lock_dir="${lock_root%/}/ai-fleas-cloudflare-${lock_name}.lock"
  local lock_pid_file="$lock_dir/pid"
  local existing_pid=''

  if ! mkdir "$lock_dir" 2>/dev/null; then
    [[ -f "$lock_pid_file" ]] && existing_pid="$(<"$lock_pid_file")"
    if [[ "$existing_pid" =~ ^[0-9]+$ ]] && kill -0 "$existing_pid" 2>/dev/null; then
      fail "connector launch blocked: tunnel $tunnel_name is already managed by process $existing_pid"
    fi
    rm -f "$lock_pid_file"
    rmdir "$lock_dir" 2>/dev/null || fail 'connector launch blocked: runtime lock is busy'
    mkdir "$lock_dir" 2>/dev/null || fail 'connector launch blocked: another process acquired the runtime lock'
  fi
  printf '%s\n' "$$" >"$lock_pid_file"

  cleanup_tunnel_lock() {
    rm -f "$lock_pid_file"
    rmdir "$lock_dir" 2>/dev/null || true
  }
  local cloudflared_pid=''
  stop_cloudflared_child() {
    [[ -n "$cloudflared_pid" ]] && kill -TERM "$cloudflared_pid" 2>/dev/null || true
  }
  trap stop_cloudflared_child INT TERM
  trap cleanup_tunnel_lock EXIT

  local tunnel_token
  tunnel_token="$(read_tunnel_secret)"
  cloudflared tunnel --no-autoupdate run --token "$tunnel_token" &
  cloudflared_pid=$!
  set +e
  wait "$cloudflared_pid"
  local result=$?
  set -e
  trap - INT TERM EXIT
  cleanup_tunnel_lock
  return "$result"
}

json_value() {
  local field="$1"
  python3 -c 'import json,sys; value=json.load(sys.stdin); print(value["result"][sys.argv[1]])' "$field"
}

require_api_success() {
  python3 -c 'import json,sys; value=json.load(sys.stdin); sys.exit(0 if value.get("success") is True else 1)'
}

bearer_config() {
  local token="$1"
  [[ "$token" =~ ^[A-Za-z0-9._~+/=-]+$ ]] || fail 'API token contains unsupported characters'
  printf 'header = "Authorization: Bearer %s"\n' "$token"
}

api_request() {
  local method="$1" path="$2" payload="$3" token="$4"
  bearer_config "$token" | curl --config - --silent --show-error --fail-with-body --max-time 20 \
    --request "$method" \
    --header 'Content-Type: application/json' \
    --data "$payload" \
    "${api_base%/}$path"
}

case "$operation" in
  ui)
    [[ $# -eq 0 ]] || fail 'ui accepts no additional arguments'
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
    response="$(bearer_config "$api_token" | curl --config - --silent --show-error --fail-with-body --max-time 15 \
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

    ingress_payload="$(python3 -c '
import json
import sys

origin_request = {"noTLSVerify": False}
if sys.argv[3]:
    origin_request["originServerName"] = sys.argv[3]
if sys.argv[4]:
    origin_request["caPool"] = sys.argv[4]
print(json.dumps({"config": {"ingress": [
    {"hostname": sys.argv[1], "service": sys.argv[2], "originRequest": origin_request},
    {"service": "http_status:404"},
]}}, separators=(",", ":")))
' "$public_host" "$origin_url" "$origin_server_name" "$origin_ca_pool")"
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
    run_tunnel_exclusive
    ;;
  stop-tunnel)
    [[ $# -eq 0 ]] || fail 'stop-tunnel accepts no additional arguments'
    validate_config
    stop_tunnel
    ;;
  connector-status)
    [[ $# -eq 0 ]] || fail 'connector-status accepts no additional arguments'
    validate_config
    connector_status
    ;;
  server-status)
    [[ $# -eq 0 ]] || fail 'server-status accepts no additional arguments'
    validate_config
    server_status
    ;;
  origin-status)
    [[ $# -eq 0 ]] || fail 'origin-status accepts no additional arguments'
    validate_config
    origin_status
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
  install-controller-service)
    [[ "${1:-}" == '--apply' && $# -eq 1 ]] || fail 'install-controller-service requires the exact --apply flag'
    exec "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)/controller-service.sh" install --apply
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
