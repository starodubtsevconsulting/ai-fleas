#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
COMMANDS_ROOT=$(cd "$SCRIPT_DIR/.." && pwd -P)
export AI_PROFILE_FILE="$(cd "$COMMANDS_ROOT/.." && pwd -P)/ai-profile/example/example-work-profile.yml"
export AI_WORK_PROFILE_ID=example AI_FLOW_WORKFLOW=dev.workflow.md AI_COMMANDS_ROOT="$COMMANDS_ROOT"
TEST_DIR=$(mktemp -d "${TMPDIR:-/tmp}/jira-command-test.XXXXXX")
trap 'rm -rf "$TEST_DIR"' EXIT
printf '%s\n' 'Profile-owned Jira description template' >"$TEST_DIR/profile-template.txt"
export JIRA_COMMAND_CONF="$TEST_DIR/missing-command.conf"
export JIRA_DESCRIPTION_TEMPLATE_FILE="$TEST_DIR/profile-template.txt"

COMMAND_DOC="$SCRIPT_DIR/jira.command.md"
test -r "$SCRIPT_DIR/spec.md"
test -r "$SCRIPT_DIR/jira.scenario.md"
grep -Fq 'JIRA_READ_SCENARIO_READY' "$SCRIPT_DIR/jira.scenario.md"
grep -Fq 'Inventory row text is' "$SCRIPT_DIR/jira.scenario.md"
grep -Fq '## Configuration source and precedence' "$COMMAND_DOC"
grep -Fq 'active profile/project configuration is the canonical source' "$COMMAND_DOC"
grep -Fq 'Generic fail-closed placeholders' "$COMMAND_DOC"
grep -Fq '### Declared profile override placeholders' "$COMMAND_DOC"
grep -Fq '`tracker.execution.command_env_overrides`' "$COMMAND_DOC"
grep -Fq 'Canonical organization/project values belong in' "$SCRIPT_DIR/jira.command.example.config"
grep -Fq 'loader preserves any profile-resolved organization setting' "$COMMAND_DOC"
required_guardrails=(
  '^## Mandatory operational route$'
  '`command-runner` is the Jira execution role'
  'must discover and follow this'
  'document and invoke the matching `\${AI_COMMANDS_ROOT}/jira/jira\.command\.sh`'
  '`manager` owns Jira/tracker'
  'Designer/Reviewer routes every Jira'
  'intent—including read-only ticket inspection—to Manager'
  'A Jira key used as task context is not mutation'
  'naming a Codex role'
  'never means creating or assigning Jira work'
  'Direct browser interaction is not'
  'a substitute for this command flow'
  '`\${AI_COMMANDS_ROOT}/jira/jira\.command\.sh sync-plan`'
  'active external'
  '`session-plan\.md` or an explicit `--session-plan FILE`'
  'Pass `--submit` only'
  'after the user explicitly authorizes the Jira write'
  'Manager supplies the'
  'issue/session-plan inputs and authorization state; command-runner owns the'
  'command and browser mechanics'
  '`\${AI_COMMANDS_ROOT}/jira/jira\.command\.sh update ISSUE-KEY`'
  'description and optional `--summary`; pass `--submit` only after explicit'
  'user authorization'
  'existing authenticated visible-Chrome automation model'
  'Do not'
  'introduce Jira REST APIs, GraphQL, MCP, or other direct Jira access'
)

for pattern in "${required_guardrails[@]}"; do
  grep -Eq "$pattern" "$COMMAND_DOC" || {
    echo "Missing Jira operational guardrail: $pattern" >&2
    exit 1
  }
done

cat >"$TEST_DIR/local-precedence.conf" <<'CONF'
JIRA_BASE_URL="https://local.invalid"
JIRA_BROWSER_USER_DATA_DIR="/machine/browser-profile"
CONF
export JIRA_BASE_URL="https://profile.example.invalid"
unset JIRA_BROWSER_USER_DATA_DIR
source "$SCRIPT_DIR/jira-load-config.sh"
jira_load_machine_config "$TEST_DIR/local-precedence.conf"
[[ "$JIRA_BASE_URL" == "https://profile.example.invalid" ]] || {
  echo "Machine config must not override profile-resolved Jira URL" >&2
  exit 1
}
[[ "$JIRA_BROWSER_USER_DATA_DIR" == "/machine/browser-profile" ]] || {
  echo "Machine config should supply machine-only browser settings" >&2
  exit 1
}

for setting in JIRA_BASE_URL JIRA_BROWSE_BASE_URL JIRA_ISSUE_KEY_PATTERN JIRA_STORY_POINTS_FIELD_ID JIRA_BROWSER_MODE JIRA_CURRENT_SPRINT_BOARD_URL AI_CONFIG_REPO_URL AI_CONFIG_JIRA_COMMAND_URL; do
  if ! grep -q "^${setting}=" "$SCRIPT_DIR/jira.command.example.config"; then
    echo "Expected Jira example config setting: $setting" >&2
    exit 1
  fi
done

grep -Fq 'JIRA_STORY_POINTS_FIELD_ID="customfield_10132"' "$SCRIPT_DIR/jira.command.example.config"
grep -Fq 'window.__jiraAiFindStoryPoints = (fieldId) =>' "$SCRIPT_DIR/jira-existing-chrome.mjs"
grep -Fq "label.textContent.trim().replace(/\\\\s*\\\\*$/, '') === 'Story Points'" "$SCRIPT_DIR/jira-existing-chrome.mjs"
grep -Fq 'JIRA_BROWSER_JAVASCRIPT_ERROR:' "$SCRIPT_DIR/jira-existing-chrome.mjs"
grep -Fq 'JIRA_BROWSER_JAVASCRIPT_NO_RESULT:' "$SCRIPT_DIR/jira-existing-chrome.mjs"
grep -Fq "Jira issue page did not finish loading before the comment action" "$SCRIPT_DIR/jira-comment.mjs"
grep -Fq "document.readyState === 'complete' && document.body" "$SCRIPT_DIR/jira-comment.mjs"
grep -Fq "source: 'redirected-issue'" "$SCRIPT_DIR/jira-ticket-search.mjs"
grep -Fq "encoded === 'missing value'" "$SCRIPT_DIR/jira-ticket-search.mjs"
grep -Fq 'Jira search did not produce a completed result set before the action timeout' "$SCRIPT_DIR/jira-ticket-search.mjs"
grep -Fq "description: section('Description', 'Smart Checklist')" "$SCRIPT_DIR/jira-ticket-read.mjs"
grep -Fq "assignee: field('Assignee')" "$SCRIPT_DIR/jira-ticket-read.mjs"
grep -Fq 'authenticatedUser:' "$SCRIPT_DIR/jira-ticket-read.mjs"
grep -Fq "sourceMode = boardUrl ? 'configured-board'" "$SCRIPT_DIR/jira-list-by-status.mjs"
grep -Fq 'Configured Jira board did not expose a readable' "$SCRIPT_DIR/jira-list-by-status.mjs"
grep -Fq 'labelUsedForIdentity: false' "$SCRIPT_DIR/jira-ticket-search.mjs"
grep -Fq 'summaryMatchedClientSide: true' "$SCRIPT_DIR/jira-ticket-search.mjs"
if grep -Fq 'summary ~' "$SCRIPT_DIR/jira-ticket-search.mjs"; then
  echo "Jira deduplication must exact-match rendered recent rows instead of relying on fuzzy JQL summary syntax" >&2
  exit 1
fi
if grep -Fq 'AND labels =' "$SCRIPT_DIR/jira-ticket-search.mjs"; then
  echo "Jira deduplication search must not require an unreliable create-form label" >&2
  exit 1
fi

"$SCRIPT_DIR/jira.command.sh" template >"$TEST_DIR/jira-description.md"
"$SCRIPT_DIR/jira.command.sh" current-sprint >"$TEST_DIR/current-sprint.txt"
grep -Fq 'JIRA_CURRENT_SPRINT_BOARD_URL:' "$TEST_DIR/current-sprint.txt"
grep -Fxq 'Profile-owned Jira description template' "$TEST_DIR/jira-description.md"
printf '%s\n' 'A profile-approved ticket description.' >"$TEST_DIR/rendered-description.md"
if "$SCRIPT_DIR/jira.command.sh" template --project EXAMPLE >/dev/null 2>&1; then
  echo "Expected --template combined with Jira creation arguments to fail" >&2
  exit 1
fi

"$SCRIPT_DIR/jira.command.sh" \
  create \
  --output-dir "$TEST_DIR/flags" \
  --project EXAMPLE \
  --issue-type Task \
  --summary "[Example Service]: Versioned selector search" \
  --description-file "$TEST_DIR/rendered-description.md" \
  --label selectors \
  --validate-only >/dev/null

node -e '
  const result = require(process.argv[1]);
  if (result.status !== "validated") throw new Error("expected validated status");
  if (result.ticket.project !== "EXAMPLE") throw new Error("project was not normalized");
  if (result.ticket.labels[0] !== "selectors") throw new Error("label was not preserved");
' "$TEST_DIR/flags/jira-ticket-result.json"

"$SCRIPT_DIR/jira.command.sh" \
  clone example-8316 \
  --output-dir "$TEST_DIR/clone" \
  --summary "[Example Service]: Published version selector search" \
  --description-file "$TEST_DIR/rendered-description.md" \
  --story-points 1 \
  --validate-only >/dev/null

node -e '
  const result = require(process.argv[1]);
  if (result.ticket.cloneFrom !== "EXAMPLE-8316") throw new Error("clone source was not normalized");
  if (result.ticket.project !== "EXAMPLE") throw new Error("project was not inferred from clone source");
  if (result.ticket.storyPoints !== "1") throw new Error("story points were not normalized");
' "$TEST_DIR/clone/jira-ticket-result.json"

if "$SCRIPT_DIR/jira.command.sh" clone EXAMPLE-8316 \
  --output-dir "$TEST_DIR/invalid-story-points" \
  --summary "[Example Service]: Invalid estimate" \
  --description-file "$TEST_DIR/rendered-description.md" \
  --story-points many \
  --validate-only >/dev/null 2>&1; then
  echo "Expected non-numeric Jira story points to fail validation" >&2
  exit 1
fi

"$SCRIPT_DIR/jira.command.sh" \
  update example-8336 \
  --output-dir "$TEST_DIR/update" \
  --description-file "$TEST_DIR/rendered-description.md" \
  --validate-only >/dev/null

node -e '
  const result = require(process.argv[1]);
  if (result.ticket.updateIssue !== "EXAMPLE-8336") throw new Error("update issue was not normalized");
  if (result.ticket.project !== "EXAMPLE") throw new Error("update project was not inferred");
' "$TEST_DIR/update/jira-ticket-result.json"

node --input-type=module -e '
  const { buildUpdateAttributionComment, compareJiraUpdate } = await import(`${process.env.AI_COMMANDS_ROOT}/jira/jira-update-audit.mjs`);
  const before = { summary: "Old summary", description: "Old description", editableFields: { priority: "2", assignee: "example-user" } };
  const after = { summary: "New summary", description: "New description", editableFields: { priority: "2", assignee: "example-user" } };
  const audit = compareJiraUpdate({ before, after, ticket: { summary: "New summary", description: "New description" } });
  if (!audit.verified) throw new Error("expected intended Jira update to verify");
  const unsafe = compareJiraUpdate({ before, after: { ...after, editableFields: { priority: "1", assignee: "example-user" } }, ticket: { summary: "New summary", description: "New description" } });
  if (unsafe.verified || !unsafe.unexpectedChangedFields.includes("priority")) throw new Error("expected unrelated field change to fail verification");
  const comment = buildUpdateAttributionComment({ timestamp: "2026-07-31T19:00:00.000Z", repoUrl: "https://github.example.invalid/example-org/ai-config", commandUrl: "https://github.example.invalid/example-org/ai-config/tree/main/ai-commands/jira" });
  if (!comment.includes("2026-07-31T19:00:00.000Z")) throw new Error("attribution timestamp missing");
  if (!comment.includes("[ai-config repository|https://github.example.invalid/example-org/ai-config]")) throw new Error("repository link missing");
  if (!comment.includes("[ai-config Jira command|https://github.example.invalid/example-org/ai-config/tree/main/ai-commands/jira]")) throw new Error("command link missing");
  if (!comment.includes("/created-with-ai-config")) throw new Error("ownership marker missing");
'

node --input-type=module -e '
  const { buildCreatedIssueMarkerComment, verifyAiConfigIssueOwnership } = await import(`${process.env.AI_COMMANDS_ROOT}/jira/jira-issue-ownership.mjs`);
  const currentUser = "example-user";
  if (!verifyAiConfigIssueOwnership({ currentUser, reporter: currentUser, comments: [] }).owned) throw new Error("current reporter should own ticket");
  if (!verifyAiConfigIssueOwnership({ currentUser, reporter: "other", comments: [{ author: currentUser, text: "created /created-with-ai-config" }] }).owned) throw new Error("owned marker comment should prove ownership");
  if (verifyAiConfigIssueOwnership({ currentUser, reporter: "other", comments: [{ author: "other", text: "created /created-with-ai-config" }] }).owned) throw new Error("foreign marker comment must not prove ownership");
  const marker = buildCreatedIssueMarkerComment({ timestamp: "2026-08-07T17:30:00.000Z", repoUrl: "https://github.example.invalid/example-org/ai-config", commandUrl: "https://github.example.invalid/example-org/ai-config/tree/main/ai-commands/jira" });
  if (!marker.includes("/created-with-ai-config")) throw new Error("created issue marker missing");
'

"$SCRIPT_DIR/jira.command.sh" set-in-progress EXAMPLE-8399 \
  --output-dir "$TEST_DIR/set-in-progress" \
  --validate-only >/dev/null
node -e '
  const result = require(process.argv[1]);
  if (result.status !== "validated") throw new Error("expected set-in-progress validation");
  if (result.issueKey !== "EXAMPLE-8399") throw new Error("issue key was not normalized");
  if (result.targetStatus !== "In Progress") throw new Error("unexpected transition target");
' "$TEST_DIR/set-in-progress/jira-set-in-progress-result.json"

"$SCRIPT_DIR/jira.command.sh" delete-owned-comment EXAMPLE-8336 \
  --comment-id 12345678 \
  --output-dir "$TEST_DIR/delete-owned-comment" \
  --validate-only >/dev/null

node -e '
  const result = require(process.argv[1]);
  if (result.status !== "validated") throw new Error("expected guarded deletion validation");
  if (result.requiredMarker !== "/created-with-ai-config") throw new Error("expected ai-config ownership marker");
' "$TEST_DIR/delete-owned-comment/jira-delete-comment-result.json"

node --input-type=module -e '
  const { verifyAiConfigCommentOwnership } = await import(`${process.env.AI_COMMANDS_ROOT}/jira/jira-comment-ownership.mjs`);
  if (!verifyAiConfigCommentOwnership({ author: "example-user", currentUser: "example-user", text: "done /created-with-ai-config" }).owned) throw new Error("marked current-user comment should be owned");
  if (verifyAiConfigCommentOwnership({ author: "other", currentUser: "example-user", text: "done /created-with-ai-config" }).owned) throw new Error("foreign comment must not be owned");
  if (verifyAiConfigCommentOwnership({ author: "example-user", currentUser: "example-user", text: "ordinary comment" }).owned) throw new Error("unmarked comment must not be owned");
'

cat >"$TEST_DIR/session-plan.md" <<'PLAN'
# EXAMPLE-8336 plan

- [x] Inspect repository conventions
- [ ] Implement Smart Checklist synchronization
- [X] Validate checkbox status mapping
PLAN

"$SCRIPT_DIR/jira.command.sh" \
  sync-plan \
  --session-plan "$TEST_DIR/session-plan.md" \
  --output-dir "$TEST_DIR/sync-plan" \
  --validate-only >/dev/null

node -e '
  const result = require(process.argv[1]);
  if (result.status !== "validated") throw new Error("expected validated sync status");
  if (result.issueKey !== "EXAMPLE-8336") throw new Error("issue key was not inferred from the plan");
  if (result.checklistItems.length !== 3) throw new Error("expected all plan checkboxes");
  const expected = [true, false, true];
  result.checklistItems.forEach((item, index) => {
    if (item.completed !== expected[index]) throw new Error(`unexpected status at index ${index}`);
  });
  if (result.managedChecklist[0] !== "# AI Flow Plan (managed by ai-config)") throw new Error("missing managed start marker");
  if (!result.managedChecklist.includes("+ Inspect repository conventions")) throw new Error("completed item did not use Smart Checklist syntax");
  if (!result.managedChecklist.includes("- Implement Smart Checklist synchronization")) throw new Error("pending item did not use Smart Checklist syntax");
  if (result.managedChecklist.at(-1) !== "# End AI Flow Plan (managed by ai-config)") throw new Error("missing managed end marker");
' "$TEST_DIR/sync-plan/jira-smart-checklist-result.json"

"$SCRIPT_DIR/jira.command.sh" \
  comment EXAMPLE-8336 \
  --body "Dev deployment is healthy." \
  --mention sshapiro \
  --mention schaturvedi \
  --link "Draft PR|https://github.example.invalid/example-org/example-service/pull/504" \
  --skip-if-link-exists \
  --output-dir "$TEST_DIR/comment" \
  --validate-only >/dev/null

node -e '
  const result = require(process.argv[1]);
  if (result.status !== "validated") throw new Error("expected validated comment status");
  if (result.issueKey !== "EXAMPLE-8336") throw new Error("comment issue was not normalized");
  if (!result.formattedComment.includes("[~sshapiro] [~schaturvedi]")) throw new Error("mentions were not formatted for Jira");
  if (!result.formattedComment.includes("[Draft PR|https://github.example.invalid/example-org/example-service/pull/504]")) throw new Error("link was not formatted for Jira");
  if (!result.formattedComment.includes("/created-with-ai-config")) throw new Error("ai-config comment ownership marker missing");
  if (!result.skipIfLinkExists) throw new Error("expected duplicate-link guard to be preserved");
' "$TEST_DIR/comment/jira-comment-result.json"

node --input-type=module -e '
  const { hasExistingAiConfigCommentLink } = await import(`${process.env.AI_COMMANDS_ROOT}/jira/jira-comment-dedupe.mjs`);
  const link = "https://github.example.invalid/example-org/example-service/pull/504";
  const links = [{ label: "Draft PR", url: link }];
  if (!hasExistingAiConfigCommentLink({ comments: [{ text: `Draft PR ${link} /created-with-ai-config`, hrefs: [] }], links })) throw new Error("expected existing ai-config PR comment to be detected");
  if (hasExistingAiConfigCommentLink({ comments: [{ text: `Draft PR ${link}`, hrefs: [] }], links })) throw new Error("unowned comment must not suppress a new ai-config comment");
  if (hasExistingAiConfigCommentLink({ comments: [{ text: "other /created-with-ai-config", hrefs: ["https://github.example.invalid/example-org/example-service/pull/503"] }], links })) throw new Error("different PR link must not be suppressed");
'

if "$SCRIPT_DIR/jira.command.sh" comment EXAMPLE-8336 --body test --link "unsafe|http://example.com" --validate-only >/dev/null 2>&1; then
  echo "Expected non-HTTPS Jira comment link to fail" >&2
  exit 1
fi

if "$SCRIPT_DIR/jira.command.sh" \
  update EXAMPLE-8336 \
  --output-dir "$TEST_DIR/unsafe-update" \
  --description-file "$TEST_DIR/rendered-description.md" \
  --priority Critical \
  --validate-only >/dev/null 2>&1; then
  echo "Expected existing Jira update fields outside description/summary to be rejected" >&2
  exit 1
fi

if ! "$SCRIPT_DIR/jira.command.sh" \
  create \
  --output-dir "$TEST_DIR/unstructured" \
  --project EXAMPLE \
  --issue-type Task \
  --summary "[Example Service]: Unstructured description" \
  --description "Implementation first, without problem or domain context." \
  --validate-only >/dev/null 2>&1; then
  echo "Expected Jira mechanics to accept a profile-approved free-form description" >&2
  exit 1
fi

if "$SCRIPT_DIR/jira.command.sh" \
  --output-dir "$TEST_DIR/missing" \
  --project EXAMPLE \
  --issue-type Task \
  --summary "Missing description" \
  --validate-only >/dev/null 2>&1; then
  echo "Expected missing description validation to fail" >&2
  exit 1
fi

if "$SCRIPT_DIR/jira.command.sh" --delete EXAMPLE-8379 >/dev/null 2>&1; then
  echo "Expected every destructive Jira operation to be rejected" >&2
  exit 1
fi

PREFLIGHT_DIR="$TEST_DIR/preflight"
mkdir -p "$PREFLIGHT_DIR"
cp "$SCRIPT_DIR/jira-browser-preflight.sh" "$PREFLIGHT_DIR/preflight.sh"
printf '%s\n' '#!/usr/bin/env bash' 'echo "active tab"' >"$PREFLIGHT_DIR/osascript-ok"
printf '%s\n' '#!/usr/bin/env bash' 'echo "Executing JavaScript through AppleScript is turned off" >&2' 'exit 1' >"$PREFLIGHT_DIR/osascript-disabled"
printf '%s\n' '#!/usr/bin/env bash' 'echo "Can’t get application id \"com.google.Chrome\". (-1728)" >&2' 'exit 1' >"$PREFLIGHT_DIR/osascript-sandbox-denied"
chmod +x "$PREFLIGHT_DIR/osascript-ok" "$PREFLIGHT_DIR/osascript-disabled" "$PREFLIGHT_DIR/osascript-sandbox-denied"
JIRA_OS_NAME=Darwin JIRA_OSASCRIPT_BIN="$PREFLIGHT_DIR/osascript-ok" "$PREFLIGHT_DIR/preflight.sh" >/dev/null
if JIRA_OS_NAME=Darwin JIRA_OSASCRIPT_BIN="$PREFLIGHT_DIR/osascript-disabled" "$PREFLIGHT_DIR/preflight.sh" >"$PREFLIGHT_DIR/disabled.log" 2>&1; then
  echo "Expected disabled Chrome JavaScript preflight to fail" >&2
  exit 1
fi
if ! grep -q 'View > Developer > Allow JavaScript from Apple Events' "$PREFLIGHT_DIR/disabled.log"; then
  echo "Expected disabled Chrome JavaScript preflight to print enablement guidance" >&2
  exit 1
fi
if JIRA_OS_NAME=Darwin JIRA_OSASCRIPT_BIN="$PREFLIGHT_DIR/osascript-sandbox-denied" "$PREFLIGHT_DIR/preflight.sh" >"$PREFLIGHT_DIR/sandbox-denied.log" 2>&1; then
  echo "Expected sandbox-denied Chrome preflight to fail" >&2
  exit 1
fi
grep -q 'JIRA_APPLE_EVENTS_ACCESS_UNAVAILABLE' "$PREFLIGHT_DIR/sandbox-denied.log"
grep -q 'Retry the same registered Jira command once with desktop/Apple Events escalation' "$PREFLIGHT_DIR/sandbox-denied.log"
grep -Fq 'get ISSUE-KEY --output-dir DIR' "$SCRIPT_DIR/jira.command.sh"
grep -Fq 'jira-ticket-read.sh' "$SCRIPT_DIR/jira.command.sh"
grep -Fq 'search --project KEY --issue-type TYPE --summary-exact TEXT --label LABEL --output-dir DIR' "$SCRIPT_DIR/jira.command.sh"
grep -Fq 'jira-ticket-search.sh' "$SCRIPT_DIR/jira.command.sh"
grep -Fq '## Registered exact search' "$SCRIPT_DIR/jira.command.md"
grep -Fq 'list-by-status --project KEY --status STATUS --output-dir DIR' "$SCRIPT_DIR/jira.command.sh"
grep -Fq 'jira-list-by-status.sh' "$SCRIPT_DIR/jira.command.sh"
grep -Fq '## Registered status inventory' "$SCRIPT_DIR/jira.command.md"
grep -Fq 'JIRA_LIST_BY_STATUS_COUNT' "$SCRIPT_DIR/jira-list-by-status.mjs"
grep -Fq 'JIRA_SEARCH_MATCH_COUNT' "$SCRIPT_DIR/jira.command.md"
grep -Fq 'redirect directly to the newest matching issue' "$SCRIPT_DIR/jira.command.md"
grep -Fq 'label is supporting evidence only and is not identity' "$SCRIPT_DIR/jira.command.md"
grep -Fq '${AI_COMMANDS_ROOT}/jira/jira.command.sh search' "$SCRIPT_DIR/jira.command.md"
grep -Fq "firstStep === 'project-and-type'" "$SCRIPT_DIR/jira-existing-chrome.mjs"
grep -Fq "Jira Create details form did not open after Project and Issue Type selection" "$SCRIPT_DIR/jira-existing-chrome.mjs"
grep -Fq "button.form.requestSubmit(button)" "$SCRIPT_DIR/jira-existing-chrome.mjs"
grep -Fq "was not committed to the form" "$SCRIPT_DIR/jira-existing-chrome.mjs"

if ! "$SCRIPT_DIR/jira.command.sh" \
  --output-dir "$TEST_DIR/missing-app-prefix" \
  --project EXAMPLE \
  --issue-type Task \
  --summary "Ambiguous title" \
  --description "Profile-approved description." \
  --validate-only >/dev/null 2>&1; then
  echo "Expected profile-owned summary formats to pass provider validation" >&2
  exit 1
fi

if "$SCRIPT_DIR/jira.command.sh" \
  --output-dir "$TEST_DIR/invalid-project" \
  --project "not valid" \
  --issue-type Task \
  --summary "Invalid project" \
  --description "This must fail before browser launch." \
  --validate-only >/dev/null 2>&1; then
  echo "Expected invalid project validation to fail" >&2
  exit 1
fi

echo "jira.command tests passed"
