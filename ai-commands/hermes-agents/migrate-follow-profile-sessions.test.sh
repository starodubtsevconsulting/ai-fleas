#!/usr/bin/env bash
set -euo pipefail
dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
root="$(mktemp -d "${TMPDIR:-/tmp}/hermes-session-migration.XXXXXX")"
trap 'rm -rf -- "$root"' EXIT
db="$root/state.db"
sqlite3 "$db" <<'SQL'
CREATE TABLE sessions (id TEXT PRIMARY KEY, title TEXT, model TEXT, model_config TEXT, billing_base_url TEXT, system_prompt TEXT, system_prompt_hash TEXT);
INSERT INTO sessions VALUES ('bot', 'Bot Chat', 'old-model', '{"follow_profile_config":true}', 'http://old.invalid/v1', 'prompt', 'hash');
INSERT INTO sessions VALUES ('chat', 'User chat', 'old-model', '{}', 'http://old.invalid/v1', 'prompt', 'hash');
SQL
python3 "$dir/migrate-follow-profile-sessions.py" --state-db "$db" --model new-model --provider new-provider --base-url http://192.0.2.10:8080/v1
[[ "$(sqlite3 "$db" "SELECT model FROM sessions WHERE id='bot'")" == new-model ]]
[[ "$(sqlite3 "$db" "SELECT json_extract(model_config, '$.provider') FROM sessions WHERE id='bot'")" == new-provider ]]
[[ "$(sqlite3 "$db" "SELECT model FROM sessions WHERE id='chat'")" == old-model ]]
compgen -G "$db.pre-provider-migration-*" >/dev/null
printf '%s\n' 'Hermes profile-following session migration: PASS'
