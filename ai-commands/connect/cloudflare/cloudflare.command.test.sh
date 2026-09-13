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

write_config() {
  local origin="${1:-http://192.0.2.10:8000}"
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
printf '%s' 'synthetic-file-tunnel-token' >"$fixture_dir/file-tunnel-token"
chmod 600 "$fixture_dir/file-tunnel-token"
sed -i.bak "s|CLOUDFLARE_TUNNEL_TOKEN_FILE=\"\"|CLOUDFLARE_TUNNEL_TOKEN_FILE=\"$fixture_dir/file-tunnel-token\"|" "$fixture_dir/config.env"
unset TEST_TUNNEL_TOKEN || true
PATH="$fixture_dir/fake-bin:$PATH" \
  CLOUDFLARE_FAKE_ARGS="$fixture_dir/cloudflared-args" \
  CLOUDFLARE_COMMAND_CONF="$fixture_dir/config.env" \
  "$command_path" run-tunnel
grep -F 'tunnel --no-autoupdate run --token synthetic-file-tunnel-token' "$fixture_dir/cloudflared-args" >/dev/null

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
assert requests[2]["body"]["content"] == "12345678-1234-1234-1234-123456789abc.cfargotunnel.com"
assert requests[2]["body"]["proxied"] is True
PY

echo 'cloudflare.command tests passed'
