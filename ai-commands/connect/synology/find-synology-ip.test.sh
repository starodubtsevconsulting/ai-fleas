#!/usr/bin/env bash
set -euo pipefail

command_dir="$(cd "$(dirname "$0")" && pwd -P)"
test_root="$(mktemp -d "${TMPDIR:-/tmp}/synology-discovery-test.XXXXXX")"
trap 'rm -rf -- "${test_root}"' EXIT INT TERM
mkdir -p "${test_root}/bin"

cat >"${test_root}/bin/arp" <<'EOF'
#!/usr/bin/env sh
cat <<'ARP'
? (10.0.0.3) at (incomplete) on en0 ifscope [ethernet]
? (10.0.0.10) at 0:11:32:dd:f0:69 on en0 ifscope [ethernet]
? (10.0.0.32) at 30:c5:99:3f:cb:45 on en0 ifscope [ethernet]
ARP
EOF

cat >"${test_root}/bin/nc" <<'EOF'
#!/usr/bin/env sh
[ "$4" = 10.0.0.10 ] && [ "$5" = 5001 ]
EOF

chmod +x "${test_root}/bin/arp" "${test_root}/bin/nc"
result="$(PATH="${test_root}/bin:/usr/bin:/bin" "${command_dir}/find-synology-ip.sh")"
[[ "$result" == '10.0.0.10' ]]
printf '%s\n' 'Synology macOS ARP discovery: PASS'

