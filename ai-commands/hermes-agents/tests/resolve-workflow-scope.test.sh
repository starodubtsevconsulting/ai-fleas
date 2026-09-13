#!/usr/bin/env bash
set -euo pipefail

readonly TEST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
readonly SOURCE_DIR="$(cd "${TEST_DIR}/../src" && pwd -P)"
test_root="$(mktemp -d "${TMPDIR:-/tmp}/hermes-scope-test.XXXXXX")"
cleanup() { rm -rf -- "${test_root}"; }
trap cleanup EXIT INT TERM

mkdir -p "${test_root}/profiles/example/workflows-config/youtube" \
  "${test_root}/profiles/example/projects/youtube/channel" \
  "${test_root}/workflows/youtube/flows" "${test_root}/workflows/_common/roles" \
  "${test_root}/commands/writing" "${test_root}/workspace"

printf '# YouTube\n' >"${test_root}/workflows/youtube/youtube.workflow.md"
printf '# Worker\n' >"${test_root}/workflows/_common/roles/worker.md"
printf '# Lyrics flow\n' >"${test_root}/workflows/youtube/flows/lyrics.md"
printf '# Audio flow\n' >"${test_root}/workflows/youtube/flows/audio.md"
printf '# Writing\n' >"${test_root}/commands/writing/writing.command.md"

cat >"${test_root}/workflows/youtube/agents.yml" <<'YAML'
workflowId: youtube
agents:
  - agentId: lyrics-script-worker
    roleDefinition: ../_common/roles/worker.md
    flow: flows/lyrics.md
    aiProvider: youtube-lyrics-script
  - agentId: audio-worker
    roleDefinition: ../_common/roles/worker.md
    flow: flows/audio.md
    aiProvider: youtube-default-worker
YAML

cat >"${test_root}/profiles/example/example-work-profile.yml" <<YAML
name: example
default_workflow: youtube.workflow.md
agent_platforms: { available: [hermes] }
ai_commands_root: ../../commands
ai_workflows_root: ../../workflows
workflows:
  - path: youtube.workflow.md
    local_ai: { providers_config: providers.yml, provider: openai-service, model: gpt-sol }
    agent_providers_config: workflows-config/youtube/agents.yml
    commands: [writing]
    projects: [{ ref: projects/youtube/channel/project.yml }]
YAML

cat >"${test_root}/profiles/example/providers.yml" <<'YAML'
providers:
  - id: gx10-local
    label: GX10
    protocol: openai-compatible
    endpoint: { url: http://192.0.2.31:8080/v1 }
    models:
      - id: gemma-q8
        provider_model: gemma-4-31b-q8
        hermes: { context_window_tokens: 32768, compression_threshold: 0.25, compression_target: 0.15, protect_last_messages: 8 }
  - id: openai-service
    label: OpenAI
    protocol: openai-compatible
    endpoint: { url: https://api.example.invalid/v1 }
    models:
      - id: gpt-sol
        provider_model: gpt-5.6-sol
        hermes: { context_window_tokens: 65536, compression_threshold: 0.25, compression_target: 0.15, protect_last_messages: 8 }
YAML

cat >"${test_root}/profiles/example/workflows-config/youtube/agents.yml" <<'YAML'
schema_version: workflow-agent-providers.v1
workflow_id: youtube
bindings:
  youtube-lyrics-script: { provider: gx10-local, model: gemma-q8 }
  youtube-default-worker: { provider: openai-service, model: gpt-sol }
YAML

cat >"${test_root}/profiles/example/projects/youtube/channel/project.yml" <<YAML
id: channel
label: Channel
repo_path: ${test_root}/workspace
YAML

scope="$(node "${SOURCE_DIR}/resolve-workflow-scope.mjs" "${test_root}/profiles" example youtube channel)"
role_bindings="$(awk -F '\t' '{print $18}' <<<"${scope}")"

ROLE_BINDINGS="${role_bindings}" TEST_ROOT="${test_root}" python3 - <<'PY'
import base64
import os

records = [record.split("|") for record in os.environ["ROLE_BINDINGS"].split(",")]
assert len(records) == 2
by_role = {record[0]: record for record in records}
lyrics = by_role["lyrics-script-worker"]
audio = by_role["audio-worker"]
assert lyrics[2] == "gx10-local" and lyrics[5] == "gemma-4-31b-q8" and lyrics[6] == "32768"
assert audio[2] == "openai-service" and audio[5] == "gpt-5.6-sol" and audio[6] == "65536"
assert base64.b64decode(lyrics[11]).decode().endswith("/workflows/youtube/flows/lyrics.md")
assert base64.b64decode(audio[11]).decode().endswith("/workflows/youtube/flows/audio.md")
PY

printf '%s\n' 'Hermes per-agent provider/model and flow resolution: PASS'
