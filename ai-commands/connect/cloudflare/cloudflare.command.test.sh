#!/usr/bin/env bash
set -euo pipefail

command_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
command_path="$command_dir/cloudflare.command.sh"
commands_root="$(cd "$command_dir/../.." && pwd -P)"
repository_root="$(cd "$commands_root/.." && pwd -P)"
fixture_dir="$(mktemp -d)"
trap 'rm -rf "$fixture_dir"' EXIT

export AI_PROFILE_FILE="$repository_root/ai-profile/example/example-work-profile.yml"
export AI_WORK_PROFILE_ID=example
export AI_FLOW_WORKFLOW=dev.workflow.md
export AI_COMMANDS_ROOT="$commands_root"
export AI_FLEAS_RUNTIME_LOCK_DIR="$fixture_dir/locks"

if env -u AI_PROFILE_FILE -u AI_WORK_PROFILE_ID -u WORK_PROFILE_ID -u AI_FLOW_WORKFLOW \
  CLOUDFLARE_COMMAND_CONF="$fixture_dir/missing.env" "$command_path" validate >"$fixture_dir/out" 2>"$fixture_dir/err"; then
  echo 'expected the profile guard to reject an unactivated command' >&2
  exit 1
fi
grep -F 'PROFILE_REQUIRED: select an AI Profile before running command cloudflare' "$fixture_dir/err" >/dev/null

write_config() {
  local origin="${1:-http://192.168.50.10:8000}"
  cat >"$fixture_dir/config.env" <<EOF
CLOUDFLARE_PUBLIC_URL="https://ai.example.invalid"
CLOUDFLARE_ORIGIN_URL="$origin"
CLOUDFLARE_TUNNEL_NAME="example-private-ai"
CLOUDFLARE_TUNNEL_TOKEN_ENV="TEST_TUNNEL_TOKEN"
CLOUDFLARE_TUNNEL_TOKEN_FILE=""
CLOUDFLARE_API_TOKEN_ENV="TEST_API_TOKEN"
CLOUDFLARE_ACCOUNT_ID="0123456789abcdef0123456789abcdef"
CLOUDFLARE_ZONE_ID="abcdef0123456789abcdef0123456789"
CLOUDFLARE_ALLOWED_EMAILS="one@example.invalid,two@example.invalid"
CLOUDFLARE_ACCESS_LOGIN_SUFFIX=".cloudflareaccess.com"
EOF
}

write_config
output="$(CLOUDFLARE_COMMAND_CONF="$fixture_dir/config.env" "$command_path" validate)"
[[ "$output" == *'configuration valid'* ]]
[[ "$output" == *'approved_identities=2'* ]]

grep -F 'run install-connector --apply' "$command_path" >/dev/null
grep -F 'install/cloudflare/cloudflare-connector.command.sh' "$command_path" >/dev/null

write_config 'https://public.example.com:8000'
if CLOUDFLARE_COMMAND_CONF="$fixture_dir/config.env" "$command_path" validate >"$fixture_dir/out" 2>"$fixture_dir/err"; then
  echo 'expected public origin validation to fail' >&2
  exit 1
fi
grep -F 'private or loopback host' "$fixture_dir/err" >/dev/null

write_config 'https://127.0.0.1:8443'
cat >>"$fixture_dir/config.env" <<'EOF'
CLOUDFLARE_ORIGIN_SERVER_NAME="ai.example.invalid"
CLOUDFLARE_ORIGIN_CA_POOL="/private/ca/origin-ca.pem"
EOF
CLOUDFLARE_COMMAND_CONF="$fixture_dir/config.env" "$command_path" validate

write_config 'https://proxy:8443'
cat >>"$fixture_dir/config.env" <<'EOF'
CLOUDFLARE_ORIGIN_SCOPE="container"
CLOUDFLARE_ORIGIN_SERVER_NAME="ai.example.invalid"
CLOUDFLARE_ORIGIN_CA_POOL="/private/ca/origin-ca.pem"
EOF
CLOUDFLARE_COMMAND_CONF="$fixture_dir/config.env" "$command_path" validate
if CLOUDFLARE_COMMAND_CONF="$fixture_dir/config.env" "$command_path" origin-status >"$fixture_dir/out" 2>"$fixture_dir/err"; then
  echo 'expected host-side origin-status for a container service to fail' >&2
  exit 1
fi
grep -F 'must run inside the connector network' "$fixture_dir/err" >/dev/null

write_config 'https://proxy:8443'
cat >>"$fixture_dir/config.env" <<'EOF'
CLOUDFLARE_ORIGIN_SERVER_NAME="ai.example.invalid"
EOF
if CLOUDFLARE_COMMAND_CONF="$fixture_dir/config.env" "$command_path" validate >"$fixture_dir/out" 2>"$fixture_dir/err"; then
  echo 'expected a container service name without explicit container scope to fail' >&2
  exit 1
fi
grep -F 'private or loopback host' "$fixture_dir/err" >/dev/null

write_config 'https://127.0.0.1:8443'
cat >>"$fixture_dir/config.env" <<'EOF'
CLOUDFLARE_ORIGIN_SCOPE="container"
CLOUDFLARE_ORIGIN_SERVER_NAME="ai.example.invalid"
EOF
if CLOUDFLARE_COMMAND_CONF="$fixture_dir/config.env" "$command_path" validate >"$fixture_dir/out" 2>"$fixture_dir/err"; then
  echo 'expected a loopback origin in container scope to fail' >&2
  exit 1
fi
grep -F 'single safe service name' "$fixture_dir/err" >/dev/null

write_config
cat >>"$fixture_dir/config.env" <<'EOF'
CLOUDFLARE_ORIGIN_SERVER_NAME="ai.example.invalid"
EOF
if CLOUDFLARE_COMMAND_CONF="$fixture_dir/config.env" "$command_path" validate >"$fixture_dir/out" 2>"$fixture_dir/err"; then
  echo 'expected HTTP origin TLS parameters to fail' >&2
  exit 1
fi
grep -F 'require an HTTPS origin' "$fixture_dir/err" >/dev/null

write_config
sed -i.bak 's/one@example.invalid,two@example.invalid/*/' "$fixture_dir/config.env"
if CLOUDFLARE_COMMAND_CONF="$fixture_dir/config.env" "$command_path" validate >"$fixture_dir/out" 2>"$fixture_dir/err"; then
  echo 'expected wildcard identity validation to fail' >&2
  exit 1
fi
grep -F 'wildcard Access identities are prohibited' "$fixture_dir/err" >/dev/null

write_config
if CLOUDFLARE_COMMAND_CONF="$fixture_dir/config.env" "$command_path" install-service >"$fixture_dir/out" 2>"$fixture_dir/err"; then
  echo 'expected install-service without --apply to fail' >&2
  exit 1
fi
grep -F 'requires the exact --apply flag' "$fixture_dir/err" >/dev/null

mkdir -p "$fixture_dir/fake-bin"
cat >"$fixture_dir/fake-bin/cloudflared" <<'SH'
#!/usr/bin/env bash
printf '%s\n' "$*" >"$CLOUDFLARE_FAKE_ARGS"
SH
chmod +x "$fixture_dir/fake-bin/cloudflared"
cat >"$fixture_dir/fake-bin/pgrep" <<'SH'
#!/usr/bin/env bash
exit 1
SH
chmod +x "$fixture_dir/fake-bin/pgrep"
cat >"$fixture_dir/fake-bin/uname" <<'SH'
#!/usr/bin/env bash
printf 'Linux\n'
SH
chmod +x "$fixture_dir/fake-bin/uname"
cat >"$fixture_dir/fake-bin/stat" <<'SH'
#!/usr/bin/env bash
[[ "${1:-}" == '-c' && "${2:-}" == '%a' ]] || exit 64
printf '%s\n' "${CLOUDFLARE_FAKE_MODE:-600}"
SH
chmod +x "$fixture_dir/fake-bin/stat"
printf '%s' 'synthetic-file-tunnel-token' >"$fixture_dir/file-tunnel-token"
chmod 600 "$fixture_dir/file-tunnel-token"
sed -i.bak "s|CLOUDFLARE_TUNNEL_TOKEN_FILE=\"\"|CLOUDFLARE_TUNNEL_TOKEN_FILE=\"$fixture_dir/file-tunnel-token\"|" "$fixture_dir/config.env"
unset TEST_TUNNEL_TOKEN || true
PATH="$fixture_dir/fake-bin:$PATH" \
  CLOUDFLARE_FAKE_ARGS="$fixture_dir/cloudflared-args" \
  CLOUDFLARE_COMMAND_CONF="$fixture_dir/config.env" \
  "$command_path" run-tunnel
grep -F 'tunnel --no-autoupdate run --token synthetic-file-tunnel-token' "$fixture_dir/cloudflared-args" >/dev/null

if AI_FLEAS_RUNTIME_LOCK_DIR="$fixture_dir/invalid-mode-locks" PATH="$fixture_dir/fake-bin:$PATH" \
  CLOUDFLARE_FAKE_MODE=644 \
  CLOUDFLARE_FAKE_ARGS="$fixture_dir/cloudflared-invalid-mode-args" \
  CLOUDFLARE_COMMAND_CONF="$fixture_dir/config.env" \
  "$command_path" run-tunnel >"$fixture_dir/out" 2>"$fixture_dir/err"; then
  printf 'expected an unsafe Linux token-file mode to fail\n' >&2
  exit 1
fi
grep -F 'CLOUDFLARE_TUNNEL_TOKEN_FILE must have mode 0600' "$fixture_dir/err" >/dev/null
if grep -F 'unbound variable' "$fixture_dir/err" >/dev/null; then
  printf 'cleanup trap referenced an out-of-scope lock variable\n' >&2
  exit 1
fi
[[ ! -e "$fixture_dir/invalid-mode-locks/ai-fleas-cloudflare-example-private-ai.lock" ]]

mkdir -p "$fixture_dir/locks/ai-fleas-cloudflare-example-private-ai.lock"
printf '%s\n' "$$" >"$fixture_dir/locks/ai-fleas-cloudflare-example-private-ai.lock/pid"
if AI_FLEAS_RUNTIME_LOCK_DIR="$fixture_dir/locks" PATH="$fixture_dir/fake-bin:$PATH" \
  CLOUDFLARE_FAKE_ARGS="$fixture_dir/cloudflared-duplicate-args" \
  CLOUDFLARE_COMMAND_CONF="$fixture_dir/config.env" \
  "$command_path" run-tunnel >"$fixture_dir/out" 2>"$fixture_dir/err"; then
  printf 'expected duplicate connector lock to block launch\n' >&2
  exit 1
fi
grep -F 'already managed by process' "$fixture_dir/err" >/dev/null
[[ ! -e "$fixture_dir/cloudflared-duplicate-args" ]]
rm -rf "$fixture_dir/locks/ai-fleas-cloudflare-example-private-ai.lock"

cat >"$fixture_dir/server.py" <<'PY'
import json
import pathlib
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer

record = pathlib.Path(sys.argv[1])
port_file = pathlib.Path(sys.argv[2])
tunnel_id = "12345678-1234-1234-1234-123456789abc"

class Handler(BaseHTTPRequestHandler):
    def handle_write(self):
        length = int(self.headers.get("content-length", "0"))
        body = self.rfile.read(length).decode()
        with record.open("a") as output:
            output.write(json.dumps({"method": self.command, "path": self.path, "body": json.loads(body)}) + "\n")
        result = {"id": tunnel_id, "token": "synthetic-tunnel-token"} if self.path.endswith("/cfd_tunnel") else {}
        payload = json.dumps({"success": True, "errors": [], "result": result}).encode()
        self.send_response(200)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    do_POST = handle_write
    do_PUT = handle_write
    def log_message(self, *_):
        pass

server = HTTPServer(("127.0.0.1", 0), Handler)
port_file.write_text(str(server.server_port))
for _ in range(3):
    server.handle_request()
PY

python3 "$fixture_dir/server.py" "$fixture_dir/requests.jsonl" "$fixture_dir/port" &
server_pid=$!
for _ in $(seq 1 50); do
  [[ -s "$fixture_dir/port" ]] && break
  sleep 0.05
done
[[ -s "$fixture_dir/port" ]]
export TEST_API_TOKEN='synthetic-api-token'
create_output="$(CLOUDFLARE_COMMAND_CONF="$fixture_dir/config.env" \
  CLOUDFLARE_TEST_ORIGIN=1 \
  CLOUDFLARE_API_BASE_URL="http://127.0.0.1:$(cat "$fixture_dir/port")" \
  "$command_path" create-tunnel --apply --token-output "$fixture_dir/tunnel-token")"
wait "$server_pid"
[[ "$create_output" == *'cloudflare tunnel created'* ]]
[[ "$(cat "$fixture_dir/tunnel-token")" == 'synthetic-tunnel-token' ]]
[[ "$(stat -f '%Lp' "$fixture_dir/tunnel-token" 2>/dev/null || stat -c '%a' "$fixture_dir/tunnel-token")" == '600' ]]
python3 - "$fixture_dir/requests.jsonl" <<'PY'
import json, pathlib, sys
requests = [json.loads(line) for line in pathlib.Path(sys.argv[1]).read_text().splitlines()]
assert [item["method"] for item in requests] == ["POST", "PUT", "POST"]
assert requests[0]["path"].endswith("/accounts/0123456789abcdef0123456789abcdef/cfd_tunnel")
assert requests[0]["body"] == {"name": "example-private-ai", "config_src": "cloudflare"}
assert requests[1]["body"]["config"]["ingress"][-1] == {"service": "http_status:404"}
origin_request = requests[1]["body"]["config"]["ingress"][0]["originRequest"]
assert origin_request == {"noTLSVerify": False}
assert requests[2]["body"]["content"] == "12345678-1234-1234-1234-123456789abc.cfargotunnel.com"
assert requests[2]["body"]["proxied"] is True
PY

write_config 'https://proxy:8443'
cat >>"$fixture_dir/config.env" <<'EOF'
CLOUDFLARE_ORIGIN_SCOPE="container"
CLOUDFLARE_ORIGIN_SERVER_NAME="ai.example.invalid"
CLOUDFLARE_ORIGIN_CA_POOL="/private/ca/origin-ca.pem"
EOF
python3 "$fixture_dir/server.py" "$fixture_dir/https-requests.jsonl" "$fixture_dir/https-port" &
server_pid=$!
for _ in $(seq 1 50); do
  [[ -s "$fixture_dir/https-port" ]] && break
  sleep 0.05
done
[[ -s "$fixture_dir/https-port" ]]
create_output="$(CLOUDFLARE_COMMAND_CONF="$fixture_dir/config.env" \
  CLOUDFLARE_TEST_ORIGIN=1 \
  CLOUDFLARE_API_BASE_URL="http://127.0.0.1:$(cat "$fixture_dir/https-port")" \
  "$command_path" create-tunnel --apply --token-output "$fixture_dir/https-tunnel-token")"
wait "$server_pid"
[[ "$create_output" == *'cloudflare tunnel created'* ]]
python3 - "$fixture_dir/https-requests.jsonl" <<'PY'
import json, pathlib, sys
requests = [json.loads(line) for line in pathlib.Path(sys.argv[1]).read_text().splitlines()]
assert requests[1]["body"]["config"]["ingress"][0]["service"] == "https://proxy:8443"
origin_request = requests[1]["body"]["config"]["ingress"][0]["originRequest"]
assert origin_request == {
    "noTLSVerify": False,
    "originServerName": "ai.example.invalid",
    "caPool": "/private/ca/origin-ca.pem",
}
PY

command -v openssl >/dev/null 2>&1 || { echo 'openssl is required for origin TLS tests' >&2; exit 1; }
mkdir -p "$fixture_dir/certs"
openssl req -x509 -newkey rsa:2048 -nodes -days 1 \
  -keyout "$fixture_dir/certs/trusted-ca.key" -out "$fixture_dir/certs/trusted-ca.pem" \
  -subj '/CN=Synthetic trusted CA' >/dev/null 2>&1
openssl req -x509 -newkey rsa:2048 -nodes -days 1 \
  -keyout "$fixture_dir/certs/untrusted-ca.key" -out "$fixture_dir/certs/untrusted-ca.pem" \
  -subj '/CN=Synthetic untrusted CA' >/dev/null 2>&1

issue_certificate() {
  local name="$1" ca_prefix="$2" output_prefix="$3"
  openssl req -newkey rsa:2048 -nodes -keyout "$output_prefix.key" -out "$output_prefix.csr" \
    -subj "/CN=$name" >/dev/null 2>&1
  printf 'subjectAltName=DNS:%s\n' "$name" >"$output_prefix.ext"
  openssl x509 -req -days 1 -in "$output_prefix.csr" -CA "$ca_prefix.pem" -CAkey "$ca_prefix.key" \
    -CAcreateserial -out "$output_prefix.pem" -extfile "$output_prefix.ext" >/dev/null 2>&1
}

cat >"$fixture_dir/tls-server.py" <<'PY'
import http.server
import pathlib
import ssl
import sys

port_file, certificate, key = map(pathlib.Path, sys.argv[1:4])
expected_name = sys.argv[4]

class Handler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        if self.headers.get("Host") != f"{expected_name}:{self.server.server_port}":
            self.send_response(421)
            self.end_headers()
            return
        self.send_response(204)
        self.end_headers()
    def log_message(self, *_):
        pass

server = http.server.HTTPServer(("127.0.0.1", 0), Handler)
context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
context.load_cert_chain(certificate, key)
server.socket = context.wrap_socket(server.socket, server_side=True)
port_file.write_text(str(server.server_port))
server.handle_request()
PY

start_tls_server() {
  local name="$1" certificate="$2" key="$3" port_file
  port_file="$fixture_dir/$name.port"
  python3 "$fixture_dir/tls-server.py" "$port_file" "$certificate" "$key" 'origin.example.invalid' &
  tls_server_pid=$!
  for _ in $(seq 1 50); do
    [[ -s "$port_file" ]] && break
    sleep 0.05
  done
  [[ -s "$port_file" ]]
  tls_server_port="$(cat "$port_file")"
}

issue_certificate 'origin.example.invalid' "$fixture_dir/certs/trusted-ca" "$fixture_dir/certs/valid-origin"
start_tls_server valid "$fixture_dir/certs/valid-origin.pem" "$fixture_dir/certs/valid-origin.key"
origin_port="$tls_server_port"
write_config "https://127.0.0.1:$origin_port"
cat >>"$fixture_dir/config.env" <<EOF
CLOUDFLARE_ORIGIN_SERVER_NAME="origin.example.invalid"
CLOUDFLARE_ORIGIN_CA_POOL="$fixture_dir/certs/trusted-ca.pem"
EOF
origin_output="$(CLOUDFLARE_COMMAND_CONF="$fixture_dir/config.env" "$command_path" origin-status)"
[[ "$origin_output" == *"origin healthy: url=https://origin.example.invalid:$origin_port/ status=204"* ]]
wait "$tls_server_pid"

issue_certificate 'wrong.example.invalid' "$fixture_dir/certs/trusted-ca" "$fixture_dir/certs/wrong-origin"
start_tls_server wrong-name "$fixture_dir/certs/wrong-origin.pem" "$fixture_dir/certs/wrong-origin.key"
origin_port="$tls_server_port"
write_config "https://127.0.0.1:$origin_port"
cat >>"$fixture_dir/config.env" <<EOF
CLOUDFLARE_ORIGIN_SERVER_NAME="origin.example.invalid"
CLOUDFLARE_ORIGIN_CA_POOL="$fixture_dir/certs/trusted-ca.pem"
EOF
if CLOUDFLARE_COMMAND_CONF="$fixture_dir/config.env" "$command_path" origin-status >"$fixture_dir/out" 2>"$fixture_dir/err"; then
  echo 'expected mismatched origin certificate hostname to fail' >&2
  exit 1
fi
grep -F 'origin unavailable: url=https://origin.example.invalid:' "$fixture_dir/out" >/dev/null
wait "$tls_server_pid" || true

issue_certificate 'origin.example.invalid' "$fixture_dir/certs/untrusted-ca" "$fixture_dir/certs/untrusted-origin"
start_tls_server untrusted-ca "$fixture_dir/certs/untrusted-origin.pem" "$fixture_dir/certs/untrusted-origin.key"
origin_port="$tls_server_port"
write_config "https://127.0.0.1:$origin_port"
cat >>"$fixture_dir/config.env" <<EOF
CLOUDFLARE_ORIGIN_SERVER_NAME="origin.example.invalid"
CLOUDFLARE_ORIGIN_CA_POOL="$fixture_dir/certs/trusted-ca.pem"
EOF
if CLOUDFLARE_COMMAND_CONF="$fixture_dir/config.env" "$command_path" origin-status >"$fixture_dir/out" 2>"$fixture_dir/err"; then
  echo 'expected origin certificate signed by an untrusted CA to fail' >&2
  exit 1
fi
grep -F 'origin unavailable: url=https://origin.example.invalid:' "$fixture_dir/out" >/dev/null
wait "$tls_server_pid" || true

write_config
cat >>"$fixture_dir/config.env" <<'SH'
CLOUDFLARE_SERVER_TARGETS="example=targets/example.env"
SH
cat >"$fixture_dir/fake-bin/curl" <<'SH'
#!/usr/bin/env bash
printf '%s\n' "$@" >"$CLOUDFLARE_FAKE_ARGS"
config="$(cat)"
[[ "$config" == 'header = "Authorization: Bearer synthetic-api-token"' ]] || exit 1
printf '{"success":true}\n'
SH
chmod +x "$fixture_dir/fake-bin/curl"
export TEST_API_TOKEN='synthetic-api-token'
token_output="$(PATH="$fixture_dir/fake-bin:$PATH" \
  CLOUDFLARE_FAKE_ARGS="$fixture_dir/token-check-args" \
  CLOUDFLARE_COMMAND_CONF="$fixture_dir/config.env" \
  "$command_path" token-check)"
[[ "$token_output" == 'cloudflare API token active' ]]
if grep -F "$TEST_API_TOKEN" "$fixture_dir/token-check-args" >/dev/null; then
  echo 'API token must not appear in curl process arguments' >&2
  exit 1
fi

echo 'cloudflare.command tests passed'
