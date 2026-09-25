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
    'Usage: cloudflare.command.sh list-targets|validate|token-check|access-policy-status|server-status|origin-status|connector-status|controller-state|run-tunnel|stop-tunnel|verify-access|ui' \
    '       cloudflare.command.sh access-auth-logs [--email EMAIL] [--hours HOURS] [--format markdown|jsonl]' \
    '       cloudflare.command.sh controller-enable|controller-disable --apply' \
    '       cloudflare.command.sh sync-access-policy --apply' \
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
case "$operation" in
  ui|token-check|install-connector|install-controller-service) ;;
  *) load_server_target ;;
esac

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
  local origin_scheme origin_host origin_port=''
  if [[ "$origin_url" =~ ^(https?)://([^/:]+)(:([0-9]+))?/?$ ]]; then
    origin_scheme="${BASH_REMATCH[1]}"
    origin_host="${BASH_REMATCH[2]}"
    origin_port="${BASH_REMATCH[4]:-}"
  elif [[ "$origin_url" =~ ^ssh://([^/:]+)(:([0-9]+))?$ ]]; then
    origin_scheme='ssh'
    origin_host="${BASH_REMATCH[1]}"
    origin_port="${BASH_REMATCH[3]:-}"
    [[ -z "$origin_port" || ( "$origin_port" =~ ^[0-9]+$ && origin_port -ge 1 && origin_port -le 65535 ) ]] ||
      fail 'SSH origin port must be between 1 and 65535'
  else
    fail 'CLOUDFLARE_ORIGIN_URL must be an HTTP(S) or SSH origin without path, query, or fragment'
  fi
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
      *)
        [[ "$origin_scheme" == 'ssh' && "$origin_host" =~ ^[A-Za-z0-9][A-Za-z0-9-]{0,62}$ ]] ||
          fail 'CLOUDFLARE_ORIGIN_URL must use a private or loopback host'
        ;;
    esac
  fi
  [[ -z "$origin_server_name" || "$origin_server_name" =~ ^[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?$ ]] ||
    fail 'CLOUDFLARE_ORIGIN_SERVER_NAME must be an origin certificate hostname'
  [[ -z "$origin_ca_pool" || ( "$origin_ca_pool" == /* && "$origin_ca_pool" != *$'\n'* && "$origin_ca_pool" != *'..'* ) ]] ||
    fail 'CLOUDFLARE_ORIGIN_CA_POOL must be empty or an absolute CA bundle path without parent traversal'
  if [[ "$origin_scheme" != 'https' ]]; then
    [[ -z "$origin_server_name" && -z "$origin_ca_pool" ]] ||
      fail 'CLOUDFLARE_ORIGIN_SERVER_NAME and CLOUDFLARE_ORIGIN_CA_POOL require an HTTPS origin'
  fi
  if [[ "$origin_scope" == 'container' && -z "$origin_server_name" ]]; then
    fail 'container-scoped HTTPS origin requires CLOUDFLARE_ORIGIN_SERVER_NAME'
  fi

  [[ "$origin_health_path" =~ ^/[A-Za-z0-9._~:/@%+-]*$ ]] ||
    fail 'CLOUDFLARE_ORIGIN_HEALTH_PATH must be an absolute path without a query or fragment'
  if [[ "$origin_scheme" == 'ssh' ]]; then
    [[ "$origin_scope" == 'host' ]] || fail 'SSH origins require host scope'
    [[ "$origin_health_path" == '/' ]] || fail 'SSH origins do not support CLOUDFLARE_ORIGIN_HEALTH_PATH'
  fi
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
  [[ "$origin_scope" != 'container' ]] ||
    fail 'origin-status for a container-scoped origin must run inside the connector network; use the owning service status check'
  if [[ "$origin_url" =~ ^ssh://([^/:]+)(:([0-9]+))?$ ]]; then
    local ssh_host="${BASH_REMATCH[1]}" ssh_port="${BASH_REMATCH[3]:-22}"
    command -v python3 >/dev/null 2>&1 || fail 'python3 is required for SSH origin-status'
    if python3 - "$ssh_host" "$ssh_port" <<'PY'
import socket
import sys
try:
    with socket.create_connection((sys.argv[1], int(sys.argv[2])), timeout=2):
        pass
except (OSError, ValueError):
    raise SystemExit(1)
PY
    then
      printf 'origin healthy: url=ssh://%s:%s\n' "$ssh_host" "$ssh_port"
      return
    fi
    printf 'origin unavailable: url=ssh://%s:%s\n' "$ssh_host" "$ssh_port"
    return 1
  fi

  command -v curl >/dev/null 2>&1 || fail 'curl is required for origin-status'
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
  case "$(uname -s)" in
    Darwin|FreeBSD) mode="$(stat -f '%Lp' "$tunnel_token_file" 2>/dev/null || true)" ;;
    *) mode="$(stat -c '%a' "$tunnel_token_file" 2>/dev/null || true)" ;;
  esac
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
    elif [[ -d /run/ai-fleas-cloudflare-tunnels && -w /run/ai-fleas-cloudflare-tunnels ]]; then
      lock_root="/run/ai-fleas-cloudflare-tunnels"
    else
      lock_root="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}/ai-fleas/runtime-locks"
    fi
  fi
  [[ "$lock_root" == /* ]] || fail 'AI_FLEAS_RUNTIME_LOCK_DIR must be absolute'
  mkdir -p "$lock_root"
  chmod 700 "$lock_root"
  printf '%s' "$lock_root"
}

controller_state_root() {
  local state_root="${CLOUDFLARE_CONTROLLER_STATE_DIR:-}"
  if [[ -z "$state_root" ]]; then
    if [[ "$(uname -s)" == Darwin ]]; then
      state_root="$HOME/Library/Application Support/AI Fleas/cloudflare-controller"
    else
      state_root="${XDG_STATE_HOME:-$HOME/.local/state}/ai-fleas/cloudflare-controller"
    fi
  fi
  [[ "$state_root" == /* ]] || fail 'CLOUDFLARE_CONTROLLER_STATE_DIR must be absolute'
  mkdir -p "$state_root/disabled"
  chmod 700 "$state_root" "$state_root/disabled"
  printf '%s' "$state_root"
}

controller_disabled_file() {
  local state_root state_key="${server_id:-${AI_MODEL_PROVIDER_ID:-default}}"
  [[ "$state_key" =~ ^[A-Za-z0-9][A-Za-z0-9._-]*$ ]] || fail 'controller state server ID is unsafe'
  state_root="$(controller_state_root)"
  printf '%s/disabled/%s' "$state_root" "$state_key"
}

controller_state() {
  local disabled_file state_key="${server_id:-${AI_MODEL_PROVIDER_ID:-default}}"
  disabled_file="$(controller_disabled_file)"
  if [[ -e "$disabled_file" ]]; then
    printf 'controller desired: stopped server=%s\n' "$state_key"
  else
    printf 'controller desired: running server=%s\n' "$state_key"
  fi
}

controller_enable() {
  local disabled_file state_key="${server_id:-${AI_MODEL_PROVIDER_ID:-default}}"
  disabled_file="$(controller_disabled_file)"
  rm -f "$disabled_file"
  printf 'controller enabled: server=%s\n' "$state_key"
}

controller_disable() {
  local disabled_file temp_file lock_root lock_name lock_pid_file existing_pid='' state_key="${server_id:-${AI_MODEL_PROVIDER_ID:-default}}"
  disabled_file="$(controller_disabled_file)"
  temp_file="${disabled_file}.tmp.$$"
  : >"$temp_file"
  chmod 600 "$temp_file"
  mv "$temp_file" "$disabled_file"

  lock_root="$(runtime_lock_root)"
  lock_name="${tunnel_name//[^A-Za-z0-9._-]/_}"
  lock_pid_file="${lock_root%/}/ai-fleas-cloudflare-${lock_name}.lock/pid"
  [[ -f "$lock_pid_file" ]] && existing_pid="$(<"$lock_pid_file")"
  if [[ "$existing_pid" =~ ^[0-9]+$ ]] && kill -0 "$existing_pid" 2>/dev/null; then
    stop_tunnel
  fi
  printf 'controller disabled: server=%s\n' "$state_key"
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

  active_lock_pid_file="$lock_pid_file"
  active_lock_dir="$lock_dir"
  cleanup_tunnel_lock() {
    [[ -z "${active_lock_pid_file:-}" ]] || rm -f "$active_lock_pid_file"
    [[ -z "${active_lock_dir:-}" ]] || rmdir "$active_lock_dir" 2>/dev/null || true
  }
  local tunnel_token read_result
  set +e
  tunnel_token="$(read_tunnel_secret)"
  read_result=$?
  set -e
  if (( read_result != 0 )); then
    cleanup_tunnel_lock
    return "$read_result"
  fi

  local cloudflared_pid=''
  stop_cloudflared_child() {
    [[ -n "$cloudflared_pid" ]] && kill -TERM "$cloudflared_pid" 2>/dev/null || true
  }
  trap stop_cloudflared_child INT TERM
  trap cleanup_tunnel_lock EXIT

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
  local -a request_args=(
    --silent --show-error --fail-with-body --max-time 20
    --request "$method"
    --header 'Content-Type: application/json'
  )
  [[ -z "$payload" ]] || request_args+=(--data "$payload")
  bearer_config "$token" | curl --config - "${request_args[@]}" "${api_base%/}$path"
}

resolve_access_policy() {
  local api_token="$1" public_host apps_response policies_response
  public_host="${public_url#https://}"
  public_host="${public_host%/}"
  public_host="${public_host%%:*}"

  apps_response="$(api_request GET "/accounts/$account_id/access/apps?per_page=100" '' "$api_token")" ||
    fail 'Cloudflare Access applications could not be listed'
  require_api_success <<<"$apps_response" || fail 'Cloudflare rejected the Access application lookup'
  access_app_id="$(python3 -c '
import json, sys
value = json.load(sys.stdin)
host = sys.argv[1].lower()
def normalized_host(value):
    value = str(value or "").strip().lower()
    if "://" in value:
        value = value.split("://", 1)[1]
    value = value.split("/", 1)[0]
    return value.split(":", 1)[0]
def app_hosts(app):
    hosts = [normalized_host(app.get("domain"))]
    for destination in app.get("destinations", []) or []:
        if isinstance(destination, dict) and destination.get("type") == "public":
            hosts.append(normalized_host(destination.get("uri")))
    for destination in app.get("self_hosted_domains", []) or []:
        if isinstance(destination, str):
            hosts.append(normalized_host(destination))
        elif isinstance(destination, dict):
            hosts.append(normalized_host(destination.get("hostname") or destination.get("domain")))
    return {candidate for candidate in hosts if candidate}
matches = [app for app in value.get("result", []) if host in app_hosts(app)]
if len(matches) != 1:
    scopes = ["|".join(sorted(app_hosts(app))) for app in value.get("result", [])]
    print("Cloudflare Access application scopes: " + ",".join(scopes), file=sys.stderr)
    raise SystemExit(1)
print(matches[0].get("id", ""))
' "$public_host" <<<"$apps_response")" ||
    fail "expected exactly one Cloudflare Access application for $public_host"
  [[ "$access_app_id" =~ ^[A-Fa-f0-9-]{32,36}$ ]] || fail 'Cloudflare Access application ID is invalid'
  access_app_scope="$(python3 -c '
import json, sys
value = json.load(sys.stdin)
app_id = sys.argv[1]
app = next((item for item in value.get("result", []) if item.get("id") == app_id), None)
if app is None:
    raise SystemExit(1)
scopes = [str(app.get("domain", ""))]
for destination in app.get("destinations", []) or []:
    if isinstance(destination, dict) and destination.get("type") == "public":
        scopes.append(str(destination.get("uri", "")))
print(",".join(item for item in scopes if item))
' "$access_app_id" <<<"$apps_response")" || fail 'Cloudflare Access application scope is invalid'

  policies_response="$(api_request GET "/accounts/$account_id/access/apps/$access_app_id/policies?per_page=100" '' "$api_token")" ||
    fail 'Cloudflare Access policies could not be listed'
  require_api_success <<<"$policies_response" || fail 'Cloudflare rejected the Access policy lookup'
  access_policy_id="$(python3 -c '
import json, sys
value = json.load(sys.stdin)
matches = []
for policy in value.get("result", []):
    if policy.get("decision") != "allow":
        continue
    if any(isinstance(rule, dict) and "email" in rule for rule in policy.get("include", [])):
        matches.append(policy)
if len(matches) != 1:
    raise SystemExit(1)
print(matches[0].get("id", ""))
' <<<"$policies_response")" ||
    fail 'expected exactly one email-based allow policy for the Access application'
  [[ "$access_policy_id" =~ ^[A-Fa-f0-9-]{32,36}$ ]] || fail 'Cloudflare Access policy ID is invalid'
  access_policy_reusable="$(python3 -c '
import json, sys
value = json.load(sys.stdin)
policy_id = sys.argv[1]
policy = next((item for item in value.get("result", []) if item.get("id") == policy_id), None)
if policy is None:
    raise SystemExit(1)
print("true" if policy.get("reusable") is True else "false")
' "$access_policy_id" <<<"$policies_response")" || fail 'Cloudflare Access policy type is invalid'
  access_policies_response="$policies_response"
}

access_policy_status() {
  local api_token="$1"
  resolve_access_policy "$api_token"
  python3 -c '
import json, sys
value = json.load(sys.stdin)
policy_id = sys.argv[1]
host = sys.argv[2]
policy = next((item for item in value.get("result", []) if item.get("id") == policy_id), None)
if policy is None:
    raise SystemExit(1)
emails = []
for rule in policy.get("include", []):
    entry = rule.get("email") if isinstance(rule, dict) else None
    if isinstance(entry, dict) and isinstance(entry.get("email"), str):
        emails.append(entry["email"])
policy_name = policy.get("name", "unnamed")
print(f"cloudflare Access policy: host={host} app={sys.argv[3]} policy={policy_id} name={policy_name} scope={sys.argv[4]} reusable={sys.argv[5]}")
print("approved emails: " + ",".join(emails))
' "$access_policy_id" "$public_url" "$access_app_id" "$access_app_scope" "$access_policy_reusable" <<<"$access_policies_response" ||
    fail 'Cloudflare Access policy response was invalid'
}

sync_access_policy() {
  local api_token="$1" update_payload update_response update_path desired_emails actual_emails
  resolve_access_policy "$api_token"
  update_payload="$(python3 -c '
import json, sys
value = json.load(sys.stdin)
policy_id, configured = sys.argv[1:3]
policy = next((item for item in value.get("result", []) if item.get("id") == policy_id), None)
if policy is None:
    raise SystemExit(1)
emails = []
for raw in configured.split(","):
    email = raw.strip().lower()
    if email and email not in emails:
        emails.append(email)
non_email_rules = [rule for rule in policy.get("include", []) if not (isinstance(rule, dict) and "email" in rule)]
payload = {
    "name": policy["name"],
    "decision": policy["decision"],
    "include": non_email_rules + [{"email": {"email": email}} for email in emails],
}
for key in (
    "exclude", "require", "session_duration",
    "purpose_justification_required", "purpose_justification_prompt",
    "approval_required", "approval_groups", "isolation_required",
    "mfa_config", "connection_rules",
):
    if key in policy and policy[key] is not None:
        payload[key] = policy[key]
print(json.dumps(payload, separators=(",", ":")))
' "$access_policy_id" "$allowed_emails" <<<"$access_policies_response")" ||
    fail 'could not construct the Cloudflare Access policy update'

  if [[ "$access_policy_reusable" == 'true' ]]; then
    update_path="/accounts/$account_id/access/policies/$access_policy_id"
  else
    update_path="/accounts/$account_id/access/apps/$access_app_id/policies/$access_policy_id"
  fi
  if ! update_response="$(api_request PUT "$update_path" "$update_payload" "$api_token")"; then
    python3 -c '
import json, sys
try:
    value = json.load(sys.stdin)
except Exception:
    raise SystemExit(0)
for error in value.get("errors", []):
    if isinstance(error, dict) and error.get("message"):
        print("Cloudflare API error: " + str(error["message"]), file=sys.stderr)
' <<<"$update_response"
    fail 'Cloudflare Access policy update failed'
  fi
  require_api_success <<<"$update_response" || fail 'Cloudflare rejected the Access policy update'

  resolve_access_policy "$api_token"
  desired_emails="$(tr ',' '\n' <<<"$allowed_emails" | sed 's/[[:space:]]//g; /^$/d' | tr '[:upper:]' '[:lower:]' | sort -u | paste -sd, -)"
  actual_emails="$(python3 -c '
import json, sys
value = json.load(sys.stdin)
policy_id = sys.argv[1]
policy = next((item for item in value.get("result", []) if item.get("id") == policy_id), None)
if policy is None:
    raise SystemExit(1)
emails = []
for rule in policy.get("include", []):
    entry = rule.get("email") if isinstance(rule, dict) else None
    if isinstance(entry, dict) and isinstance(entry.get("email"), str):
        emails.append(entry["email"].strip().lower())
print(",".join(sorted(set(emails))))
' "$access_policy_id" <<<"$access_policies_response")" ||
    fail 'could not verify the updated Cloudflare Access policy'
  [[ "$actual_emails" == "$desired_emails" ]] || fail 'Cloudflare Access policy verification did not match the configured allowlist'
  printf 'cloudflare Access policy synchronized: host=%s approved_emails=%s\n' "$public_url" "$actual_emails"
}

parse_access_report_arguments() {
  report_email=''
  report_hours=24
  report_format='markdown'
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --email)
        [[ -n "${2:-}" ]] || fail "$operation --email requires an exact email address"
        report_email="$2"
        shift 2
        ;;
      --hours)
        [[ "${2:-}" =~ ^[0-9]+$ ]] || fail "$operation --hours requires a number"
        report_hours="$2"
        shift 2
        ;;
      --format)
        [[ "${2:-}" == 'markdown' || "${2:-}" == 'jsonl' ]] || fail "$operation format must be markdown or jsonl"
        report_format="$2"
        shift 2
        ;;
      *) fail "$operation accepts only --email EMAIL, --hours HOURS, and --format markdown|jsonl" ;;
    esac
  done
  [[ -z "$report_email" || "$report_email" =~ ^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]] ||
    fail "$operation requires an exact email address"
  (( report_hours >= 1 && report_hours <= 168 )) || fail "$operation hours must be between 1 and 168"
}


access_auth_logs() {
  local api_token="$1" email="$2" hours="$3" output_format="$4" query_path response
  query_path="$(python3 -c '
import datetime, sys, urllib.parse
hours = int(sys.argv[1])
until = datetime.datetime.now(datetime.timezone.utc)
since = until - datetime.timedelta(hours=hours)
params = {
    "per_page": "1000",
    "direction": "desc",
    "since": since.isoformat(timespec="seconds").replace("+00:00", "Z"),
    "until": until.isoformat(timespec="seconds").replace("+00:00", "Z"),
}
if sys.argv[3]:
    params["email"] = sys.argv[3]
    params["emailOp"] = "eq"
print("/accounts/" + sys.argv[2] + "/access/logs/access_requests?" + urllib.parse.urlencode(params))
' "$hours" "$account_id" "$email")" || fail 'could not construct the Access authentication log query'
  if ! response="$(api_request GET "$query_path" '' "$api_token")"; then
    fail 'Cloudflare Access authentication logs could not be retrieved; the API token may need Access: Audit Logs Read'
  fi
  require_api_success <<<"$response" || fail 'Cloudflare rejected the Access authentication log query'
  python3 -c '
import json, sys, urllib.parse
value = json.load(sys.stdin)
email = sys.argv[1].strip().lower()
hours = int(sys.argv[2])
output_format = sys.argv[3]
target = sys.argv[4]
target_host = (urllib.parse.urlsplit(target).hostname or "").lower()
events = [
    event for event in value.get("result", [])
    if str(event.get("app_domain", "")).split("/", 1)[0].strip().lower() == target_host
    and (not email or str(event.get("user_email", "")).strip().lower() == email)
]
def normalized_event(event):
    allowed = event.get("allowed")
    decision = "allowed" if allowed is True else "blocked" if allowed is False else "unknown"
    return {
        "timestamp": event.get("created_at"),
        "decision": decision,
        "user": event.get("user_email"),
        "app": event.get("app_domain"),
        "identity_provider": event.get("connection"),
        "country": event.get("country"),
    }
rows = [normalized_event(event) for event in events]
connected_users = sorted({str(row["user"]).strip().lower() for row in rows if row["decision"] == "allowed" and row["user"]})
allowed_count = sum(row["decision"] == "allowed" for row in rows)
blocked_count = sum(row["decision"] == "blocked" for row in rows)
if output_format == "jsonl":
    print(json.dumps({"type":"summary", "source":"cloudflare_access_api", "target":target,
                      "email":email or None, "hours":hours, "count":len(rows),
                      "connected_users":connected_users, "allowed_events":allowed_count,
                      "blocked_events":blocked_count}, separators=(",", ":"), ensure_ascii=True))
    for row in rows:
        print(json.dumps({"type":"event", **row}, separators=(",", ":"), ensure_ascii=True))
    raise SystemExit(0)
def cell(value):
    if value is None or value == "":
        return "-"
    return str(value).replace("\\", "\\\\").replace("|", "\\|").replace("\r", " ").replace("\n", " ")
print("## Cloudflare Access authentication events")
print()
print("- Source: Cloudflare Access API")
print(f"- Target: `{cell(target)}`")
print(f"- Window: last {hours} hours")
print(f"- User: `{cell(email)}`" if email else "- User: all identities")
print(f"- Events: {len(rows)}")
print(f"- Connected users: {len(connected_users)}")
print(f"- Allowed events: {allowed_count}")
print(f"- Blocked events: {blocked_count}")
if connected_users:
    print("- Connected identities: " + ", ".join(f"`{cell(user)}`" for user in connected_users))
if not rows:
    print()
    print("No authentication events found.")
    raise SystemExit(0)
print()
print("| Time (UTC) | Decision | User | Application | Method | Country |")
print("|---|---|---|---|---|---|")
for row in rows:
    print("| " + " | ".join(cell(row[key]) for key in ("timestamp", "decision", "user", "app", "identity_provider", "country")) + " |")
' "$email" "$hours" "$output_format" "$public_url" <<<"$response" || fail 'Cloudflare Access authentication log response was invalid'
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
  access-policy-status)
    [[ $# -eq 0 ]] || fail 'access-policy-status accepts no additional arguments'
    validate_config
    command -v curl >/dev/null 2>&1 || fail 'curl is required'
    command -v python3 >/dev/null 2>&1 || fail 'python3 is required'
    api_token="$(read_secret "$api_token_env")"
    access_policy_status "$api_token"
    ;;
  access-auth-logs)
    parse_access_report_arguments "$@"
    validate_config
    command -v curl >/dev/null 2>&1 || fail 'curl is required'
    command -v python3 >/dev/null 2>&1 || fail 'python3 is required'
    api_token="$(read_secret "$api_token_env")"
    access_auth_logs "$api_token" "$report_email" "$report_hours" "$report_format"
    ;;
  sync-access-policy)
    [[ "${1:-}" == '--apply' && $# -eq 1 ]] || fail 'sync-access-policy requires the exact --apply flag'
    validate_config
    command -v curl >/dev/null 2>&1 || fail 'curl is required'
    command -v python3 >/dev/null 2>&1 || fail 'python3 is required'
    api_token="$(read_secret "$api_token_env")"
    sync_access_policy "$api_token"
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

route = {"hostname": sys.argv[1], "service": sys.argv[2]}
if not sys.argv[2].startswith("ssh://"):
    origin_request = {"noTLSVerify": False}
    if sys.argv[3]:
        origin_request["originServerName"] = sys.argv[3]
    if sys.argv[4]:
        origin_request["caPool"] = sys.argv[4]
    route["originRequest"] = origin_request
print(json.dumps({"config": {"ingress": [
    route,
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
  controller-state)
    [[ $# -eq 0 ]] || fail 'controller-state accepts no additional arguments'
    validate_config
    controller_state
    ;;
  controller-enable)
    [[ "${1:-}" == '--apply' && $# -eq 1 ]] || fail 'controller-enable requires the exact --apply flag'
    validate_config
    controller_enable
    ;;
  controller-disable)
    [[ "${1:-}" == '--apply' && $# -eq 1 ]] || fail 'controller-disable requires the exact --apply flag'
    validate_config
    controller_disable
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
