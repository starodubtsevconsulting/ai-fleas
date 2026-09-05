#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKFLOW="${ROOT_DIR}/ai-workflows/dev/dev.workflow.md"
COMPANION="${ROOT_DIR}/ai-workflows/dev/agents/team.md"
AGENTS_ROOT="${ROOT_DIR}/ai-workflows/dev/agents"
AGENTS_MANIFEST="${ROOT_DIR}/ai-workflows/dev/agents.yml"
COMMON_ROLES="${ROOT_DIR}/ai-workflows/_common/roles"
COMMON_JUDGE="${COMMON_ROLES}/judge.md"
COMMON_DEPENDENCY_TEMPLATE="${ROOT_DIR}/ai-workflows/_common/policy/dependencies.template.yml"
INITIALIZER="${AGENTS_ROOT}/init.md"
LIVE_TEST="${ROOT_DIR}/ai-workflows/dev/dev-live-test.md"
AGENTS_CONTRACT="${ROOT_DIR}/ai-workflows/agents.md"

fail() {
  echo "$1" >&2
  exit 1
}

test -r "${WORKFLOW}" || fail "Missing dev workflow"
test -r "${COMPANION}" || fail "Missing dev workflow agent companion"
test -r "${INITIALIZER}" || fail "Missing workflow agent initializer"
test -r "${LIVE_TEST}" || fail "Missing dev workflow live acceptance test"
test -r "${AGENTS_CONTRACT}" || fail "Missing common workflow agents contract"
test -r "${AGENTS_MANIFEST}" || fail "Missing Dev agent instantiation manifest"
test -r "${COMMON_JUDGE}" || fail "Missing common Judge role definition"
test -r "${COMMON_DEPENDENCY_TEMPLATE}" || fail "Missing common workflow dependency template"
test ! -e "${ROOT_DIR}/ai-workflows/common-workflow-agents.md" || fail "Common workflow agents must remain consolidated in agents.md"
test ! -e "${ROOT_DIR}/ai-commands/agents/agents.command.md" || fail "Agents must not be published as an AI command"
if rg -q 'common-workflow-agents|ai-commands/agents|agents\.command' "${ROOT_DIR}/ai-workflows" -g '*.md'; then
  fail "Workflow docs must use only the consolidated ai-workflows/agents.md contract"
fi
grep -Fq 'Workflow agents: [agents.md](../agents.md).' "${WORKFLOW}" || fail "Dev workflow must inherit common agents"
grep -Fq 'extends [`../../agents.md`](../../agents.md)' "${COMPANION}" || fail "Dev team must extend common agents"
grep -Fq 'exactly one persistent human-facing `Admin` infrastructure task' "${AGENTS_CONTRACT}" || fail "Common agents must require Admin"
grep -Fq 'persistent human-facing `Judge` oversight role' "${AGENTS_CONTRACT}" || fail "Common agents must require Judge"
grep -Fq 'The workflow-owned initialization entrypoint verifies or bootstraps Admin' "${AGENTS_CONTRACT}" || fail "Common agents must own initialization"
grep -Fq 'Visible agent team: [team.md](agents/team.md).' "${WORKFLOW}" || fail "Dev workflow does not link its agent team manifest"
grep -Fq 'Agent instantiation: [agents.yml](agents.yml).' "${WORKFLOW}" || fail "Dev workflow does not link agents.yml"
grep -Fq 'Team capability, communication, and lifecycle policy: [team.md](agents/team.md).' "${WORKFLOW}" \
  || fail "Dev workflow does not link its Team policy"
grep -Fq 'authority: agents/team.md' "${AGENTS_MANIFEST}" \
  || fail "Dev agents.yml must reference the authoritative Team policy"
grep -Fq 'dependencies:' "${AGENTS_MANIFEST}" || fail "Dev agents.yml must declare capability-bound dependencies"
grep -Fq 'requirement: capability-bound' "${AGENTS_MANIFEST}" \
  || fail "Dev dependencies must not become role-existence dependencies"
test ! -e "${AGENTS_ROOT}/role-capability-matrix.md" || fail "Dev must not duplicate Team policy in a role matrix"
test ! -e "${AGENTS_ROOT}/role-capability-ownership.csv" || fail "Dev must not duplicate Team capability ownership"
test ! -e "${AGENTS_ROOT}/role-communication-matrix.csv" || fail "Dev must not duplicate Team communication policy"
grep -Fqx 'Logical project ID: `<profile-id>-<workflow-id>`' "${COMPANION}" || fail "Dev team manifest must declare the derived logical project"
grep -Fq 'Profile prerequisite: explicit profile/logical-project scope' "${COMPANION}" || fail "Dev team manifest must require one resolved scope"
grep -Fq 'Project sources: one or more runtime-bound folders' "${COMPANION}" || fail "Dev team manifest must define runtime-bound project sources"
grep -Fq 'Runtime projection: adapter-specific' "${COMPANION}" || fail "Dev team manifest must keep logical projects runtime-agnostic"
grep -Fqx 'Workflow: `dev`' "${COMPANION}" || fail "Dev companion workflow mismatch"
grep -Fqx "Harness: resolved from the selected profile's exact \`workflows[]\` entry; this reusable team declares none." "${COMPANION}" \
  || fail "Dev companion must defer the harness to the selected profile"
if rg -q '^harness:' "${AGENTS_MANIFEST}"; then
  fail "Reusable Dev agents.yml must not hardcode a harness"
fi
grep -Fq '[workflow agent initialization](agents/init.md)' "${WORKFLOW}" || fail "Dev workflow does not link its initializer"
grep -Fq 'for this workflow the base result is' "${INITIALIZER}" || fail "Initializer must document profile/workflow project naming"
grep -Fq '`<profile-id>-dev-<instance-id>`' "${INITIALIZER}" || fail "Initializer must document isolated logical project instances"
grep -Fq 'runtime identity is already bound to exactly one validated logical project' "${INITIALIZER}" || fail "Initializer must support one verified bound scope"
grep -Fq 'Initialize <profile-id>-dev workflow agents' "${WORKFLOW}" || fail "Dev workflow must expose profile-agnostic lifecycle helper prompts"
grep -Fq "Initialization never creates, renames, or changes the runtime's project container." "${INITIALIZER}" || fail "Initializer must treat the runtime project projection as a prerequisite"
tr '\n' ' ' < "${INITIALIZER}" | grep -Fq 'The runtime-bound folders are the authoritative project sources' || fail "Initializer must use runtime-bound folders as sources"
grep -Fq 'declares `projects`' "${INITIALIZER}" || fail "Initializer must recognize configured workspace projects"
grep -Fq 'requires set equality' "${INITIALIZER}" || fail "Initializer must enforce configured project equality"
grep -Fq 'runtimeProjectionVerifiedBy: initializer' "${INITIALIZER}" || fail "Initializer must pass verified source projection evidence to roles"
grep -Fq 'must not re-query a reduced per-task' "${INITIALIZER}" || fail "Roles must not confuse a reduced task API with the saved project projection"
grep -Fq 'optional `knowledge` list' "${INITIALIZER}" || fail "Initializer must support profile-owned per-project knowledge"
grep -Fq 'supplements but never overrides repository-local instructions' "${INITIALIZER}" || fail "Profile knowledge precedence must be explicit"
grep -Fq 'must never be registered, advertised, or routed as a command' "${INITIALIZER}" || fail "Project knowledge must remain distinct from commands"
grep -Fq '`trackerContext` contains the' "${INITIALIZER}" || fail "Initializer must embed resolved provider-neutral tracker context"
grep -Fq 'optional execution binding' "${INITIALIZER}" || fail "Initializer must embed profile-resolved tracker execution binding"
grep -Fq 'complete fallback `execution` binding' "${COMMON_ROLES}/manager.md" || fail "Manager must use only the profile-resolved fallback execution binding"
grep -Fq '## Approval-free tracker lifecycle' "${COMMON_ROLES}/manager.md" || fail "Manager must make configured tracker work approval-free"
grep -Fq '## Packet interpretation cases' "${COMMON_ROLES}/manager.md" || fail "Packet-only Manager must document representative cases"
grep -Fq 'never reply that there is nothing to do merely because the first match is Done' "${COMMON_ROLES}/manager.md" || fail "Manager must not terminate next-stage lookup on a completed first match"
grep -Fq '`BLOCKED_TRACKER_RUNTIME_NOT_ATTACHED`' "${COMMON_ROLES}/manager.md" || fail "Manager must distinguish missing runtime attachment"
grep -Fq 'platform-generated connector authorization' "${COMMON_ROLES}/manager.md" || fail "Manager must distinguish connector authorization from workflow approval"
grep -Fq '`WAITING_ON_APPROVAL`' "${COMMON_ROLES}/designer-reviewer.md" || fail "Designer must recognize pending Manager approval"
grep -Fq 'must not tell the human that the' "${COMMON_ROLES}/designer-reviewer.md" || fail "Designer must not report pending Manager approval as tracker failure"
grep -Fq 'configured provider name alone is not runtime capability evidence' "${INITIALIZER}" || fail "Initialization must verify Manager tracker runtime attachment"
grep -Fq 'pending connector grant is' "${INITIALIZER}" || fail "Initialization must not mistake pending connector authorization for a missing binding"
grep -Fq '## Profile-resolved tracker command wiring' "${COMMON_ROLES}/manager.md" || fail "Manager must define tracker command wiring"
grep -Fq 'copies the validated overrides unchanged' "${COMMON_ROLES}/manager.md" || fail "Manager must forward resolved command overrides"
grep -Fq 'An inventory row is discovery evidence' "${COMMON_ROLES}/manager.md" || fail "Manager must exact-read inventory tickets"
grep -Fq 'must not stop at the first strong text match' "${COMMON_ROLES}/manager.md" || fail "Manager must compare next-stage ticket candidates"
grep -Fq "must not return only the first candidate's lifecycle blocker" "${COMMON_ROLES}/manager.md" || fail "Manager must not let a conflicted predecessor mask active work"
grep -Fq '## Read-only lookup must not demand proof' "${COMMON_ROLES}/manager.md" || fail "Manager must not demand proof for ticket lookup"
grep -Fq 'missing closure proof must not block ticket lookup' "${COMMON_ROLES}/manager.md" || fail "Manager must separate lookup from closure evidence"
grep -Fq '| Request ticket from Manager | AUTHORIZED | PROHIBITED | RECEIVE_AND_RESPOND' "${COMPANION}" || fail "Every initialized Worker must be able to request tickets from Manager"
grep -Fq 'valid same-project worker packet is sufficient workflow authority' "${COMPANION}" || fail "Manager must not add a human approval gate to worker ticket requests"
grep -Fq '`trackerContext.actor`' "${COMMON_ROLES}/manager.md" || fail "Manager must resolve user-scoped tracker actor"
grep -Fq '## Completion-report ticket reconciliation' "${COMMON_ROLES}/manager.md" || fail "Manager must reconcile completion reports"
grep -Fq '## Human-authored rule seed gate' "${COMMON_JUDGE}" || fail "Judge must declare the human rule seed gate"
grep -Fq 'Judge never writes the initial meaning of a rule' "${COMMON_JUDGE}" \
  || fail "Judge must not originate rule meaning"
grep -Fq 'git diff HEAD -- <exact-human-identified-markdown-path>' "${COMMON_JUDGE}" \
  || fail "Judge must verify staged and unstaged human seed changes against HEAD"
grep -Fq '**Prompt case: human-seeded rule maintenance**' "${COMMON_JUDGE}" \
  || fail "Judge must map the human-seeded rule maintenance prompt case"
grep -Fq '`BLOCKED_HUMAN_RULE_SEED_REQUIRED`' "${COMMON_JUDGE}" \
  || fail "Judge must require a human-authored Markdown seed"
grep -Fq '`BLOCKED_JUDGE_RULE_SEMANTIC_DEVIATION`' "${COMMON_JUDGE}" \
  || fail "Judge must block semantic deviation"
grep -Fq '"Apply this rule to the Team policy."' "${COMMON_JUDGE}" \
  || fail "Judge must support bounded human-named Team-policy projection"
grep -Fq '`BLOCKED_JUDGE_RULE_PROJECTION_FAMILY_REQUIRED`' "${COMMON_JUDGE}" \
  || fail "Judge must block unresolved or unnamed projection families"
grep -Fq '`BLOCKED_JUDGE_RULE_SCOPE_EXPANSION`' "${COMMON_JUDGE}" \
  || fail "Judge must block propagation outside the human-authored rule scope"
grep -Fq '`BLOCKED_JUDGE_RULE_PROJECTION_AMBIGUITY`' "${COMMON_JUDGE}" \
  || fail "Judge must stop when a mechanical representation is ambiguous"
grep -Fq '**Prompt case: in-scope representation synchronization**' "${COMMON_JUDGE}" \
  || fail "Judge must map the in-scope mechanical synchronization prompt case"
grep -Fq '| Initial protected rule meaning or semantic policy choice | PROHIBITED | PROHIBITED | PROHIBITED | PROHIBITED | PROHIBITED | PROHIBITED | PROHIBITED |' \
  "${COMPANION}" || fail "Every AI Agent must be prohibited from initial rule authorship"
grep -Fq 'human decides whether to author a Markdown rule seed' "${COMMON_ROLES}/designer-reviewer.md" \
  || fail "Designer/Reviewer must route governance gaps only to the human"
grep -Fq 'factual governance gap only through their exact authorized route to Designer/Reviewer' \
  "${AGENTS_ROOT}/shared-execution-routing.md" || fail "Internal roles must not claim direct human governance dialogue"
grep -Fq 'never impersonates the human or messages a participant task' "${LIVE_TEST}" \
  || fail "Live acceptance must preserve the Judge communication firewall"
if rg -q 'Judge simulates the human|send one bounded proposal to Judge|reports or authors only bounded protected|governance-advisory' \
  "${LIVE_TEST}" "${AGENTS_ROOT}" -g '*.md'; then
  fail "Workflow contracts contain a bypass of the human-authored rule seed gate"
fi
grep -Fq 'configured tracker during the same lifecycle turn' "${COMMON_ROLES}/manager.md" || fail "Manager must not leave verified completion reports unreconciled"
grep -Fq 'fresh provider receipt proving the resulting status' "${COMMON_ROLES}/manager.md" || fail "Manager must verify a completion-state mutation"
grep -Fq 'it does not choose the provider, infer a URL' "${COMMON_ROLES}/manager.md" || fail "Command Runner must not reconstruct profile context"
grep -Fq 'After every Team-declared task-creation call returns, Admin constructs one exact' "${INITIALIZER}" || fail "Initializer must bind authorized Agent identities after concurrent creation"
grep -Fq '`BLOCKED_INITIALIZATION_CONTEXT`' "${INITIALIZER}" || fail "Initializer must block incomplete standard context"
grep -Fq 'configuration files are provenance and never substitute for resolved values' "${INITIALIZER}" || fail "Initializer must not substitute config paths for resolved context"
grep -Fq '`reinitialize agents` performs the transactional Admin successor handoff only when the human explicitly includes Admin;' "${INITIALIZER}" || fail "Initializer must define optional transactional Admin replacement"
grep -Fq "Manager is the default lifecycle executor" "${INITIALIZER}" || fail "Manager must own governed-roster lifecycle by default"
grep -Fq "separate explicit human" "${INITIALIZER}" || fail "Direct Admin lifecycle bypass must require separate exact human confirmation"
grep -Fq "Admin to create and canonically initialize" "${INITIALIZER}" || fail "Admin must be limited to missing-Manager bootstrap"
grep -Fq '`delete all agents`, `remove all agents`' "${INITIALIZER}" || fail "Delete/remove must safely alias archive"
grep -Fq 'initialization never hard-deletes a task or its history' "${INITIALIZER}" || fail "Initializer must preserve archived task history"
grep -Fq 'Phase one is passive contract loading inside the task that Admin already created.' "${INITIALIZER}" || fail "Initialization must be passive"
grep -Fq 'or approval-' "${INITIALIZER}" || fail "Initialization must prohibit approval-gated tools"
grep -Fq '`BLOCKED_RECURSIVE_INITIALIZATION`' "${INITIALIZER}" || fail "Initialization must block recursive task creation"
tr '\n' ' ' < "${INITIALIZER}" | grep -Fq 'The initializer—not the role—verifies that the task-creation request and platform receipt use the manifest' || fail "Initializer must own model/reasoning verification"
grep -Fiq 'this is title/project reconciliation, not role replacement' "${INITIALIZER}" || fail "Initializer must safely reconcile adapter-derived titles"
grep -Fq 'MUST explicitly set that freshly returned exact task ID' "${INITIALIZER}" || fail "Initializer must reconcile every created title"
grep -Fq 'read back both the title and actual runtime project ID independently' "${INITIALIZER}" || fail "Admin must verify title readback"
grep -Fq 'actual runtime project ID' "${INITIALIZER}" || fail "Initializer must verify created-task project binding"
grep -Fq 'actual `projectId`' "${INITIALIZER}" || fail "Admin must verify created-task project ID"
if rg -q -i 'jira|coresvcs|trello|linear' "${COMMON_ROLES}/manager.md" "${AGENTS_ROOT}/init.md" "${AGENTS_ROOT}/workflow-agent-initializer.md" "${AGENTS_ROOT}/shared-execution-routing.md"; then
  fail "Reusable Dev workflow contracts must not hardcode a tracker provider or container"
fi
grep -Fq '`codex-local-shared-workspace` is allowed only when the runtime is the Codex desktop application' "${AGENTS_ROOT}/init.md" || fail "Codex desktop initialization must verify shared local sources"
grep -Fq '`codex-local-shared-workspace` is allowed only when the runtime is the Codex desktop application' "${INITIALIZER}" || fail "Admin must select the Codex local initialization transport"
grep -Fq 'An initialized team belongs to one logical agent project named' "${AGENTS_CONTRACT}" || fail "Agents contract must define the logical workflow project"
grep -Fq 'Repository and folder coordinates scope the current work' "${AGENTS_CONTRACT}" || fail "Agents contract must separate team scope from work target scope"
grep -Fq 'exact nonempty `profileId`, `workflowId`, `logicalProjectId`, and `runtimeProjectId`' "${AGENTS_CONTRACT}" || fail "Agents contract must require the complete peer communication coordinate header"
grep -Fq 'Cross-profile, cross-workflow, cross-logical-project, and' "${AGENTS_CONTRACT}" || fail "Agents contract must prohibit every cross-boundary communication route"
grep -Fq 'packet coordinates with trusted sender,' "${AGENTS_CONTRACT}" || fail "Agents contract must verify the packet sender against trusted identity"
grep -Fq 'recipient, and return-task initialization headers' "${AGENTS_CONTRACT}" || fail "Agents contract must verify packet recipient and return-task identities"
grep -Fq '`BLOCKED_PROFILE_BOUNDARY` with zero' "${AGENTS_CONTRACT}" || fail "Agents contract must reject boundary mismatches before payload work"
test ! -d "${AGENTS_ROOT}/roles" || fail "Workflow agent contracts must not use a nested roles directory"
test ! -d "${AGENTS_ROOT}/project-contexts" || fail "Workflow agents must not contain project-specific context fixtures"
grep -Fq 'Admin display label: `🔑 Admin`' "${COMPANION}" || fail "Dev companion must declare persistent Admin"
grep -Fq 'authorized executor creates every' "${COMPANION}" || fail "Dev companion must derive Manager-default concurrent roster creation"
grep -Fq 'agent declared by `../agents.yml` concurrently' "${COMPANION}" || fail "Dev companion must derive roster membership from agents.yml"
grep -Fq 'presentation-only and is not an initialization gate' "${COMPANION}" || fail "Sidebar ordering must not gate initialization"
grep -Fq '`../../_common/roles/judge.md`' "${COMPANION}" || fail "Dev Judge declaration must use the common role"
grep -Fq '## Common Judge role instantiation' "${COMPANION}" || fail "Dev team must define Judge instantiation"
grep -Fq '`ai-workflows/_common/roles/judge.md`' "${INITIALIZER}" || fail "Initializer must resolve the common Judge role"
grep -Fq 'profile-only or' "${INITIALIZER}" || fail "Initializer must reject profile-only Judge locations"
grep -Fq 'projectless Judge task' "${INITIALIZER}" || fail "Initializer must reject projectless Judge locations"
grep -Fq 'declaration-resolved source payload' "${INITIALIZER}" || fail "Initializer must compose all declared sources"
grep -Fq '`judgeInstanceBinding`' "${AGENTS_ROOT}/workflow-agent-initializer.md" \
  || fail "Admin initializer must embed the Judge instance binding"
if rg -q '<profile-id>-dev|ai-workflows/dev/agents/visible-role-routing' \
  "${COMMON_JUDGE}"; then
  fail "Common Judge role must not hardcode a Dev instance"
fi
grep -Fq 'tracker.acceptanceFixtures.managerFirstLiveTest' "${LIVE_TEST}" || fail "Live test must resolve the profile-provided persistent fixture"
grep -Fq '<configured-manager-first-live-test-fixture-url>' "${LIVE_TEST}" || fail "Live test must use the configured fixture URL"
grep -Fq 'Designer/Reviewer asks the human to provide a ticket ID instead of messaging Manager.' "${LIVE_TEST}" || fail "Live test must cover Manager-first regression"
grep -Fq 'Run each case in a clean `💬 Designer Reviewer` context.' "${LIVE_TEST}" || fail "Live cases must require clean independent Agent context"
grep -Fq 'explicit human instruction to' "${LIVE_TEST}" || fail "Live cases must permit an explicit human proceed exception"

expected_rows=(
  '| `designer / reviewer`  | `Designer Reviewer`       | `Worker`  | `💬 Designer Reviewer`'
  '| `judge`                | `Judge`                   | `Judge`   | `⚖️ Judge`'
  '| `manager`              | `Manager`                 | `Manager` | `🤖 Manager`'
  '| `coder`                | `Coder`                   | `Worker`  | `🔀 Coder`'
  '| `command-runner`       | `Command Runner`          | `Worker`  | `⚙️ Command Runner`'
  '| `ui-acceptance-tester` | `UI Acceptance Tester`    | `Worker`  | `🖥️ UI Acceptance Tester`'
  '| `proxy-coder`          | `Proxy Coder`             | `Worker`  | `🧠 Proxy Coder`'
)
for row in "${expected_rows[@]}"; do
  grep -Fq "${row}" "${COMPANION}" || fail "Missing or mismatched dev role row: ${row}"
done

role_rows="$(awk '/^## Governed agents$/{inside=1;next} inside && /^## /{exit} inside && /^\| `/{count++} END{print count+0}' "${COMPANION}")"
test "${role_rows}" -gt 0 || fail "Dev companion must declare at least one active role"
grep -F '`proxy-coder` is a Worker Agent ID with structured `execution.mode: proxy`, not a separate Role.' "${COMPANION}" >/dev/null \
  || fail "Dev companion must include Proxy Coder in ordinary initialization"
grep -F 'delegation capability remains unroutable until Ticket #57 Gate 1' "${COMPANION}" >/dev/null \
  || fail "Dev companion must gate proxy-coder delegation"

while IFS= read -r role_definition; do
  role_definition="${role_definition#\`}"; role_definition="${role_definition%\`}"
  resolved="$(cd "$(dirname "${COMPANION}")" && realpath "${role_definition}")"
  case "${resolved}" in
    "${COMMON_ROLES}/"*.md) ;;
    *) fail "Role definition escapes the common role root: ${role_definition}" ;;
  esac
  test -r "${resolved}" || fail "Unreadable common role definition: ${resolved}"
done < <(awk -F'|' '/^\| `/{value=$11; gsub(/^[[:space:]]+|[[:space:]]+$/, "", value); print value}' "${COMPANION}")

grep -Fq '## Agent binding' "${WORKFLOW}" || fail "Dev workflow must own common-role binding"
! grep -Fq 'workflowBinding:' "${AGENTS_MANIFEST}" || fail "Dev agents.yml must select common roles directly"
! find "${AGENTS_ROOT}" -maxdepth 1 -type f \( -name 'admin.md' -o -name 'designer-reviewer.md' -o -name 'judge.md' -o -name 'manager.md' -o -name 'coder.md' -o -name 'command-runner.md' -o -name 'ui-acceptance-tester.md' -o -name 'proxy-coder.md' \) | grep -q . \
  || fail "Dev must not retain per-role workflow binding files"

echo 'workflow agent companion: PASS'
