#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VALIDATOR="${SCRIPT_DIR}/validate-execution-routes.sh"
FIXTURE_ROOT="$(mktemp -d)"
trap 'rm -rf "${FIXTURE_ROOT}"' EXIT

write_registry() {
  local path="$1"
  shift
  {
    printf '# path\texecution_route\treasoning\timplementation\texecution\tui_acceptance\n'
    printf '%s\n' "$@"
  } > "$path"
}

expect_failure() {
  local expected="$1"
  shift
  local output
  if output="$("$@" 2>&1)"; then
    echo "Expected validator failure containing: ${expected}" >&2
    exit 1
  fi
  case "$output" in
    *"$expected"*) ;;
    *)
      echo "Missing validator error '${expected}': ${output}" >&2
      exit 1
      ;;
  esac
}

make_single_command_fixture() {
  local root="$1"
  mkdir -p "${root}/one"
  touch "${root}/one/one.command.md"
}

expect_failure 'command root must exist and be a directory' \
  bash "$VALIDATOR" "${FIXTURE_ROOT}/missing-root"

expect_failure 'command root must exist and be a directory: <empty>' \
  bash "$VALIDATOR" ""

non_directory_root="${FIXTURE_ROOT}/not-a-directory"
touch "$non_directory_root"
expect_failure 'command root must exist and be a directory' \
  bash "$VALIDATOR" "$non_directory_root"

expect_failure 'unsafe command root resolution: /' bash "$VALIDATOR" /

valid_root="${FIXTURE_ROOT}/valid"
mkdir -p "${valid_root}/space command" "${valid_root}/.agent-runtime/ignored" \
  "${valid_root}/.local/ignored" "${valid_root}/session-root/ignored" \
  "${valid_root}/sessions/ignored" "${valid_root}/node_modules/ignored" \
  "${valid_root}/.venv/ignored" "${valid_root}/dist/ignored" \
  "${valid_root}/log/ignored" "${valid_root}/logs/ignored"
touch "${valid_root}/space command/example.command.md"
for excluded in .agent-runtime .local session-root sessions node_modules .venv dist log logs; do
  touch "${valid_root}/${excluded}/ignored/ignored.command.md"
done
touch "${valid_root}/rollout-test.jsonl" "${valid_root}/cache.sqlite3"
write_registry "${valid_root}/execution-routes.tsv" \
  $'space command/example.command.md\tcommand-runner\t-\t-\t-\t-'
bash "$VALIDATOR" "${valid_root}///" "${valid_root}/execution-routes.tsv" >/dev/null

missing_root="${FIXTURE_ROOT}/missing"
mkdir -p "${missing_root}/one"
touch "${missing_root}/one/one.command.md"
write_registry "${missing_root}/execution-routes.tsv"
expect_failure 'registry must cover every command definition exactly once' \
  bash "$VALIDATOR" "$missing_root" "${missing_root}/execution-routes.tsv"

stale_root="${FIXTURE_ROOT}/stale"
mkdir -p "$stale_root"
write_registry "${stale_root}/execution-routes.tsv" \
  $'gone/gone.command.md\tcommand-runner\t-\t-\t-\t-'
expect_failure 'registry must cover every command definition exactly once' \
  bash "$VALIDATOR" "$stale_root" "${stale_root}/execution-routes.tsv"

duplicate_root="${FIXTURE_ROOT}/duplicate"
mkdir -p "${duplicate_root}/one"
touch "${duplicate_root}/one/one.command.md"
write_registry "${duplicate_root}/execution-routes.tsv" \
  $'one/one.command.md\tcommand-runner\t-\t-\t-\t-' \
  $'one/one.command.md\tcommand-runner\t-\t-\t-\t-'
expect_failure 'duplicate path' \
  bash "$VALIDATOR" "$duplicate_root" "${duplicate_root}/execution-routes.tsv"

invalid_route_root="${FIXTURE_ROOT}/invalid-route"
make_single_command_fixture "$invalid_route_root"
write_registry "${invalid_route_root}/execution-routes.tsv" \
  $'one/one.command.md\tunknown-role\t-\t-\t-\t-'
expect_failure 'invalid execution_route unknown-role' \
  bash "$VALIDATOR" "$invalid_route_root" "${invalid_route_root}/execution-routes.tsv"

non_mixed_portion_root="${FIXTURE_ROOT}/non-mixed-portion"
make_single_command_fixture "$non_mixed_portion_root"
write_registry "${non_mixed_portion_root}/execution-routes.tsv" \
  $'one/one.command.md\tcommand-runner\tdesigner-reviewer\t-\t-\t-'
expect_failure 'non-mixed route must not define portion mappings' \
  bash "$VALIDATOR" "$non_mixed_portion_root" "${non_mixed_portion_root}/execution-routes.tsv"

invalid_reasoning_root="${FIXTURE_ROOT}/invalid-reasoning"
make_single_command_fixture "$invalid_reasoning_root"
write_registry "${invalid_reasoning_root}/execution-routes.tsv" \
  $'one/one.command.md\tmixed\tcoder\tcoder\t-\t-'
expect_failure 'invalid reasoning mapping' \
  bash "$VALIDATOR" "$invalid_reasoning_root" "${invalid_reasoning_root}/execution-routes.tsv"

invalid_implementation_root="${FIXTURE_ROOT}/invalid-implementation"
make_single_command_fixture "$invalid_implementation_root"
write_registry "${invalid_implementation_root}/execution-routes.tsv" \
  $'one/one.command.md\tmixed\tdesigner-reviewer\tcommand-runner\t-\t-'
expect_failure 'invalid implementation mapping' \
  bash "$VALIDATOR" "$invalid_implementation_root" "${invalid_implementation_root}/execution-routes.tsv"

invalid_execution_root="${FIXTURE_ROOT}/invalid-execution"
make_single_command_fixture "$invalid_execution_root"
write_registry "${invalid_execution_root}/execution-routes.tsv" \
  $'one/one.command.md\tmixed\tdesigner-reviewer\t-\tcoder\t-'
expect_failure 'invalid execution mapping' \
  bash "$VALIDATOR" "$invalid_execution_root" "${invalid_execution_root}/execution-routes.tsv"

invalid_ui_root="${FIXTURE_ROOT}/invalid-ui"
make_single_command_fixture "$invalid_ui_root"
write_registry "${invalid_ui_root}/execution-routes.tsv" \
  $'one/one.command.md\tmixed\tdesigner-reviewer\t-\t-\tcommand-runner'
expect_failure 'invalid ui_acceptance mapping' \
  bash "$VALIDATOR" "$invalid_ui_root" "${invalid_ui_root}/execution-routes.tsv"

underspecified_mixed_root="${FIXTURE_ROOT}/underspecified-mixed"
make_single_command_fixture "$underspecified_mixed_root"
write_registry "${underspecified_mixed_root}/execution-routes.tsv" \
  $'one/one.command.md\tmixed\tdesigner-reviewer\t-\t-\t-'
expect_failure 'mixed route requires at least two explicit portions' \
  bash "$VALIDATOR" "$underspecified_mixed_root" "${underspecified_mixed_root}/execution-routes.tsv"

symlink_definition_root="${FIXTURE_ROOT}/symlink-definition"
mkdir -p "${symlink_definition_root}/one"
touch "${symlink_definition_root}/target.md"
ln -s ../target.md "${symlink_definition_root}/one/link.command.md"
write_registry "${symlink_definition_root}/execution-routes.tsv"
expect_failure 'symlinks are forbidden in the managed command root' \
  bash "$VALIDATOR" "$symlink_definition_root" "${symlink_definition_root}/execution-routes.tsv"

symlink_directory_root="${FIXTURE_ROOT}/symlink-directory"
mkdir -p "${symlink_directory_root}/real"
ln -s real "${symlink_directory_root}/linked"
write_registry "${symlink_directory_root}/execution-routes.tsv"
expect_failure 'symlinks are forbidden in the managed command root' \
  bash "$VALIDATOR" "$symlink_directory_root" "${symlink_directory_root}/execution-routes.tsv"

newline_root="${FIXTURE_ROOT}/newline"
mkdir -p "${newline_root}/one"
touch "${newline_root}/one/line"$'\n'"break.command.md"
write_registry "${newline_root}/execution-routes.tsv"
expect_failure 'managed command paths may not contain tab, CR, or newline' \
  bash "$VALIDATOR" "$newline_root" "${newline_root}/execution-routes.tsv"

tab_root="${FIXTURE_ROOT}/tab"
mkdir -p "${tab_root}/one"
touch "${tab_root}/one/tab"$'\t'"break.command.md"
write_registry "${tab_root}/execution-routes.tsv"
expect_failure 'managed command paths may not contain tab, CR, or newline' \
  bash "$VALIDATOR" "$tab_root" "${tab_root}/execution-routes.tsv"

cr_root="${FIXTURE_ROOT}/cr"
mkdir -p "${cr_root}/one"
touch "${cr_root}/one/carriage"$'\r'"return.command.md"
write_registry "${cr_root}/execution-routes.tsv"
expect_failure 'managed command paths may not contain tab, CR, or newline' \
  bash "$VALIDATOR" "$cr_root" "${cr_root}/execution-routes.tsv"

echo 'command execution routes validator fixtures: PASS'
