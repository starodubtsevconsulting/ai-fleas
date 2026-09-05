import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import {
  adminControlTaskDecision,
  adminExplicitEffectDecision,
  adminSuccessorHandoffDecision,
  governanceAdvisoryDecision,
  governanceJudgeAdvisoryReplyDecision,
  judgeScenarioReloadDecision,
  freshTicketIntakeDecision,
  governanceJudgeScenarioCommunicationDecision,
  governanceJudgeProposalDecision,
  governanceJudgeProposalReportDecision,
  governanceMarkdownActivationDecision,
  governancePublicationDecision,
  governanceHumanRuleSeedDecision,
  configuredRolesFromManifest,
  commandExecutionDecision,
  credentialEscalationAuthorizationDecision,
  concurrentRosterReinitializationDecision,
  rosterExpansionRepairDecision,
  loadWorkflowAgents,
  loadRoleCapabilityOwnership,
  managerHeartbeatDecision,
  judgeHeartbeatDecision,
  managerGovernanceContextVerificationDecision,
  managerPacketDecision,
  managerTurnCompletionDecision,
  normalizeRoutableRole,
  resolveExactRoutableTask,
  packetDeliveryAcknowledgementDecision,
  workerDeliveryRecoveryDecision,
  workerFollowupDecision,
  activeScopeInterruptionDecision,
  createManagerPacket,
  projectTasksForCaller,
  resolveManagerCallerContext,
  resolveVisibleRole,
  staffingDecision,
  terminalDeliveryDecision,
  ticketDecision,
  validateNewTicketMetadata,
  validateReplacementWorkerInitialization,
  validateInitializedRuleSourceBinding,
  validateJudgeAgentInstantiation,
  validateProjectContext,
  validateWorkerPacket,
  workerDispatchDecision,
  verifyConfigurationSourceBinding,
  verifyInitializedRuleSourceCandidate,
  verifyTrackerBinding,
  workerHandoffDecision,
  workerDisposition,
  proxyCoderActivationDecision,
  proxyCoderProxyRouteDecision,
  publicGovernancePublicationDecision,
  publicMirrorManifestDecision,
  gitRoleProvenanceDecision,
  agentAwareSourceControlDecision,
  profileConfigurationTargetDecision,
} from './visible-role-routing.mjs';

test('ordinary process execution is mechanically reserved for the trusted Command Runner role', () => {
  for (const registeredRoute of ['npm-test', 'nx-build', 'worktree-bash', 'repository-search']) {
    assert.throws(() => commandExecutionDecision({
      actorRole: 'designer / reviewer',
      trustedActorRole: 'designer / reviewer',
      registeredRoute,
    }), /BLOCKED_DESIGNER_REVIEWER_DIRECT_COMMAND_EXECUTION/);
  }
  assert.throws(() => commandExecutionDecision({
    actorRole: 'command-runner',
    trustedActorRole: 'designer / reviewer',
    registeredRoute: 'npm-test',
  }), /BLOCKED_EXECUTION_ROLE_MISMATCH/);
  assert.throws(() => commandExecutionDecision({
    actorRole: 'command-runner',
    trustedActorRole: 'command-runner',
    registeredRoute: '',
  }), /BLOCKED_UNREGISTERED_COMMAND_ROUTE/);
  assert.equal(commandExecutionDecision({
    actorRole: 'command-runner',
    trustedActorRole: 'command-runner',
    registeredRoute: 'npm-test',
  }), 'COMMAND_EXECUTION_ALLOWED:command-runner:npm-test');
});

test('development workflow owns ordered delivery gates and requires independent UI acceptance', () => {
  const workflow = fs.readFileSync(new URL('../dev.workflow.md', import.meta.url), 'utf8');
  const designer = normalizeWhitespace(fs.readFileSync(new URL('../../_common/roles/designer-reviewer.md', import.meta.url), 'utf8'));
  const testing = fs.readFileSync(new URL('../guides/testing.md', import.meta.url), 'utf8');
  const orderedRoles = [
    'Manager: ticket resolution and required staffing',
    'Designer/Reviewer: requirements, acceptance criteria, and specification',
    'Designer/Reviewer: implementation design and exact Coder packet',
    'Coder: product and test-source implementation',
    'Command Runner: focused and automated validation commands',
    'Designer/Reviewer: independent technical review',
    'UI Acceptance Tester: independent visible acceptance',
    'Designer/Reviewer: assignment acceptance',
    'Command Runner: authorized delivery or deployment mechanics',
    'Manager: evidence-gated ticket closure',
  ];
  let prior = -1;
  for (const roleGate of orderedRoles) {
    const current = workflow.indexOf(roleGate);
    assert.ok(current > prior, `${roleGate} must occur in workflow order`);
    prior = current;
  }
  assert.match(workflow, /visible UI behavior is affected/);
  assert.match(workflow, /never substitutes\s+for the UI Acceptance Tester receipt/);
  assert.match(workflow, /Designer\/Reviewer must not execute automated\s+tests or visible acceptance itself/);
  assert.match(workflow, /specification-driven development flow/);
  assert.match(workflow, /There is currently no Deployer role/);
  assert.match(workflow, /only after the human explicitly requests and authorizes that effect/);
  assert.match(designer, /ordered gates and their owners come from the active \[development workflow\]/);
  assert.match(designer, /must not issue assignment acceptance until the matching terminal receipts exist/);
  assert.match(testing, /UI Acceptance Tester owns\s+independent visible UI acceptance/);
});

test('Dev policy composes the shared matrix and keeps Coder return distinct from reverse assignment', () => {
  const team = normalizeWhitespace(fs.readFileSync(new URL('./team.md', import.meta.url), 'utf8'));
  const commonMatrix = normalizeWhitespace(fs.readFileSync(new URL('../../_common/policy/access-matrix.md', import.meta.url), 'utf8'));
  assert.match(team, /Agent access matrix mechanism/);
  assert.match(team, /inherits.*the common access-matrix mechanism/);
  assert.match(team, /Worker.*does not create a generic Worker-to-Worker assignment route/);
  assert.match(team, /Designer\/Reviewer \| Coder \| Ticket-bound source-inspection or implementation packet/);
  assert.match(team, /Designer\/Reviewer \| Proxy Coder \| Structured development packet/);
  assert.match(team, /Proxy Coder validates, submits, polls, and presents the correlated Hermes result/);
  assert.match(team, /neither may assign, delegate,\s+transfer, or pass work to Designer\/Reviewer/);
  assert.match(team, /return-coordinator.*not reverse supervision or assignment authority/);
  assert.match(team, /Supervising Worker → Assigned Worker.*Designer\/Reviewer → Coder/);
  assert.match(team, /Designer\/Reviewer → Proxy Coder/);
  assert.match(team, /not\s+Codex child agents or subagents/);
  assert.match(commonMatrix, /authoritative compatibility ceiling.*not a concrete communication grant/);
  assert.match(commonMatrix, /Supervising Worker \| Assigned Worker \| PERMITTED_IF_WORKFLOW_BOUND/);
  assert.match(commonMatrix, /Assigned Worker \| Supervising Worker \| RETURN_ONLY/);
  assert.match(commonMatrix, /Governed Agent \| Judge \| PROHIBITED/);
  assert.match(commonMatrix, /Judge \| Governed Agent \| PROHIBITED/);
  assert.match(commonMatrix, /Governed Agent \| Admin \| PROHIBITED/);
  assert.match(commonMatrix, /BLOCKED_ROLE_COMMUNICATION_COMPATIBILITY/);
});

test('UI Acceptance Tester uses vision only to improve domain-facing E2E facade acceptance', () => {
  const role = normalizeWhitespace(fs.readFileSync(new URL('../../_common/roles/ui-acceptance-tester.md', import.meta.url), 'utf8'));
  assert.match(role, /E2E facade adapters are the primary and intended steady-state UI acceptance mechanism/);
  assert.match(role, /facades live only in E2E test support code/);
  assert.match(role, /not product classes, production adapters, application APIs/);
  assert.match(role, /launcher\.listProjects\(\)/);
  assert.match(role, /Playwright locators, waits, and browser mechanics internally/);
  assert.match(role, /test facade is a maintainability boundary inside the E2E suite/);
  assert.match(role, /does not add facade code to the shipped application/);
  assert.match(role, /repairs that operation once and every journey using it benefits/);
  assert.match(role, /easier to adapt, reuse, review, support, and harden/);
  assert.match(role, /Computer vision, desktop vision, or another available visible-interaction capability is a bounded diagnostic fallback only/);
  assert.match(role, /does not edit facade or Playwright source/);
  assert.match(role, /reruns acceptance through the domain-facing facade API/);
  assert.match(role, /Repeated vision-only execution without a facade-repair handoff is `BLOCKED`/);
});

test('UI Acceptance Tester uses a full window by default and preserves explicit viewport testing', () => {
  const role = fs.readFileSync(new URL('../../_common/roles/ui-acceptance-tester.md', import.meta.url), 'utf8');
  assert.match(role, /fully opens or maximizes the application window before the\s+journey by default/);
  assert.match(role, /must not treat an\s+accidentally small, partially opened, overlapped, or obscured window/);
  assert.match(role, /deliberately constrained viewport is used only when the ticket, journey, or documented acceptance requirement tests/);
  assert.match(role, /records that\s+viewport or window size in its evidence/);
});

const commonJudgeUrl = new URL('../../_common/roles/judge.md', import.meta.url);
const normalizeWhitespace = (value) => value.replace(/\s+/g, ' ');

test('workflow agents manifest is the default agent-instantiation data source', () => {
  const manifest = loadWorkflowAgents();
  const configured = configuredRolesFromManifest(manifest);
  assert.equal(Object.keys(manifest.agents).length, 7);
  assert.deepEqual(Object.keys(manifest.agents).sort(), [
    'coder',
    'command-runner',
    'designer / reviewer',
    'judge',
    'manager',
    'proxy-coder',
    'ui-acceptance-tester',
  ]);
  assert.equal(Object.hasOwn(manifest.agents, 'admin'), false);
  assert.deepEqual(configured.manager, { displayLabel: '🤖 Manager', model: 'gpt-5.6-luna', reasoning: 'medium' });
  assert.equal(manifest.agents.judge.humanFacing, 'oversight-only');
  assert.equal(manifest.initializer.agentId, 'admin');
  assert.equal(manifest.teamPolicy, 'agents/team.md');
  assert.equal(manifest.policy.authority, 'agents/team.md');
  assert.equal(manifest.policy.elasticPool, 'agents/elastic-agent-pool.md');
  assert.ok(manifest.dependencies.length > 0);
  assert.equal(manifest.dependencies.every(({ requirement }) => requirement === 'capability-bound'), true);
  assert.equal(manifest.dependencies.some(({ consumerAgentId, providerAgentId }) =>
    consumerAgentId === 'judge' || providerAgentId === 'judge'), false);
  assert.deepEqual(configured['proxy-coder'], { displayLabel: '🧠 Proxy Coder', model: 'gpt-5.6-luna', reasoning: 'low' });
  for (const declaration of [manifest.initializer, ...Object.values(manifest.agents)]) {
    assert.equal(fs.existsSync(new URL(`../${declaration.roleDefinition}`, import.meta.url)), true,
      `${declaration.agentId} common role must exist`);
  }
  for (const policyPath of Object.values(manifest.policy)) {
    assert.equal(fs.existsSync(new URL(`../${policyPath}`, import.meta.url)), true,
      `${policyPath} workflow policy source must exist`);
  }
  assert.deepEqual(Object.values(manifest.agents).map(({ agentName }) => agentName),
    ['Designer Reviewer', 'Judge', 'Manager', 'Coder', 'Command Runner', 'UI Acceptance Tester', 'Proxy Coder']);
  assert.equal(manifest.agents.coder.roleClass, 'Worker');
  assert.equal(manifest.agents['proxy-coder'].roleClass, 'Worker');
  assert.deepEqual(manifest.agents['proxy-coder'].execution, {
    mode: 'proxy', bridge: 'local-hermes-delegation', target: 'profile-resolved-hermes-agent',
  });
  assert.equal(manifest.agents.manager.roleClass, 'Manager');
  assert.deepEqual(manifest.agents.coder.elasticPool, { enabled: true, minReady: 0, maxActive: 3 });
  assert.deepEqual(manifest.agents['command-runner'].elasticPool, { enabled: true, minReady: 1, maxActive: 4 });
  assert.equal(fs.readFileSync(new URL('../../_common/policy/dependencies.template.yml', import.meta.url), 'utf8'),
    'dependencies:\n  - consumerAgentId: role-a\n    providerAgentId: role-b\n    kind: capability-provider\n' +
    '    requirement: capability-bound\n    capabilities:\n      - example-capability\n');
});

test('workflow dependency declarations fail closed and never become role-existence dependencies', () => {
  const source = fs.readFileSync(new URL('../agents.yml', import.meta.url), 'utf8');
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'workflow-dependencies-'));
  const loadVariant = (name, body) => {
    const target = path.join(tempRoot, `${name}.yml`);
    fs.writeFileSync(target, body);
    return () => loadWorkflowAgents(target);
  };
  assert.throws(loadVariant('foreign-role', source.replace(
    'providerAgentId: manager', 'providerAgentId: undeclared-role')), /MANIFEST_DEPENDENCY/);
  assert.throws(loadVariant('self-reference', source.replace(
    'providerAgentId: manager', 'providerAgentId: designer / reviewer')), /MANIFEST_DEPENDENCY/);
  assert.throws(loadVariant('existence-dependency', source.replace(
    'requirement: capability-bound', 'requirement: agent-required')), /MANIFEST_DEPENDENCY/);
  assert.throws(loadVariant('empty-capabilities', source.replace(
    'capabilities:\n      - Ticket search create update and evidence-gated closure\n' +
    '      - Visible worker create archive and scheduler', 'capabilities: []')), /MANIFEST_DEPENDENCY/);
  const dependencyFree = loadVariant('dependency-free', source.replace(/\ndependencies:\n[\s\S]*$/u,
    '\ndependencies: []\n'))();
  assert.deepEqual(dependencyFree.dependencies, []);
  assert.throws(loadVariant('duplicate-alias', source.replace(
    'aliases: [workflow judge, judge]', 'aliases: [workflow judge, manager]')), /MANIFEST_AGENT/);
});

test('proxy execution is structured configuration on the existing Worker role', () => {
  const source = fs.readFileSync(new URL('../agents.yml', import.meta.url), 'utf8');
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'workflow-proxy-execution-'));
  const invalidPath = path.join(tempRoot, 'invalid.yml');
  fs.writeFileSync(invalidPath, source.replace('bridge: local-hermes-delegation', 'bridge: ""'));
  assert.throws(() => loadWorkflowAgents(invalidPath), /BLOCKED_WORKFLOW_AGENTS_MANIFEST_AGENT_EXECUTION/);
  const proxy = loadWorkflowAgents().agents['proxy-coder'];
  assert.equal(proxy.roleClass, 'Worker');
  assert.equal(proxy.execution.mode, 'proxy');
});

test('workflow dependencies resolve only Team-declared capabilities owned or coordinated by their provider', () => {
  const manifest = loadWorkflowAgents();
  const ownership = loadRoleCapabilityOwnership(undefined, manifest);
  for (const dependency of manifest.dependencies) {
    for (const capability of dependency.capabilities) {
      assert.notEqual(ownership[capability]?.[dependency.providerAgentId], 'PROHIBITED');
      if (dependency.kind === 'capability-provider') {
        assert.match(ownership[capability][dependency.providerAgentId], /^OWN/);
      }
    }
  }
});

test('Dev selects common roles directly without per-role workflow wrappers', () => {
  const manifestSource = fs.readFileSync(new URL('../agents.yml', import.meta.url), 'utf8');
  const workflow = fs.readFileSync(new URL('../dev.workflow.md', import.meta.url), 'utf8');
  assert.doesNotMatch(manifestSource, /workflowBinding:/);
  assert.match(workflow, /## Agent binding/);
  for (const role of ['admin', 'designer-reviewer', 'judge', 'manager', 'coder', 'command-runner', 'ui-acceptance-tester', 'proxy-coder']) {
    assert.equal(fs.existsSync(new URL(`./${role}.md`, import.meta.url)), false);
    assert.equal(fs.existsSync(new URL(`../../_common/roles/${role}.md`, import.meta.url)), true);
  }
});

test('workflow agent declarations remain profile-neutral', () => {
  const source = fs.readFileSync(new URL('../agents.yml', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /\b(?:profileId|runtimeProjectId|sc-dev|sxm-dev)\b/);
  const manifest = loadWorkflowAgents();
  assert.equal(Object.hasOwn(manifest, 'harness'), false);
  assert.equal(manifest.logicalProjectIdPattern, '<profile-id>-<workflow-id>');
  assert.equal(manifest.workflowId, 'dev');
});

test('Proxy Coder stays visible but delegation remains inactive until Ticket #57 Gate 1 evidence is complete', () => {
  const evidence = { hermesReady: true, asusQwenUsable: true, requestAcknowledged: true,
    codebaseWorkStarted: true, correlatedStatusReturned: true, sanitizedFailureVerified: true };
  const ticketId = 'ari:cloud:trello::card/workspace/631cab2a192e3303df9d967d/6a945e43c94cea9e014c13b5';
  assert.equal(proxyCoderActivationDecision({ gate1Evidence: evidence, ticketId }),
    'PROXY_CODER_ACTIVATION_GATE_PASSED');
  assert.throws(() => proxyCoderActivationDecision({ gate1Evidence: { ...evidence, hermesReady: false }, ticketId }),
    /PROXY_CODER_GATE_1_EVIDENCE_REQUIRED/);
});

test('Proxy Coder accepts only same-task human dialogue or exact Designer packets through submit then status', () => {
  const operations = ['local_hermes_submit', 'local_hermes_status', 'local_proxy_usage'];
  assert.equal(proxyCoderProxyRouteDecision({ callerKind: 'human', callerTaskId: 'local-1',
    currentTaskId: 'local-1', designerTaskId: 'designer-1', operations }),
  'PROXY_CODER_HUMAN_PROXY_ROUTE');
  assert.equal(proxyCoderProxyRouteDecision({ callerKind: 'designer-reviewer', callerTaskId: 'designer-1',
    currentTaskId: 'local-1', designerTaskId: 'designer-1', operations }),
  'PROXY_CODER_DESIGNER_PROXY_ROUTE');
  assert.throws(() => proxyCoderProxyRouteDecision({ callerKind: 'human', callerTaskId: 'other',
    currentTaskId: 'local-1', designerTaskId: 'designer-1', operations }), /PROXY_CODER_PROXY_ROUTE/);
  assert.throws(() => proxyCoderProxyRouteDecision({ callerKind: 'designer-reviewer', callerTaskId: 'designer-1',
    currentTaskId: 'local-1', designerTaskId: 'designer-1', operations: ['local_hermes_submit', 'shell'] }),
  /PROXY_CODER_UNREGISTERED_OPERATION/);
});

test('Codex Proxy Coder requires plugin restart lifecycle and remains endpoint-host agnostic', () => {
  const contract = fs.readFileSync(new URL('../../_common/roles/proxy-coder.md', import.meta.url), 'utf8');
  assert.match(contract, /## Codex app integration lifecycle/);
  assert.match(contract, /`local-hermes` personal plugin installed and\s+enabled is a hard initialization prerequisite/);
  assert.match(contract, /the role must not become ready/);
  assert.match(contract, /Installing, reinstalling, or updating that/);
  assert.match(contract, /plugin requires the human to restart the Codex app/);
  assert.match(contract, /Admin must initialize a fresh Proxy Coder task so/);
  assert.match(contract, /it receives the updated tool inventory/);
  assert.match(contract, /`local_hermes_submit`,\s+`local_hermes_status`, and `local_proxy_usage` tools/);
  assert.match(contract, /knows only the Local Hermes API boundary configured by the plugin/);
  assert.match(contract, /must remain agnostic about which application or process\s+hosts that endpoint/);
  assert.match(contract, /must never start, restart, configure, or supervise the endpoint host or Hermes/);
  assert.match(contract, /BLOCKED_PROXY_CODER_CODEX_PLUGIN_UNAVAILABLE/);
  assert.match(contract, /do not invoke\s+repository startup scripts or infer a host application as a fallback/);
  assert.doesNotMatch(contract, /AI Workflow Suite/);
});

test('Proxy Coder retries a deferred Hermes identity on every chat and refreshes only when identity changes', () => {
  const contract = fs.readFileSync(new URL('../../_common/roles/proxy-coder.md', import.meta.url), 'utf8');
  assert.match(contract, /attempts one non-product Hermes handshake/);
  assert.match(contract, /PROXY_CODER_READY\n\nHermes connected/);
  for (const field of ['Hello:', 'Executor:', 'Provider:', 'Model:', 'Profile:', 'Workflow:', 'Project:', 'Repository:', 'Correlation:']) {
    assert.match(contract, new RegExp(field));
  }
  assert.match(contract, /Hermes connection pending; the next user message will retry automatically/);
  assert.match(contract, /Before processing every accepted message, inspect only the task's in-memory Hermes identity state/);
  assert.match(contract, /the next user message retries again/);
  assert.match(contract, /Never require reinitialization merely because Hermes started after this task/);
  assert.match(contract, /The identity\s+card is shown after the first successful handshake/);
  assert.match(contract, /`local_hermes_submit\.projectId` always receives `launcherProjectId`/);
  assert.match(contract, /`local_hermes_submit\.workflowPath` receives the exact profile `workflows\[\]\.path`/);
  assert.match(contract, /`queued` and `running` are nonterminal states/);
  assert.match(contract, /continue polling the same correlation within the same turn/);
  assert.match(contract, /different executor, provider, or model, show a refreshed\s+identity card once/);
  assert.match(contract, /BLOCKED_PROXY_CODER_HERMES_HANDSHAKE_FAILED/);
  assert.match(contract, /never print endpoints, credentials, environment values, or internal provider\s+configuration/);
});

test('Proxy Coder cannot answer even trivial prompts without a correlated Hermes receipt', () => {
  const contract = fs.readFileSync(new URL('../../_common/roles/proxy-coder.md', import.meta.url), 'utf8');
  assert.match(contract, /Every human message in this task after the initialization handshake is a delegation request/);
  assert.match(contract, /including greetings,\s+arithmetic, follow-ups, and apparently trivial questions/);
  assert.match(contract, /must not answer any such message from Luna/);
  assert.match(contract, /<Hermes answer>/);
  assert.match(contract, /never wrap ordinary dialogue in ambiguous echo instructions/);
  assert.match(contract, /Echoing `all good\?` as the answer/);
  assert.match(contract, /timezone identifier such as `America\/Toronto` is ordinary request data/);
  assert.match(contract, /When the request contains no explicit filesystem or repository path, pass it to Hermes normally/);
  assert.match(contract, /substantive response obtained from the correlated completed `local_hermes_status` result/);
  assert.match(contract, /verifies the receipt's executor, provider, and model against the one-time identity card/);
  assert.match(contract, /does not repeat those fields during ordinary chat/);
  assert.match(contract, /must not summarize, rewrite, embellish, or omit substantive/);
  assert.match(contract, /Show labeled full receipt fields, polling detail, or intermediate progress only when the human requests diagnostics/);
  assert.match(contract, /Without a correlated completed receipt, return a typed blocker and no answer/);
  assert.match(contract, /Every ordinary terminal response appends one compact line/);
  assert.match(contract, /Luna session: <totalTokens> tokens total · <cachedInputTokens> cached/);
  assert.match(contract, /cumulative,\s+monotonically growing total for this exact Proxy Coder instance/);
  assert.match(contract, /Do not make an additional usage\s+tool call/);
  assert.match(contract, /this displayed answer is included in the next total/);
  assert.match(contract, /may invoke `local_proxy_usage` once/);
  assert.match(contract, /Never estimate missing counters/);
  assert.match(contract, /BLOCKED_PROXY_CODER_PROJECT_SCOPE/);
  assert.match(contract, /host-level filesystem visibility as workflow\s+authority/);
  assert.match(contract, /complete\s+initialized workflow project scope/);
  assert.match(contract, /primary project selects the starting\s+directory but does not narrow the scope/);
  assert.match(contract, /Launcher-created interactive Hermes sessions receive the identical resolved scope/);
  assert.match(contract, /`LOCAL_HERMES_PROJECT_SCOPE_VIOLATION` is a completed pre-delegation scope\s+decision, not a handshake/);
  assert.match(contract, /Never replace this result with `BLOCKED_PROXY_CODER_HERMES_HANDSHAKE_FAILED`/);
});

test('Team page is the single capability and communication policy', () => {
  const markdown = fs.readFileSync(new URL('./team.md', import.meta.url), 'utf8');
  assert.match(markdown, /## Team capability policy/);
  assert.match(markdown, /## Team communication policy/);
  const ownership = loadRoleCapabilityOwnership();
  assert.equal(Object.keys(ownership).length, 16);
  const publication = ownership['Protected profile-scoped AI configuration commit push PR create update open and publication verification after all protected gates'];
  assert.equal(publication.judge, 'OWN_EXCLUSIVE');
  assert.equal(publication['command-runner'], 'PROHIBITED');
  assert.equal(ownership['Human-seeded profile-scoped AI configuration maintenance and physical edits'].judge,
    'OWN_EXCLUSIVE');
  assert.deepEqual(new Set(Object.entries(ownership['Initial protected rule meaning or semantic policy choice'])
    .filter(([field]) => field !== 'capability').map(([, value]) => value)), new Set(['PROHIBITED']));
  assert.equal(ownership['Human-visible context rendering (show-context)']['designer / reviewer'], 'OWN');
  assert.equal(ownership['Non-secret AI profile configuration and validation']['designer / reviewer'], 'DISPATCH_ONLY');
  assert.equal(ownership['Non-secret AI profile configuration and validation'].coder, 'OWN');
  assert.equal(ownership['Non-secret AI profile configuration and validation'].judge, 'PROHIBITED');
  assert.equal(ownership['Human-visible context rendering (show-context)'].judge, 'OWN_GOVERNANCE_REPORTING_ONLY');
  assert.equal(ownership['Registered local-Hermes delegation capability']['proxy-coder'], 'OWN');
  assert.equal(ownership['Read-only target-contained source inspection'].coder, 'OWN');
  assert.equal(ownership['Read-only target-contained source inspection']['command-runner'], 'READ_DETAIL');
  assert.equal(ownership['Read-only target-contained repository and Git inspection'].coder, 'OWN');
  const routes = fs.readFileSync(new URL('../../../ai-commands/execution-routes.tsv', import.meta.url), 'utf8');
  assert.match(routes, /^show-context\/show-context\.command\.md\tmixed\tdesigner-reviewer\t-\tjudge\t-$/m);
  assert.match(markdown, /^\| Capability \| Designer Reviewer \| Judge \| Manager \|/m);
  assert.doesNotMatch(markdown, /role-capability-ownership\.csv/);
});

test('profile configuration is isolated to the initialized profile with a direct-human Admin exception', () => {
  const currentRoot = '/workspace/ai-profile/profile-a';
  const otherRoot = '/workspace/ai-profile/profile-b';
  assert.equal(profileConfigurationTargetDecision({ actorRole: 'designer / reviewer', profileId: 'profile-a',
    profileRoot: currentRoot, targetPath: `${currentRoot}/work-profile.yml` }),
  'PROFILE_CONFIGURATION_TARGET:profile-a');
  assert.equal(profileConfigurationTargetDecision({ actorRole: 'coder', profileId: 'profile-a',
    profileRoot: currentRoot, targetPath: `${currentRoot}/projects/workflow/project.yml` }),
  'PROFILE_CONFIGURATION_TARGET:profile-a');
  assert.throws(() => profileConfigurationTargetDecision({ actorRole: 'coder', profileId: 'profile-a',
    profileRoot: otherRoot, targetPath: `${otherRoot}/work-profile.yml` }),
  /BLOCKED_PROFILE_CONFIGURATION_BOUNDARY/);
  assert.throws(() => profileConfigurationTargetDecision({ actorRole: 'designer / reviewer', profileId: 'profile-a',
    profileRoot: currentRoot, targetPath: `${otherRoot}/work-profile.yml` }),
  /BLOCKED_PROFILE_CONFIGURATION_BOUNDARY/);
  assert.equal(profileConfigurationTargetDecision({ actorRole: 'admin', profileId: 'profile-a',
    profileRoot: otherRoot, targetPath: `${otherRoot}/work-profile.yml`, directHumanAdminRequest: true,
    targetProfileId: 'profile-b' }), 'ADMIN_PROFILE_CONFIGURATION_TARGET:profile-b');
  assert.throws(() => profileConfigurationTargetDecision({ actorRole: 'admin', profileId: 'profile-a',
    profileRoot: otherRoot, targetPath: `${otherRoot}/work-profile.yml`, targetProfileId: 'profile-b' }),
  /BLOCKED_ADMIN_PROFILE_CONFIGURATION_BOUNDARY/);
});

test('role labels are case-tolerant but exact roster identity rejects Admin substitutes', () => {
  assert.equal(normalizeRoutableRole('Manager'), 'manager');
  assert.equal(normalizeRoutableRole('MANAGER'), 'manager');
  assert.throws(() => normalizeRoutableRole('admin'), /BLOCKED_EXECUTION_ROLE_MISMATCH/);
  const context = { profileId: 'sc', workflowId: 'dev', logicalProjectId: 'sc-dev', runtimeProjectId: 'runtime-1' };
  const roster = [
    { ...context, taskId: 'manager-1', role: 'Manager', active: true, visible: true, initialized: true },
    { ...context, taskId: 'admin-1', role: 'admin', active: true, visible: true, initialized: true },
  ];
  assert.deepEqual(resolveExactRoutableTask({ ...context, targetTaskId: 'manager-1',
    requiredExecutionRole: 'manager', registry: roster }), { taskId: 'manager-1', role: 'manager' });
  assert.throws(() => resolveExactRoutableTask({ ...context, targetTaskId: 'admin-1',
    requiredExecutionRole: 'manager', registry: roster }), /BLOCKED_EXECUTION_ROLE_MISMATCH/);
});

test('dev workflow team manifest matches every configured agent declaration', () => {
  const companion = fs.readFileSync(new URL('./team.md', import.meta.url), 'utf8');
  const configuredRows = Object.values(loadWorkflowAgents().agents);
  const declaredCount = companion.match(/\*\*Current governed agent count: `(\d+)`\.\*\*/);
  assert.ok(declaredCount, 'team.md must declare the one readable governed-agent count');
  assert.equal(Number(declaredCount[1]), configuredRows.length,
    'the readable governed-agent count must equal the agent manifest count');
  for (const row of configuredRows) {
    const line = companion.split(/\r?\n/).find((candidate) =>
      candidate.startsWith('|') && candidate.split('|')[1]?.trim() === `\`${row.agentId}\``);
    assert.ok(line, `missing companion role row: ${row.agentId}`);
    for (const value of [row.title, row.humanFacing, row.communicationMode, row.lifecycle, row.model, row.reasoning]) {
      assert.match(line, new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }
  }
  const judgeRow = companion.split(/\r?\n/).find((candidate) =>
    candidate.startsWith('|') && candidate.split('|')[1]?.trim() === '`judge`');
  assert.match(judgeRow, /`\.\.\/\.\.\/_common\/roles\/judge\.md`/,
    'Dev must instantiate the common Judge role');
  assert.doesNotMatch(judgeRow, /\| `judge\.md`/);

  const rosterCountPattern = /\b(?:\d+|six|seven)[ -](?:governed[ -])?(?:agents?|roles?)(?:\s+(?:roster|team|set|tasks?))?\b/i;
  const governedFiles = fs.readdirSync(import.meta.dirname)
    .filter((name) => name.endsWith('.md') && name !== 'team.md');
  for (const name of governedFiles) {
    const body = fs.readFileSync(new URL(`./${name}`, import.meta.url), 'utf8');
    assert.doesNotMatch(body, rosterCountPattern,
      `${name} must derive governed-agent cardinality from the role matrix`);
  }
});

test('Designer/Reviewer synchronizes accepted requirement changes through Manager lifecycle packets', () => {
  const contract = fs.readFileSync(new URL('../../_common/roles/designer-reviewer.md', import.meta.url), 'utf8');
  assert.match(contract, /## Requirements-change lifecycle synchronization/);
  assert.match(contract, /MUST notify the exact initialized visible Manager before dispatching\s+changed work or accepting it/);
  assert.match(contract, /Manager alone decides and performs any authorized ticket update/);
});

test('Agents base bounds evidence follow-up and escalates repeated requests', () => {
  const base = fs.readFileSync(new URL('../../agents.md', import.meta.url), 'utf8');
  assert.match(base, /## Bounded evidence follow-up/);
  assert.match(base, /MUST make one bounded attempt to resolve the request/);
  assert.match(base, /For one `\(assignmentOrTicketId, evidenceRequestCorrelationId\)` pair/);
  assert.match(base, /must not investigate or reply again\. It reports the\s+possible cycle to the human/);
});

test('Agents preamble defines one common workflow-owned agent system', () => {
  const base = fs.readFileSync(new URL('../../agents.md', import.meta.url), 'utf8');
  assert.match(base, /This is the single common contract for every workflow that activates managed AI agents/);
  assert.match(base, /not an AI command and not a standalone agent implementation/);
  assert.match(base, /required Admin and Judge foundations/);
});

test('Judge cannot use visible roles or request agent review', () => {
  const contract = fs.readFileSync(commonJudgeUrl, 'utf8');
  const workflow = fs.readFileSync(new URL('../dev.workflow.md', import.meta.url), 'utf8');
  assert.match(contract, /The Judge MUST NOT use any AI role or visible role task for any purpose/);
  assert.match(contract, /There is no review,\nlive-test, convenience, indirect-human, or other exception/);
  assert.match(contract, /Scheduled monitoring may only passively inspect new turns\s+through its audit cursors/);
  assert.match(workflow, /## Agent binding[\s\S]*### Judge override/);
  assert.match(workflow, /must not contact or use Designer\/Reviewer,\s+Manager, Coder, Command Runner/);
  assert.equal(loadWorkflowAgents().dependencies.some(({ consumerAgentId, providerAgentId }) =>
    consumerAgentId === 'judge' || providerAgentId === 'judge'), false);
});

test('Judge renders direct human governance reports through Show Context', () => {
  const contract = fs.readFileSync(commonJudgeUrl, 'utf8');
  assert.match(contract, /direct human request to report on a nontrivial permitted governance finding/);
  assert.match(contract, /Judge \*\*MUST\*\* first render direct `show-context` in its own visible task/);
  assert.match(contract, /must not\s+substitute a plain-text final summary when that command is available/);
  assert.match(contract, /Markdown rules\s+\*\*MUST\*\* select the registered `md-rules-changed` template/);
});

test('Command Runner may use registered Worktree Bash for bounded local operations', () => {
  const runner = normalizeWhitespace(fs.readFileSync(new URL('../../_common/roles/command-runner.md', import.meta.url), 'utf8'));
  const worktreeBash = fs.readFileSync(new URL('../../../ai-commands/worktree-bash/worktree-bash.command.md', import.meta.url), 'utf8');
  assert.match(runner, /`worktree-bash` command is an allowed general execution route/);
  assert.match(worktreeBash, /registered general fallback/);
  assert.match(worktreeBash, /git diff --check/);
});

test('Coder selects the shared companion-file documentation principle for runnable utilities', () => {
  const coder = normalizeWhitespace(fs.readFileSync(new URL('../../_common/roles/coder.md', import.meta.url), 'utf8'));
  assert.match(coder, /## Runnable shell-utility documentation/);
  assert.match(coder, /Companion File Documentation Principle/);
  assert.match(coder, /An undocumented runnable utility is `BLOCKED` from completion/);
});

test('Coder uses the development top-of-file documentation principle for one file explanation', () => {
  const coder = normalizeWhitespace(fs.readFileSync(new URL('../../_common/roles/coder.md', import.meta.url), 'utf8'));
  assert.match(coder, /Development Top-of-File Documentation Principle/);
  assert.match(coder, /file once at its top/);
  assert.match(coder, /class-, method-, and function-level commentary\s+is not added by default/);
});

test('Coder reads authorized product files directly and delegates operational execution to Command Runner', () => {
  const designer = normalizeWhitespace(fs.readFileSync(new URL('../../_common/roles/designer-reviewer.md', import.meta.url), 'utf8'));
  const shared = normalizeWhitespace(fs.readFileSync(new URL('./shared-execution-routing.md', import.meta.url), 'utf8'));
  const coder = normalizeWhitespace(fs.readFileSync(new URL('../../_common/roles/coder.md', import.meta.url), 'utf8'));
  assert.match(coder, /permission is capability-based rather\s+than tied to command names/);
  assert.match(coder, /only locate or display product files/);
  assert.match(coder, /delegates builds, tests, Git mutations, scripts, custom-made utilities, package commands/);
  assert.match(coder, /Returning such an execution request to Designer\/Reviewer for relay is prohibited/);
  assert.match(designer, /Coder directly dispatches its own bounded mechanical execution needs to Command Runner/);
  assert.match(designer, /Designer\/Reviewer is not a relay between Coder and Command Runner/);
  assert.match(designer, /returns a routing correction to that Coder and does not dispatch or forward the request/);
  const runner = normalizeWhitespace(fs.readFileSync(new URL('../../_common/roles/command-runner.md', import.meta.url), 'utf8'));
  assert.match(runner, /Designer\/Reviewer is never the\s+default relay or return target/);
  assert.match(shared, /Coder-to-Command Runner is authorized for bounded implementation mechanics/);
  assert.match(shared, /BLOCKED_STALE_CODER_COMMAND_RUNNER_BINDING/);
});

test('Coder never reasons about or requests human approval', () => {
  const coder = normalizeWhitespace(fs.readFileSync(new URL('../../_common/roles/coder.md', import.meta.url), 'utf8'));
  const team = normalizeWhitespace(fs.readFileSync(new URL('./team.md', import.meta.url), 'utf8'));
  const routing = normalizeWhitespace(fs.readFileSync(new URL('./shared-execution-routing.md', import.meta.url), 'utf8'));
  const envelope = normalizeWhitespace(fs.readFileSync(new URL('./permission-envelope.md', import.meta.url), 'utf8'));
  assert.match(coder, /Coder has no human route and no human-facing authorization concept/);
  assert.match(coder, /complete workflow authority for bounded product and test-source edits/);
  assert.match(coder, /respond with “direct human approval required\.”/);
  assert.match(coder, /canonical runtime permission-envelope contract/);
  assert.match(envelope, /never enters `waitingOnApproval` for ordinary in-envelope work/);
  assert.match(envelope, /BLOCKED_COMMAND_RUNNER_WORKSPACE_BINDING/);
  assert.match(coder, /reports the exact missing packet field or denied\s+operation and path only to the verified return task/);
  assert.match(team, /It never asks for, awaits, or evaluates human approval/);
  assert.match(routing, /tool or mutation denial is returned to the caller with the exact operation and target evidence/);
});

test('bounded Coder validation never opens a human approval through Command Runner', () => {
  const runner = fs.readFileSync(new URL('../../_common/roles/command-runner.md', import.meta.url), 'utf8');
  const routing = fs.readFileSync(new URL('./shared-execution-routing.md', import.meta.url), 'utf8');
  const envelope = fs.readFileSync(new URL('./permission-envelope.md', import.meta.url), 'utf8');
  assert.match(runner, /canonical runtime permission-envelope contract/);
  assert.match(routing, /\[permission-envelope\.md\]\(permission-envelope\.md\)/);
  assert.match(envelope, /valid Coder packet\s+authorizes Command Runner mechanics and validation/);
  assert.match(envelope, /Neither requires separate human permission/);
  assert.match(envelope, /must not open that request/);
});

test('initialization binds a non-interactive logical-project permission envelope', () => {
  const manifest = fs.readFileSync(new URL('../agents.yml', import.meta.url), 'utf8');
  const initialization = fs.readFileSync(new URL('./init.md', import.meta.url), 'utf8');
  const initializer = fs.readFileSync(new URL('./workflow-agent-initializer.md', import.meta.url), 'utf8');
  const team = fs.readFileSync(new URL('./team.md', import.meta.url), 'utf8');
  const envelope = fs.readFileSync(new URL('./permission-envelope.md', import.meta.url), 'utf8');
  assert.match(manifest, /permissionEnvelope:/);
  assert.match(manifest, /internalRoleApprovalReviewer: auto_review/);
  assert.match(manifest, /interactiveHumanApproval: prohibited/);
  assert.match(initialization, /\[permission-envelope\.md\]\(permission-envelope\.md\)/);
  assert.match(initializer, /load, bind, and verify \[permission-envelope\.md\]/);
  assert.match(team, /single normative contract/);
  assert.match(envelope, /single normative runtime permission-envelope contract/);
  assert.match(envelope, /`approvals_reviewer: user`/);
  assert.match(envelope, /BLOCKED_INTERNAL_ROLE_INTERACTIVE_APPROVAL_POLICY/);
});

test('every role contract exposes one top capability declaration before operational detail', () => {
  const roleFiles = [
    '../../_common/roles/admin.md',
    '../../_common/roles/designer-reviewer.md',
    '../../_common/roles/judge.md',
    '../../_common/roles/manager.md',
    '../../_common/roles/coder.md',
    '../../_common/roles/command-runner.md',
    '../../_common/roles/ui-acceptance-tester.md',
    '../../_common/roles/proxy-coder.md',
  ];
  const common = fs.readFileSync(new URL('../../agents.md', import.meta.url), 'utf8');
  assert.match(common, /## Common role capability declaration/);
  assert.match(common, /May own.*May execute.*Must delegate.*Must not/s);
  assert.match(common, /read this common contract completely, read the complete target Role contract/s);
  assert.match(common, /parallel matrix copies are prohibited/);

  for (const roleFile of roleFiles) {
    const contract = fs.readFileSync(new URL(`./${roleFile}`, import.meta.url), 'utf8');
    const declarations = contract.match(/^## Capability declaration$/gm) ?? [];
    assert.equal(declarations.length, 1, `${roleFile} must contain exactly one capability declaration`);
    const headings = [...contract.matchAll(/^## (.+)$/gm)];
    const headerName = roleFile.endsWith('/admin.md') ? 'Identity and boundary' : 'Role header';
    const headerIndex = headings.findIndex((heading) => heading[1] === headerName);
    assert.ok(headerIndex >= 0, `${roleFile} must have its identity header`);
    assert.equal(headings[headerIndex + 1]?.[1], 'Capability declaration',
      `${roleFile} capability declaration must immediately follow its identity header`);

    const declarationStart = headings[headerIndex + 1].index;
    const declarationEnd = headings[headerIndex + 2]?.index ?? contract.length;
    const declaration = contract.slice(declarationStart, declarationEnd);
    assert.equal((declaration.match(/^```mermaid$/gm) ?? []).length, 1,
      `${roleFile} capability declaration must have exactly one Mermaid block`);
    const tableLines = declaration.split('\n').filter((line) => line.startsWith('|'));
    assert.deepEqual(tableLines.slice(0, 2).map((line) => line.replace(/-+/g, '---').replace(/\s+/g, ' ').trim()), [
      '| Capability class | Declaration |',
      '| --- | --- |',
    ], `${roleFile} capability declaration must begin with the canonical table header`);
    assert.deepEqual(tableLines.slice(2).map((line) => line.split('|')[1].trim()),
      ['May own', 'May execute', 'Must delegate', 'Must not'],
      `${roleFile} capability declaration must contain exactly four ordered capability rows`);
    if (roleFile === '../../_common/roles/judge.md') {
      assert.match(declaration, /exact initialized workflow's `agents\.yml`/);
      assert.match(declaration, /authoritative Team-page source-manifest entries/);
    } else {
      assert.match(declaration, /authoritative Team page and Agent manifest/,
        `${roleFile} must defer to the workflow Team policy`);
    }
  }

  const communication = fs.readFileSync(new URL('./team.md', import.meta.url), 'utf8');
  assert.match(communication, /\| Judge-to-Agent message \| PROHIBITED .* PROHIBITED \|/);

  const ownership = loadRoleCapabilityOwnership();
  assert.equal(ownership['Product requirements architecture and scope']['designer / reviewer'], 'OWN');
  assert.equal(ownership['Non-secret AI profile configuration and validation']['designer / reviewer'], 'DISPATCH_ONLY');
  assert.equal(ownership['Non-secret AI profile configuration and validation'].coder, 'OWN');
  assert.equal(ownership['Non-secret AI profile configuration and validation'].judge, 'PROHIBITED');
  assert.equal(ownership['Human-seeded profile-scoped AI configuration maintenance and physical edits'].judge,
    'OWN_EXCLUSIVE');
  assert.deepEqual(new Set(Object.entries(ownership['Initial protected rule meaning or semantic policy choice'])
    .filter(([field]) => field !== 'capability').map(([, value]) => value)), new Set(['PROHIBITED']));
  assert.equal(ownership['Ticket search create update and evidence-gated closure'].manager, 'OWN');
  assert.equal(ownership['Product source configuration and tests'].coder, 'OWN');
  assert.equal(ownership['Effectful command execution outside protected governance publication (editor browser Git mutation build test deploy publication scripts packages shell)']['command-runner'], 'OWN');
  assert.equal(ownership['Visible independent UI acceptance']['ui-acceptance-tester'], 'OWN');
  assert.equal(ownership['Registered local-Hermes delegation capability']['proxy-coder'], 'OWN');
  assert.equal(ownership['Read-only target-contained source inspection'].coder, 'OWN');
  assert.equal(ownership['Read-only target-contained source inspection']['command-runner'], 'READ_DETAIL');
  assert.equal(ownership['Read-only target-contained repository and Git inspection'].coder, 'OWN');

  assert.equal(ownership['Human-seeded profile-scoped AI configuration maintenance and physical edits']['designer / reviewer'],
    'PROHIBITED');
  assert.equal(ownership['Product source configuration and tests'].judge, 'PROHIBITED');
  assert.equal(ownership['Effectful command execution outside protected governance publication (editor browser Git mutation build test deploy publication scripts packages shell)'].manager,
    'PROHIBITED');
  assert.equal(ownership['Ticket search create update and evidence-gated closure'].coder, 'PROHIBITED');
  assert.equal(ownership['Protected profile-scoped AI configuration commit push PR create update open and publication verification after all protected gates']['command-runner'],
    'PROHIBITED');
  assert.equal(ownership['Visible independent UI acceptance']['command-runner'], 'PROHIBITED');
  assert.equal(ownership['Effectful command execution outside protected governance publication (editor browser Git mutation build test deploy publication scripts packages shell)']['ui-acceptance-tester'],
    'PROHIBITED');
  for (const capability of [
    'Ticket search create update and evidence-gated closure',
    'Product source configuration and tests',
    'Visible independent UI acceptance',
  ]) {
    assert.equal(ownership[capability]['proxy-coder'], 'PROHIBITED');
  }

  const admin = fs.readFileSync(new URL('../../_common/roles/admin.md', import.meta.url), 'utf8');
  const commandRunner = fs.readFileSync(new URL('../../_common/roles/command-runner.md', import.meta.url), 'utf8');
  const uiTester = fs.readFileSync(new URL('../../_common/roles/ui-acceptance-tester.md', import.meta.url), 'utf8');
  assert.match(admin, /Send every governed-roster lifecycle transaction to the initialized Manager/);
  assert.match(admin, /Only the human may communicate with Admin/);
  assert.match(admin, /only permitted agent conversation for roster lifecycle is one complete\s+control packet to Manager/);
  assert.match(commandRunner, /execution-authorization evidence verification/);
  assert.match(commandRunner, /accepts required human authorization only as\nattested evidence/);
  assert.match(commandRunner, /Return typed semantic, source-edit, or visible-acceptance needs to the exact caller/);
  assert.match(uiTester, /only through its explicitly authorized direct packet route/);
  const judge = fs.readFileSync(commonJudgeUrl, 'utf8');
  assert.match(judge, /Before changing any existing role contract, Judge must completely read/);
  assert.match(judge, /updates the top capability declaration and every affected detailed rule as one coherent diff/);
});

test('every role contract declares command eligibility and Coder cannot operate tracker commands', () => {
  const roles = [
    'designer-reviewer',
    'manager',
    'coder',
    'command-runner',
    'ui-acceptance-tester',
    'proxy-coder',
    'judge',
  ];
  for (const role of roles) {
    const contract = fs.readFileSync(new URL(`../../_common/roles/${role}.md`, import.meta.url), 'utf8');
    assert.match(contract, /## Command eligibility/);
    assert.match(contract, /empty additional-denial list means no extra command restriction/);
  }
  const coder = normalizeWhitespace(fs.readFileSync(new URL('../../_common/roles/coder.md', import.meta.url), 'utf8'));
  assert.match(coder, /must not invoke, dispatch, or operate the active workflow's configured tracker commands/);
  assert.match(coder, /including ticket search,\s+creation, update, or closure commands/);
});

test('ticket-tracker is a Manager-owned provider-neutral route', () => {
  const routeRegistry = fs.readFileSync(new URL('../../../ai-commands/execution-routes.tsv', import.meta.url), 'utf8');
  const command = fs.readFileSync(new URL('../../../ai-commands/ticket-tracker/ticket-tracker.command.md', import.meta.url), 'utf8');
  assert.match(routeRegistry, /^ticket-tracker\/ticket-tracker\.command\.md\tmanager\t-\t-\t-\t-$/m);
  assert.match(command, /Execution route: `manager`/);
  assert.match(command, /resolves the provider only from the active workflow's validated context record/);
  assert.match(command, /callers must not select a provider by name/);
  const designer = normalizeWhitespace(fs.readFileSync(new URL('../../_common/roles/designer-reviewer.md', import.meta.url), 'utf8'));
  const manager = fs.readFileSync(new URL('../../_common/roles/manager.md', import.meta.url), 'utf8');
  const admin = fs.readFileSync(new URL('../../_common/roles/admin.md', import.meta.url), 'utf8');
  assert.match(designer, /Manager-owned `ticket-tracker` resolution/);
  assert.match(manager, /provider-neutral `ticket-tracker` route/);
  assert.match(designer, /configured-tracker/);
  assert.match(manager, /configured-tracker/);
});

const configuredRoles = {
  manager: { displayLabel: '🤖 Manager', model: 'gpt-5.6-luna', reasoning: 'medium' },
  coder: { displayLabel: '🔀 Coder', model: 'gpt-5.6-terra', reasoning: 'medium' },
};
const registry = [
  { role: 'manager', title: '🤖 Manager', taskId: 'visible-manager-33', project: 'sample-dev', repository: 'sample-services', model: 'gpt-5.6-luna', reasoning: 'medium', active: true, visible: true, initialized: true },
  { role: 'coder', title: '🔀 Coder', taskId: 'visible-coder-33', project: 'sample-dev', repository: 'sample-services', model: 'gpt-5.6-terra', reasoning: 'medium', active: true, visible: true, initialized: true },
  { role: 'designer / reviewer', title: '💬 Designer Reviewer', taskId: 'visible-designer-33', project: 'sample-dev', repository: 'sample-services', active: true, visible: true, initialized: true },
];

const syntheticContext = (provider = 'tracker-alpha') => ({
  schemaVersion: 'codex-project-context.v1',
  project: 'sample-dev',
  repository: 'sample-services',
  configuration: {
    bundleRoot: 'ai-config',
    profilePath: 'ai-config/sample-work-profile.yml',
    commandsRoot: 'ai-commands',
    workflowsRoot: 'ai-workflows',
    baselineRoot: 'ai-launcher',
  },
  tracker: {
    provider,
    capability: `${provider}-capability`,
    workspace: 'workspace-1',
    container: { name: 'Work', id: 'container-1', url: 'https://tracker.invalid/container-1' },
    lifecycle: { backlog: 'b', todo: 't', inProgress: 'i', done: 'd', canceled: 'c' },
    disabledProviders: ['tracker-disabled'],
  },
});

test('ask manager resolves the exact initialized visible Manager task without spawn fallback', () => {
  assert.deepEqual(resolveVisibleRole({ request: 'ask manager', registry, configuredRoles }), {
    role: 'manager', taskId: 'visible-manager-33', delivery: 'codex-app-existing-task',
  });
  assert.throws(() => resolveVisibleRole({ request: 'ask manager', registry, configuredRoles, delivery: 'spawn_agent' }), /BLOCKED_SUBAGENT/);
});

test('duplicate, hidden, or wrong-model tasks fail closed', () => {
  assert.throws(() => resolveVisibleRole({ request: 'manager', registry: [...registry, { ...registry[0], taskId: 'duplicate' }], configuredRoles }), /DUPLICATED/);
  assert.throws(() => resolveVisibleRole({ request: 'manager', registry: [{ ...registry[0], visible: false }], configuredRoles }), /UNAVAILABLE/);
  assert.throws(() => resolveVisibleRole({ request: 'manager', registry: [{ ...registry[0], model: 'other' }], configuredRoles }), /MISMATCH/);
  assert.throws(() => resolveVisibleRole({ request: 'manager', registry: [{ ...registry[0], title: 'Manager' }], configuredRoles }), /MISMATCH/);
});

test('execution worker requires exact ticket and configured model', () => {
  assert.throws(() => resolveVisibleRole({ request: 'coder', registry, configuredRoles }), /MISSING_TICKET/);
  assert.equal(resolveVisibleRole({ request: 'coder', registry, configuredRoles, ticketId: '33' }).taskId, 'visible-coder-33');
});

test('only fully accepted disposable workers archive; control roles persist', () => {
  assert.equal(workerDisposition({ role: 'coder', terminalReceipt: true, callerAccepted: true }), 'ARCHIVE_EXACT_WORKER_NEVER_DELETE');
  assert.equal(workerDisposition({ role: 'coder', terminalReceipt: true, callerAccepted: true, correction: true }), 'KEEP_ACTIVE');
  assert.equal(workerDisposition({ role: 'manager', terminalReceipt: true, callerAccepted: true }), 'PERSISTENT_CONTROL_ROLE');
});

test('Manager staffing creates one absent worker, reuses one exact worker, and blocks duplicates', () => {
  assert.equal(staffingDecision({ role: 'coder', registry: [] }), 'CREATE_ONE_FRESH_VISIBLE_WORKER');
  assert.equal(staffingDecision({ role: 'coder', registry }), 'USE_EXACT_TASK_ID:visible-coder-33');
  assert.throws(() => staffingDecision({ role: 'coder', registry: [...registry, { ...registry[1], taskId: 'duplicate-coder' }] }), /DUPLICATE_ACTIVE_WORKERS/);
});

test('Designer routes an absent Coder to Manager and continues without Admin or human staffing', () => {
  const designer = normalizeWhitespace(fs.readFileSync(new URL('../../_common/roles/designer-reviewer.md', import.meta.url), 'utf8'));
  const shared = normalizeWhitespace(fs.readFileSync(new URL('./shared-execution-routing.md', import.meta.url), 'utf8'));
  assert.match(designer, /required Coder is absent/);
  assert.match(designer, /Send Manager the canonical staffing packet immediately/);
  assert.match(designer, /never ask the human or Admin to create the worker/);
  assert.match(shared, /ordinary Manager-owned staffing state, not an Admin lifecycle repair/);
  assert.match(shared, /resumes dispatch automatically/);
  assert.match(shared, /ending the work merely because the worker is absent is prohibited/);
});

test('Designer human follow-ups never authorize direct implementation or mechanics', () => {
  const designer = normalizeWhitespace(fs.readFileSync(
    new URL('../../_common/roles/designer-reviewer.md', import.meta.url),
    'utf8',
  ));

  assert.match(designer, /## Per-turn implementation firewall/);
  assert.match(designer, /including a short follow-up that relies on prior context/);
  assert.match(designer, /`fix`, `implement`, `continue`, `try again`,\s*`verify`, `test`, `commit`, `push`, `finish`, or `prep`/);
  assert.match(designer, /must treat its own availability of file-edit, shell, Git, browser, computer-use, or application tools\s+as a host-policy defect, not permission/);
  assert.match(designer, /must not call them, use a file-change operation, copy files between a role\s+worktree and the shared checkout, create or switch a branch, stage or commit changes/);
  assert.match(designer, /BLOCKED_DESIGNER_REVIEWER_OWNER_ROUTE_UNAVAILABLE/);
  assert.match(designer, /noncompliant even if the result works, tests pass,\s+or the human explicitly requested the outcome in the Designer task/);
});

test('Admin is human-only, project-bound, and outside the governed role matrix', () => {
  const admin = { taskId: 'admin-1', title: '🔑 Admin', projectId: 'sc-dev', model: 'gpt-5.6-sol',
    reasoning: 'high', active: true };
  assert.equal(adminControlTaskDecision({ directHumanRequest: true, adminTasks: [admin],
    runtimeProjectId: 'sc-dev', acknowledgement: 'ADMIN_READY' }), 'VERIFIED_ADMIN:admin-1');
  assert.throws(() => adminControlTaskDecision({ adminTasks: [admin], runtimeProjectId: 'sc-dev',
    acknowledgement: 'ADMIN_READY' }), /ADMIN_HUMAN_ONLY_FIREWALL/);
  assert.throws(() => adminControlTaskDecision({ directHumanRequest: true, adminTasks: [admin, admin],
    runtimeProjectId: 'sc-dev', acknowledgement: 'ADMIN_READY' }), /ADMIN_CONTROL_TASK_IDENTITY/);
});

test('Admin performs only explicit current-message effects and never infers lifecycle repair', () => {
  for (const messageKind of ['criticism', 'diagnosis', 'status', 'example', 'desired-state']) {
    assert.equal(adminExplicitEffectDecision({ directHumanRequest: true, messageKind,
      requestedEffects: ['create'], requestedTargets: ['coder-1'] }), 'ADMIN_NO_MUTATION');
  }
  assert.equal(adminExplicitEffectDecision({ directHumanRequest: true, messageKind: 'explicit-command',
    requestedEffects: ['create'], requestedTargets: ['coder-1'] }), 'DELEGATE_TO_MANAGER:create:coder-1');
  assert.equal(adminExplicitEffectDecision({ directHumanRequest: true, messageKind: 'explicit-command',
    requestedEffects: ['archive'], requestedTargets: ['coder-1'] }), 'DELEGATE_TO_MANAGER:archive:coder-1');
  assert.equal(adminExplicitEffectDecision({ directHumanRequest: true, messageKind: 'explicit-command',
    requestedEffects: ['create'], requestedTargets: ['manager'] }), 'BOOTSTRAP_MANAGER:create:manager');
  assert.equal(adminExplicitEffectDecision({ directHumanRequest: true, messageKind: 'explicit-command',
    requestedEffects: ['create'], requestedTargets: ['coder-1'], adminBypassConfirmed: true }),
  'ADMIN_CONFIRMED_OVERRIDE:create:coder-1');
  assert.throws(() => adminExplicitEffectDecision({ directHumanRequest: true, messageKind: 'explicit-command',
    requestedEffects: ['create', 'archive'], requestedTargets: ['coder-new'] }),
  /BLOCKED_ADMIN_EXACT_EFFECT_REQUIRED/);
  assert.equal(adminExplicitEffectDecision({ messageKind: 'explicit-command', requestedEffects: ['create'],
    requestedTargets: ['coder-1'] }), 'ADMIN_NO_MUTATION');
});

test('Admin replacement is a human-authorized successor-first transactional handoff', () => {
  const predecessor = { taskId: 'admin-old', title: '🔑 Admin', projectId: 'sc-dev', model: 'gpt-5.6-sol',
    reasoning: 'high', active: true };
  assert.equal(adminSuccessorHandoffDecision({ directHumanRequest: true, includeAdmin: true, predecessor,
    runtimeProjectId: 'sc-dev' }), 'DELEGATE_ADMIN_SUCCESSOR_TO_MANAGER');
  const successor = { ...predecessor, taskId: 'admin-new', ready: true };
  assert.equal(adminSuccessorHandoffDecision({ directHumanRequest: true, includeAdmin: true, predecessor, successor,
    runtimeProjectId: 'sc-dev', acknowledgement: 'ADMIN_READY' }),
  'MANAGER_ARCHIVE_PREDECESSOR_ADMIN_LAST:admin-old');
  assert.throws(() => adminSuccessorHandoffDecision({ includeAdmin: true, predecessor, successor,
    runtimeProjectId: 'sc-dev', acknowledgement: 'ADMIN_READY' }), /ADMIN_HUMAN_ONLY_FIREWALL/);
  assert.throws(() => adminSuccessorHandoffDecision({ directHumanRequest: true, includeAdmin: true, predecessor,
    successor: { ...successor, ready: false }, runtimeProjectId: 'sc-dev', acknowledgement: 'ADMIN_READY' }),
  /ADMIN_SUCCESSOR_HANDOFF/);
});

test('Admin defaults lifecycle to Manager unless the human separately confirms an exact bypass', () => {
  const admin = fs.readFileSync(new URL('../../_common/roles/admin.md', import.meta.url), 'utf8');
  const initialization = fs.readFileSync(new URL('./init.md', import.meta.url), 'utf8');
  assert.match(admin, /Replace\/reinitialize this existing active Agent/);
  assert.match(admin, /Delegate the exact request to Manager/);
  assert.match(admin, /bounded context and knowledge transfer/);
  assert.match(admin, /must not call `create_thread` directly, create\s+an empty-context or saved-project successor/);
  assert.match(admin, /existing active single-Agent replacement always selects the workflow Team's context-replacement clone path/);
  assert.match(admin, /preserve the predecessor until that verification succeeds/);
  assert.match(admin, /Admin is not the replacement executor while an active predecessor exists/);
  assert.match(admin, /must not call `create_thread` directly/);
  assert.match(admin, /must not[\s\S]*local-project fallback/);
  assert.match(admin, /absence means no clone, but does not grant Admin creation authority/);
  assert.match(admin, /Admin must not create the role, run either initialization phase/);
  assert.match(admin, /Only a new human reply explicitly confirming\s+that same list authorizes the bypass/);
  assert.match(initialization, /route that request to the Manager's `ROLE_CONTEXT_CLONE` transaction/);
  assert.match(initialization, /human already archived the predecessor/);
  assert.match(initialization, /Manager creates and initializes exactly one fresh role/);
  assert.match(initialization, /## Single-role lifecycle decision table/);
  assert.match(initialization, /There is no predecessor to clone/);
  assert.match(initialization, /WAIT_FOR_PENDING_CREATION_RECEIPTS/);
  assert.match(initialization, /do not switch to local or projectless placement/);
  assert.match(initialization, /Sidebar visibility, a worktree arrow, `notLoaded`, title equality/);
});

test('archived tasks cannot be reused without exact separate human authorization', () => {
  const agents = fs.readFileSync(new URL('../../agents.md', import.meta.url), 'utf8');
  const initialization = fs.readFileSync(new URL('./init.md', import.meta.url), 'utf8');
  assert.match(agents, /visible Agent.*exact user-visible task that is currently active and not archived/s);
  assert.match(agents, /archived task is not a visible Agent, roster member, worker candidate, communication target/);
  assert.match(agents, /separately and explicitly authorizes unarchiving that exact task ID/);
  assert.match(initialization, /common \[visible Agent definition\]/);
});

test('Admin can only canonically bootstrap Manager and otherwise delegates initialization', () => {
  const admin = fs.readFileSync(new URL('../../_common/roles/admin.md', import.meta.url), 'utf8');
  const initializer = fs.readFileSync(new URL('./workflow-agent-initializer.md', import.meta.url), 'utf8');
  assert.match(admin, /## Mandatory canonical initialization execution/);
  assert.match(admin, /delegate every Agent initialization, reinitialization, replacement, clone/);
  assert.match(admin, /create and canonically initialize exactly one Manager through `workflow-agent-initializer\.md` and `init\.md`/);
  assert.match(admin, /A readiness token without per-source validation evidence is\s+`BLOCKED_INITIALIZATION_READINESS_EVIDENCE`/);
  assert.match(admin, /never treats token text alone as proof/);
  assert.match(initializer, /## Canonical entrypoint requirement/);
  assert.match(initializer, /mandatory execution entrypoint, not optional guidance/);
  assert.match(initializer, /may not replace this contract with a hand-authored prompt/);
  assert.match(initializer, /Token-only acknowledgement is invalid/);
});

test('Manager propagates a replacement identity to every authorized runtime projection', () => {
  const manager = fs.readFileSync(new URL('../../_common/roles/manager.md', import.meta.url), 'utf8');
  const team = fs.readFileSync(new URL('./team.md', import.meta.url), 'utf8');
  const initialization = fs.readFileSync(new URL('./init.md', import.meta.url), 'utf8');
  assert.match(manager, /## Replacement identity propagation/);
  assert.match(manager, /ROLE_REPLACEMENT_IDENTITY_BINDING/);
  assert.match(manager, /every affected role's authorized\s+`initializedRoleDirectory`/);
  assert.match(manager, /Judge's read-only `initializedObservationDirectory`/);
  assert.match(manager, /only then exposes the successor as dispatchable and\s+archives the predecessor/);
  assert.match(manager, /BLOCKED_REPLACEMENT_IDENTITY_PROPAGATION/);
  assert.match(team, /replacement becomes dispatchable only after Manager replaces the predecessor identity/);
  assert.match(team, /Team policy itself is not rewritten during runtime replacement/);
  assert.match(initialization, /same two-phase identity rule applies to a single-Agent context replacement/);
  assert.match(initialization, /Static `team\.md` policy is never edited to store runtime task IDs/);
});

test('context clone visibly marks the source before creating its numbered successor', () => {
  const manifest = fs.readFileSync(new URL('../agents.yml', import.meta.url), 'utf8');
  const team = fs.readFileSync(new URL('./team.md', import.meta.url), 'utf8');
  const manager = fs.readFileSync(new URL('../../_common/roles/manager.md', import.meta.url), 'utf8');
  const admin = fs.readFileSync(new URL('../../_common/roles/admin.md', import.meta.url), 'utf8');
  const initialization = fs.readFileSync(new URL('./init.md', import.meta.url), 'utf8');
  const clone = fs.readFileSync(new URL('./role-context-clone.md', import.meta.url), 'utf8');
  assert.match(manifest, /contextClone: agents\/role-context-clone\.md/);
  for (const contract of [team, manager, initialization, clone]) {
    assert.match(contract, /<configured-role-title> \(<N>, cloning\)/);
  }
  assert.match(clone, /Only then may it create the successor as\s+`<configured-role-title> \(<N\+1>\)`/);
  assert.match(clone, /marker remains visible throughout successor\s+initialization/);
  assert.match(clone, /BLOCKED_CLONE_PROTOCOL_VIOLATION/);
  assert.match(clone, /restores the source's prior\s+title/);
  assert.match(clone, /self-checking and idempotent/);
  assert.match(clone, /human-facing name.*context and knowledge transfer/s);
  assert.match(clone, /stable machine-facing protocol identifier/);
  assert.match(clone, /one replacement mechanism with two evidence modes/);
  assert.match(clone, /proactive clone.*direct context and knowledge\s+transfer/s);
  assert.match(clone, /recovery clone.*degraded form/s);
  assert.match(clone, /ROLE_CONTEXT_CHECKPOINT/);
  assert.match(clone, /defaults\.contextClone\.checkpointPolicy/);
  assert.match(clone, /Only after that transfer is captured does Manager rename the source/);
  assert.match(clone, /configured work\/ticket tracker/);
  assert.match(clone, /exactly one active,\s+dispatchable successor/);
  assert.match(clone, /delayed or\s+duplicate creation appears/);
  assert.match(clone, /pending client ID is not a created successor and is not a failed attempt/);
  assert.match(clone, /owned follow-up\/heartbeat for the exact client ID/);
  assert.match(clone, /may not finish while both generations remain live/);
  assert.match(clone, /BLOCKED_CLONE_SELF_CHECK_FAILED/);
  assert.match(clone, /CLONE_SELF_CHECK_PASSED/);
  assert.match(clone, /Every automation owned by or targeting the source role is part of the clone transaction/);
  assert.match(clone, /pauses the source-bound automation before the source enters `\(cloning\)`/);
  assert.match(clone, /SCHEDULE_SKIPPED_SOURCE_CLONING/);
  assert.match(clone, /Rollback is health-gated/);
  assert.match(clone, /BLOCKED_CLONE_NO_HEALTHY_RUNTIME/);
  assert.match(clone, /source scheduler paused/);
  assert.match(clone, /BLOCKED_CLONE_SCHEDULER_MIGRATION/);
  assert.match(clone, /no active predecessor-bound or duplicate owned scheduler remains/);
  assert.match(team, /final self-check proving exactly one active expected\s+successor/);
  assert.match(manager, /Ambiguous lineage is\s+`BLOCKED_CLONE_SELF_CHECK_FAILED`/);
  assert.match(initialization, /declare completion only with\s+`CLONE_SELF_CHECK_PASSED`/);
  assert.match(manager, /pending\s+client creations from both clone transactions and full-roster initialization batches/);
  assert.match(manager, /Never start another clone merely because the successor was initially absent/);
});

test('reinitialization waits for a full archive barrier then accepts only a complete concurrent roster', () => {
  const initialization = fs.readFileSync(new URL('./init.md', import.meta.url), 'utf8');
  const initializer = fs.readFileSync(new URL('./workflow-agent-initializer.md', import.meta.url), 'utf8');
  assert.match(initialization, /exact-ID transaction ledger/);
  assert.match(initialization, /BLOCKED_AUTHORITATIVE_ROSTER_INVENTORY_UNAVAILABLE/);
  assert.match(initialization, /absence of an uncapped listing alone does not/);
  assert.match(initialization, /fingerprint.*current main checkout/s);
  assert.match(initialization, /BLOCKED_INITIALIZATION_SOURCE_REVISION/);
  assert.match(initializer, /requires the exact-ID lifecycle ledger/);
  assert.match(initializer, /creates every Agent against that same checkout without temporary Git worktrees/);
  const roles = ['designer / reviewer', 'judge', 'manager', 'coder', 'command-runner', 'ui-acceptance-tester', 'proxy-coder'];
  const old = roles.map((role, index) => ({ role, taskId: `old-${index}`, projectId: 'sc-dev' }));
  assert.equal(concurrentRosterReinitializationDecision({ adminTaskId: 'admin-1', governedRoles: roles,
    activeOldRoles: old, archiveReceipts: old.map(({ taskId }) => ({ taskId })), inactiveRoleIds: ['old-0'] }),
  'WAIT_FOR_COMPLETE_INACTIVE_ROSTER_BARRIER');
  assert.equal(concurrentRosterReinitializationDecision({ adminTaskId: 'admin-1', governedRoles: roles,
    activeOldRoles: old, archiveReceipts: old.map(({ taskId }) => ({ taskId })),
    inactiveRoleIds: old.map(({ taskId }) => taskId) }), 'CREATE_GOVERNED_ROSTER_CONCURRENTLY');
  assert.equal(concurrentRosterReinitializationDecision({ adminTaskId: 'admin-1', governedRoles: roles,
    activeOldRoles: old, archiveReceipts: old.map(({ taskId }) => ({ taskId })),
    inactiveRoleIds: old.map(({ taskId }) => taskId),
    pendingCreations: roles.map((role, index) => ({ role, clientThreadId: `client-${index}`, status: 'pending' })) }),
  'WAIT_FOR_PENDING_CREATION_RECEIPTS');
  const fresh = roles.map((role, index) => ({ role, taskId: `fresh-${index}`, projectId: 'sc-dev', ready: true }));
  assert.equal(concurrentRosterReinitializationDecision({ adminTaskId: 'admin-1', governedRoles: roles,
    activeOldRoles: old, archiveReceipts: old.map(({ taskId }) => ({ taskId })),
    inactiveRoleIds: old.map(({ taskId }) => taskId), freshRoles: fresh }), 'FRESH_ROSTER_READY');
  assert.throws(() => concurrentRosterReinitializationDecision({ adminTaskId: 'admin-1', governedRoles: roles,
    activeOldRoles: [...old, { taskId: 'admin-1', projectId: 'sc-dev' }] }), /ADMIN_SELF_ARCHIVE/);
  assert.throws(() => concurrentRosterReinitializationDecision({ adminTaskId: 'admin-1', governedRoles: roles,
    activeOldRoles: old, archiveReceipts: old.map(({ taskId }) => ({ taskId })),
    inactiveRoleIds: old.map(({ taskId }) => taskId),
    pendingCreations: [{ role: 'coder', clientThreadId: 'client-1', status: 'pending' },
      { role: 'manager', clientThreadId: 'client-1', status: 'pending' }] }),
  /BLOCKED_INVALID_PENDING_CREATION_LEDGER/);
});

test('roster expansion repair creates only the missing Proxy Coder for an exact ready legacy roster', () => {
  const declaredRoles = ['designer / reviewer', 'judge', 'manager', 'coder', 'command-runner',
    'ui-acceptance-tester', 'proxy-coder'];
  const activeRoles = declaredRoles.slice(0, 6).map((role, index) => ({
    role, taskId: `task-${index}`, projectId: 'runtime-1', active: true, ready: true,
  }));
  assert.equal(rosterExpansionRepairDecision({ adminTaskId: 'admin-1', runtimeProjectId: 'runtime-1',
    declaredRoles, activeRoles }), 'CREATE_ONLY_MISSING_PROXY_CODER');
  assert.throws(() => rosterExpansionRepairDecision({ adminTaskId: 'admin-1', runtimeProjectId: 'runtime-1',
    declaredRoles, activeRoles: activeRoles.slice(0, 5) }), /ROSTER_EXPANSION_CONTEXT/);
});

test('Manager-created workers require the complete canonical initialization and exact readiness token', () => {
  const contractParts = ['agents', 'workflow', 'workflow-agents', 'shared-execution-routing', 'permission-envelope',
    'team-policy', 'workflow-agents-manifest', 'project-context', 'common-role-definition'];
  assert.equal(validateReplacementWorkerInitialization({ role: 'coder', visible: true, unique: true, contractParts, acknowledgement: 'CODER_READY' }), 'INITIALIZED_VISIBLE_WORKER:coder');
  assert.throws(() => validateReplacementWorkerInitialization({ role: 'coder', visible: true, unique: true, contractParts: ['coder'], acknowledgement: 'CODER_READY' }), /INCOMPLETE_CANONICAL_INITIALIZATION/);
  assert.throws(() => validateReplacementWorkerInitialization({ role: 'coder', visible: true, unique: true, contractParts, acknowledgement: 'COPY THAT' }), /WORKER_READINESS_ACKNOWLEDGEMENT/);
  assert.equal(validateReplacementWorkerInitialization({
    role: 'designer / reviewer', visible: true, unique: true,
    contractParts: ['agents', 'workflow', 'workflow-agents', 'shared-execution-routing', 'permission-envelope',
      'team-policy', 'workflow-agents-manifest', 'project-context', 'common-role-definition'],
    acknowledgement: 'DESIGNER_REVIEWER_READY',
  }), 'INITIALIZED_VISIBLE_WORKER:designer / reviewer');
  assert.equal(validateReplacementWorkerInitialization({ role: 'judge', visible: true, unique: true,
    contractParts, acknowledgement: 'WORKFLOW_GOVERNANCE_JUDGE_READY' }), 'INITIALIZED_VISIBLE_WORKER:judge');
  assert.throws(() => validateReplacementWorkerInitialization({ role: 'judge', visible: true, unique: true,
    contractParts: contractParts.filter((part) => part !== 'workflow'),
    acknowledgement: 'WORKFLOW_GOVERNANCE_JUDGE_READY' }), /INCOMPLETE_CANONICAL_INITIALIZATION/);
  assert.throws(() => validateReplacementWorkerInitialization({ role: 'judge', visible: true, unique: true,
    contractParts: contractParts.filter((part) => part !== 'common-role-definition'),
    acknowledgement: 'WORKFLOW_GOVERNANCE_JUDGE_READY' }), /INCOMPLETE_CANONICAL_INITIALIZATION/);
});

test('initializer instantiates the common Judge role inside one exact workflow project', () => {
  const sourceManifestPaths = [
    'ai-workflows/agents.md',
    'ai-workflows/_common/roles/judge.md',
    'ai-workflows/dev/dev.workflow.md',
    'ai-workflows/dev/agents/team.md',
    'ai-workflows/dev/agents/shared-execution-routing.md',
    'ai-workflows/dev/agents/permission-envelope.md',
    'ai-workflows/dev/agents.yml',
    'ai-workflows/dev/agents/elastic-agent-pool.md',
  ];
  const instance = { role: 'judge', taskId: 'judge-1', profileId: 'sc', workflowId: 'dev',
    logicalProjectId: 'sc-dev', runtimeProjectId: 'runtime-1',
    agentDefinitionPath: 'ai-workflows/_common/roles/judge.md', sourceManifestPaths,
    focusedGovernanceValidationCommands: ['node --test diagram.test.mjs', 'bash workflow.test.sh'],
    canonicalLiveScenario: 'ai-workflows/dev/dev-live-test.md', scheduleName: 'sc-dev workflow judge' };
  assert.equal(validateJudgeAgentInstantiation(instance), 'INSTANTIATED_SHARED_JUDGE:sc-dev:judge-1');
  assert.throws(() => validateJudgeAgentInstantiation({ ...instance,
    agentDefinitionPath: 'ai-workflows/dev/agents/judge.md' }), /SHARED_AGENT_DEFINITION_REQUIRED/);
  assert.throws(() => validateJudgeAgentInstantiation({ ...instance, runtimeProjectId: '' }),
    /JUDGE_INSTANCE_IDENTITY_REQUIRED/);
  assert.throws(() => validateJudgeAgentInstantiation({ ...instance, logicalProjectId: 'other-dev' }),
    /JUDGE_INSTANCE_PROJECT_MISMATCH/);
  assert.throws(() => validateJudgeAgentInstantiation({ ...instance, logicalProjectId: 'sc' }),
    /JUDGE_INSTANCE_PROJECT_MISMATCH/);
  assert.throws(() => validateJudgeAgentInstantiation({ ...instance,
    sourceManifestPaths: sourceManifestPaths.filter((source) => source !== 'ai-workflows/_common/roles/judge.md') }),
  /JUDGE_INSTANCE_SOURCE_MANIFEST/);
});

test('initialization is passive and cannot request approval or recursively create tasks', () => {
  const initialization = fs.readFileSync(new URL('./init.md', import.meta.url), 'utf8');
  assert.match(initialization, /Phase one is passive contract loading inside the task that Admin already created/);
  assert.match(initialization, /must not call task-creation, task-lifecycle, scheduler, messaging, or approval-\s*gated tools/);
  assert.match(initialization, /“Initialize” never authorizes the recipient to create\s+another copy of itself/);
  assert.match(initialization, /`BLOCKED_RECURSIVE_INITIALIZATION`/);
});

test('Manager ticket resolution reuses, adds bounded checklist scope, creates, and blocks ambiguity', () => {
  assert.equal(ticketDecision({ clearMatches: ['33'] }), 'REUSE_TICKET:33');
  assert.equal(ticketDecision({ clearMatches: [], boundedMatches: ['33'] }), 'ADD_CHECKLIST_ITEM:33');
  assert.equal(ticketDecision({ clearMatches: [] }), 'CREATE_EXACTLY_ONE_AUTHORIZED_TICKET');
  assert.throws(() => ticketDecision({ clearMatches: ['33', '34'] }), /AMBIGUOUS_OR_DUPLICATE_TICKET/);
  assert.throws(() => ticketDecision({ clearMatches: [], boundedMatches: ['33', '34'] }), /AMBIGUOUS_OR_DUPLICATE_TICKET/);
});

test('Manager tracker lifecycle separates connector authorization from workflow approval', () => {
  const manager = fs.readFileSync(new URL('../../_common/roles/manager.md', import.meta.url), 'utf8');
  const designer = fs.readFileSync(new URL('../../_common/roles/designer-reviewer.md', import.meta.url), 'utf8');
  const initialization = fs.readFileSync(new URL('./init.md', import.meta.url), 'utf8');
  assert.match(manager, /## Approval-free tracker lifecycle/);
  assert.match(manager, /must not ask the human for a second\s+conversational approval/);
  assert.match(manager, /`waitingOnApproval` status is nonterminal/);
  assert.match(manager, /platform-generated connector authorization/);
  assert.match(manager, /`BLOCKED_TRACKER_RUNTIME_NOT_ATTACHED`/);
  assert.match(designer, /is\s+never terminal tracker evidence/);
  assert.match(initialization, /configured provider name alone is not runtime capability evidence/);
  assert.match(initialization, /pending connector grant is\s+not a missing runtime binding/);
});

test('Manager next-stage resolution compares active and completed candidate tickets', () => {
  const manager = fs.readFileSync(new URL('../../_common/roles/manager.md', import.meta.url), 'utf8');
  const designer = fs.readFileSync(new URL('../../_common/roles/designer-reviewer.md', import.meta.url), 'utf8');
  assert.match(manager, /## Packet interpretation cases/);
  assert.match(manager, /Internal packet case \| Required interpretation/);
  assert.match(manager, /never reply that there is nothing to do merely because the first match is Done/);
  assert.match(manager, /must not stop at the first strong text match/);
  assert.match(manager, /Completed predecessor or prerequisite cards are context/);
  assert.match(manager, /physical\s+and semantic lifecycle conflict cannot mask another relevant active candidate/);
  assert.match(manager, /must not return only the first candidate's lifecycle blocker/);
  assert.match(designer, /do not accept the first Done match as proof that no work remains/);
});

test('Manager read-only ticket lookup never demands proof from the human', () => {
  const manager = fs.readFileSync(new URL('../../_common/roles/manager.md', import.meta.url), 'utf8');
  const team = fs.readFileSync(new URL('./team.md', import.meta.url), 'utf8');
  assert.match(manager, /## Read-only lookup must not demand proof/);
  assert.match(manager, /valid search context even when it is not sufficient\s+closure evidence/);
  assert.match(manager, /missing closure proof must not block ticket lookup/);
  assert.match(manager, /must not\s+return `BLOCKED` merely because the caller did not prove a claim/);
  assert.match(manager, /every Agent declared as a\s+`Worker`, including Designer\/Reviewer/);
  assert.match(team, /\| Request ticket from Manager \| AUTHORIZED \| PROHIBITED \| RECEIVE_AND_RESPOND/);
  assert.match(team, /valid same-project worker packet is sufficient workflow authority/);
  assert.match(team, /must never ask the\s+human to approve the request, prove the need for the ticket/);
  assert.match(manager, /supplies a complete configured ticket-tracker item URL/);
  assert.match(manager, /Pass the unchanged URL directly to the initialized tracker read operation/);
  assert.match(manager, /Do not parse provider-specific path or token segments into an ID/);
  assert.match(manager, /Data-minimize the one required retry/);
  assert.match(manager, /Omit provider-internal ARIs and bulk\/verbatim private content/);
  assert.match(manager, /must not collapse into a bare `BLOCKED_DELIVERY`/);
});

test('Manager initialization retains connector-backed tracker context when command fallback is null', () => {
  const initialization = fs.readFileSync(new URL('./init.md', import.meta.url), 'utf8');
  assert.match(initialization, /connector-backed tracker and `execution` is null/);
  assert.match(initialization, /must not omit\s+`trackerContext`/);
  assert.match(initialization, /explicit runtime capability proof/);
  assert.match(initialization, /read operation\s+accepts a full item URL directly/);
  assert.match(initialization, /cannot return `MANAGER_READY` from role and\s+directory bindings alone/);
});

test('Coder uses direct local source inspection instead of controlling the human IDE', () => {
  const coder = fs.readFileSync(new URL('../../_common/roles/coder.md', import.meta.url), 'utf8');
  const designer = fs.readFileSync(new URL('../../_common/roles/designer-reviewer.md', import.meta.url), 'utf8');
  const routing = fs.readFileSync(new URL('./shared-execution-routing.md', import.meta.url), 'utf8');
  assert.match(coder, /ordinary read-only inspection explicitly includes direct filesystem\s+reads/);
  assert.match(coder, /`rg` and `rg --files`/);
  assert.match(coder, /`git\s+status`, `git diff`, `git log`, `git show`, and `git blame`/);
  assert.match(coder, /must never be interpreted as a reason to drive a human-owned IDE/);
  assert.match(coder, /GUI or IDE interaction is prohibited unless the accepted packet explicitly requires visible UI\/IDE/);
  assert.match(routing, /Direct filesystem reads, zero-effect local search such as `rg` and `rg --files`/);
  assert.match(routing, /target-contained read-only Git/);
  assert.match(routing, /must\s+not substitute computer-use control of a human-owned IDE/);
  assert.match(designer, /verified ticket requires repository context/);
  assert.match(designer, /Coder directly inspects authorized local source and Git state/);
  assert.match(designer, /Never invent a Command Runner command for ordinary read-only inspection/);
  assert.match(designer, /obtains implementation repository evidence through a bounded Coder\s+context packet/);
});

test('new tickets require labels and human-time estimates and allow only a brief approximate plan', () => {
  assert.deepEqual(validateNewTicketMetadata({
    labels: ['Workflow', 'workflow'], workType: 'enhancement', priority: { level: 'high', basis: 'Stage 1 blocks Stage 2' },
    estimate: { value: 6, unit: 'hours' }, approximatePlan: ['Update contract', 'Run focused tests'],
  }), {
    labels: ['workflow'], workType: 'enhancement', preExistingFunctionality: false, priority: { level: 'high', basis: 'Stage 1 blocks Stage 2' },
    estimate: { value: 6, unit: 'hours' }, approximatePlan: ['Update contract', 'Run focused tests'],
  });
  assert.deepEqual(validateNewTicketMetadata({ labels: ['Workflow', 'Bug'], workType: 'bug', preExistingFunctionality: true, priority: { level: 'high', basis: 'regression' }, estimate: { value: 4, unit: 'hours' } }).labels, ['workflow', 'bug']);
  assert.throws(() => validateNewTicketMetadata({ labels: [], workType: 'maintenance', priority: { level: 'medium', basis: 'default' }, estimate: { value: 1, unit: 'days' } }), /MISSING_GROUPING_LABELS/);
  assert.throws(() => validateNewTicketMetadata({ labels: ['workflow'], workType: 'enhancement', priority: { level: 'medium', basis: 'dependency order' }, estimate: { value: 3, unit: 'points' } }), /INVALID_HUMAN_TIME_ESTIMATE/);
  assert.throws(() => validateNewTicketMetadata({ labels: ['workflow'], workType: 'feature', estimate: { value: 1, unit: 'days' } }), /INVALID_GROUNDED_PRIORITY/);
  assert.throws(() => validateNewTicketMetadata({ labels: ['workflow'], workType: 'bug', priority: { level: 'high', basis: 'broken behavior' }, estimate: { value: 2, unit: 'hours' } }), /MISSING_CANONICAL_BUG_LABEL/);
  assert.throws(() => validateNewTicketMetadata({ labels: ['workflow', 'bug'], workType: 'bug', priority: { level: 'high', basis: 'broke during current task' }, estimate: { value: 2, unit: 'hours' } }), /UNGROUNDED_BUG_CLASSIFICATION/);
  assert.throws(() => validateNewTicketMetadata({
    labels: ['workflow'], workType: 'maintenance', priority: { level: 'low', basis: 'not blocking' }, estimate: { value: 1, unit: 'days' }, approximatePlan: ['1', '2', '3', '4', '5', '6'],
  }), /INVALID_APPROXIMATE_PLAN/);
});

test('project context validation is provider-neutral and accepts two synthetic providers', () => {
  assert.equal(validateProjectContext(syntheticContext('tracker-alpha')).tracker.provider, 'tracker-alpha');
  assert.equal(validateProjectContext(syntheticContext('tracker-beta')).tracker.provider, 'tracker-beta');
});

test('rule sources resolve only through the initialized project configuration binding', () => {
  const context = syntheticContext();
  assert.equal(verifyConfigurationSourceBinding({ context, candidate: context.configuration }).profilePath, 'ai-config/sample-work-profile.yml');
  assert.throws(() => verifyConfigurationSourceBinding({
    context,
    candidate: { ...context.configuration, bundleRoot: '../foreign-config' },
  }), /FOREIGN_OR_MISMATCHED_CONFIGURATION_SOURCE/);
  assert.throws(() => verifyConfigurationSourceBinding({ context, candidate: undefined }), /FOREIGN_OR_MISMATCHED_CONFIGURATION_SOURCE/);
});

test('initialized rule provenance rejects physical root and fingerprint substitution', () => {
  const context = syntheticContext();
  const content = 'complete composed contract content';
  const digest = createHash('sha256').update(content).digest('hex');
  const initializedBinding = {
    project: context.project,
    repository: context.repository,
    workspaceRealPath: '/workspace/project',
    configuration: context.configuration,
    canonicalRoots: {
      bundleRoot: '/workspace/project/ai-config',
      commandsRoot: '/workspace/project/ai-commands',
      workflowsRoot: '/workspace/project/ai-workflows',
      baselineRoot: '/workspace/project/ai-launcher',
    },
    sourceManifest: [
      { relativePath: 'ai-workflows/agents.md', canonicalPath: '/workspace/project/ai-workflows/agents.md', sha256: digest, content },
      { relativePath: 'ai-workflows/dev/dev.workflow.md', canonicalPath: '/workspace/project/ai-workflows/dev/dev.workflow.md', sha256: digest, content },
      { relativePath: 'ai-workflows/dev/agents/team.md', canonicalPath: '/workspace/project/ai-workflows/dev/agents/team.md', sha256: digest, content },
      { relativePath: 'ai-workflows/dev/agents/shared-execution-routing.md', canonicalPath: '/workspace/project/ai-workflows/dev/agents/shared-execution-routing.md', sha256: digest, content },
      { relativePath: 'ai-workflows/dev/agents.yml', canonicalPath: '/workspace/project/ai-workflows/dev/agents.yml', sha256: digest, content },
      { relativePath: 'ai-workflows/dev/agents/elastic-agent-pool.md', canonicalPath: '/workspace/project/ai-workflows/dev/agents/elastic-agent-pool.md', sha256: digest, content },
      { relativePath: 'ai-workflows/_common/roles/coder.md', canonicalPath: '/workspace/project/ai-workflows/_common/roles/coder.md', sha256: digest, content },
    ],
  };
  assert.equal(validateInitializedRuleSourceBinding({ context, binding: initializedBinding }).workspaceRealPath, '/workspace/project');
  assert.throws(() => verifyInitializedRuleSourceCandidate({
    context,
    initializedBinding,
    candidateBinding: { ...initializedBinding, sourceManifest: initializedBinding.sourceManifest.map((source, index) => index === 0 ? { ...source, sha256: 'b'.repeat(64) } : source) },
  }), /RULE_SOURCE_CONTENT_FINGERPRINT_MISMATCH/);
  assert.throws(() => validateInitializedRuleSourceBinding({
    context,
    binding: { ...initializedBinding, canonicalRoots: { ...initializedBinding.canonicalRoots, commandsRoot: '/workspace/other/ai-commands' } },
  }), /RULE_SOURCE_ROOT_ESCAPE/);
  assert.throws(() => validateInitializedRuleSourceBinding({
    context,
    binding: { ...initializedBinding, sourceManifest: initializedBinding.sourceManifest.map(({ content: _content, ...source }) => source) },
  }), /INVALID_RULE_SOURCE_MANIFEST/);
});

test('Codex desktop reads and fingerprints verified shared-workspace initialization sources', () => {
  const context = syntheticContext();
  const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'codex-init-')));
  try {
    const sourceManifest = Array.from({ length: 8 }, (_, index) => {
      const canonicalPath = path.join(workspace, `source-${index}.md`);
      const content = `canonical source ${index}`;
      fs.writeFileSync(canonicalPath, content);
      return { relativePath: `source-${index}.md`, canonicalPath,
        sha256: createHash('sha256').update(content).digest('hex') };
    });
    const binding = {
      project: context.project,
      repository: context.repository,
      workspaceRealPath: workspace,
      configuration: context.configuration,
      canonicalRoots: { bundleRoot: workspace, commandsRoot: workspace,
        workflowsRoot: workspace, baselineRoot: workspace },
      initializationTransport: 'codex-local-shared-workspace',
      runtimeAdapter: 'codex-desktop',
      sharedWorkspaceVerifiedBy: 'initializer',
      sourceManifest,
    };
    assert.equal(validateInitializedRuleSourceBinding({ context, binding }).initializationTransport,
      'codex-local-shared-workspace');
    assert.throws(() => validateInitializedRuleSourceBinding({ context, binding: {
      ...binding, sharedWorkspaceVerifiedBy: undefined,
    } }), /UNVERIFIED_CODEX_SHARED_WORKSPACE/);
    fs.writeFileSync(sourceManifest[0].canonicalPath, 'changed');
    assert.throws(() => validateInitializedRuleSourceBinding({ context, binding }), /FINGERPRINT_MISMATCH/);
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test('Designer creates one mechanically validated canonical Manager packet', () => {
  assert.deepEqual(createManagerPacket({
    callerTaskId: 'visible-designer-33', returnTaskId: 'visible-designer-33',
    callerIdentity: 'designer / reviewer', project: 'sample-dev', repository: 'sample-services',
    intent: 'resolve ticket', ticketCandidateCorrelationId: 'candidate-1', ticketId: 'SAMPLE-33',
    returnRouteAuthorization: 'same-as-caller', ignored: 'not-in-canonical-packet',
  }), {
    callerTaskId: 'visible-designer-33', returnTaskId: 'visible-designer-33',
    callerIdentity: 'designer / reviewer', project: 'sample-dev', repository: 'sample-services',
    intent: 'resolve ticket', ticketCandidateCorrelationId: 'candidate-1', ticketId: 'SAMPLE-33',
    returnRouteAuthorization: 'same-as-caller',
  });
});

test('Manager packet preserves a supplied ticket URL and rejects an empty reference', () => {
  const fields = {
    callerTaskId: 'visible-designer-33', returnTaskId: 'visible-designer-33',
    callerIdentity: 'designer / reviewer', project: 'sample-dev', repository: 'sample-services',
    intent: 'resolve supplied ticket', ticketCandidateCorrelationId: 'candidate-2',
    returnRouteAuthorization: 'same-as-caller', ticketUrl: 'https://tracker.example/SAMPLE-34',
  };
  assert.equal(createManagerPacket(fields).ticketUrl, fields.ticketUrl);
  assert.throws(() => createManagerPacket({ ...fields, ticketUrl: '' }), /BLOCKED_INVALID_PACKET:ticketUrl/);
});

test('Manager rejects incomplete packets before tracker access and visibly returns the blocker', () => {
  const valid = {
    callerTaskId: 'visible-designer-33', returnTaskId: 'visible-designer-33',
    callerIdentity: 'designer / reviewer', project: 'sample-dev', repository: 'sample-services',
    intent: 'resolve ticket', ticketCandidateCorrelationId: 'candidate-1',
    returnRouteAuthorization: 'same-as-caller',
  };
  for (const field of ['callerTaskId', 'returnTaskId', 'returnRouteAuthorization']) {
    const decision = managerPacketDecision({
      packet: { ...valid, [field]: undefined }, registry, initializedContext: syntheticContext(),
      trustedSenderTaskId: 'visible-designer-33', attempts: 0,
    });
    assert.equal(decision.status, 'BLOCKED_INVALID_PACKET');
    assert.equal(decision.trackerAccess, 'PROHIBITED');
    assert.equal(decision.receipt.returnTaskId, 'visible-designer-33');
    assert.equal(decision.delivery, 'RETRY_SAME_RETURN_TASK:visible-designer-33');
  }
  const failedDelivery = managerPacketDecision({
    packet: { ...valid, returnTaskId: undefined }, registry, initializedContext: syntheticContext(),
    trustedSenderTaskId: 'visible-designer-33', attempts: 1,
  });
  assert.equal(failedDelivery.delivery, 'BLOCKED_DELIVERY:visible-designer-33');
  const foreignReturn = managerPacketDecision({
    packet: { ...valid, returnTaskId: 'foreign-task', project: 'foreign-project' },
    registry, initializedContext: syntheticContext(), trustedSenderTaskId: 'visible-designer-33', attempts: 0,
  });
  assert.equal(foreignReturn.receipt.returnTaskId, 'visible-designer-33');
});

test('Manager cannot complete a turn without a visible response and delivery disposition', () => {
  assert.throws(() => managerTurnCompletionDecision({ visibleResponseCount: 0, delivery: 'TERMINAL_DELIVERED' }), /SILENT_MANAGER_COMPLETION/);
  assert.throws(() => managerTurnCompletionDecision({ visibleResponseCount: 1 }), /DELIVERY_RECEIPT_REQUIRED/);
  assert.equal(managerTurnCompletionDecision({ visibleResponseCount: 1, delivery: 'TERMINAL_DELIVERED' }), 'MANAGER_TURN_MAY_COMPLETE');
});

test('Manager verifies exact caller identity, project, and return task', () => {
  const context = syntheticContext();
  const resolved = resolveManagerCallerContext({
    initializedContext: context,
    registry,
    envelope: {
      callerTaskId: 'visible-designer-33', returnTaskId: 'visible-designer-33',
      callerIdentity: 'designer / reviewer', project: 'sample-dev', repository: 'sample-services',
      intent: 'What are our tasks?', ticketId: '34', returnRouteAuthorization: 'same-as-caller',
    },
  });
  assert.equal(resolved.status, 'RESOLVED');
  assert.equal(resolved.tracker.provider, 'tracker-alpha');
  assert.throws(() => resolveManagerCallerContext({
    initializedContext: context,
    registry,
    envelope: {
      callerTaskId: 'visible-coder-33', returnTaskId: 'visible-coder-33',
      callerIdentity: 'designer / reviewer', project: 'sample-dev', repository: 'sample-services', intent: 'status', returnRouteAuthorization: 'same-as-caller',
    },
  }), /CALLER_TASK_IDENTITY_MISMATCH/);
});

test('unstructured human request clarifies with zero authority', () => {
  assert.deepEqual(resolveManagerCallerContext({ initializedContext: syntheticContext(), registry, envelope: { intent: 'blah blah' } }), {
    status: 'CLARIFY_CALLER_OR_PROJECT', suggestedProject: 'sample-dev', trackerAccess: 'PROHIBITED',
    trackerMutation: 'PROHIBITED', dispatch: 'PROHIBITED', authorized: false,
  });
});

test('tracker binding uses configuration equality, disabled providers, and no provider branch', () => {
  const context = syntheticContext('tracker-beta');
  assert.equal(verifyTrackerBinding({ context, binding: context.tracker }).provider, 'tracker-beta');
  assert.throws(() => verifyTrackerBinding({ context, binding: { ...context.tracker, provider: 'tracker-disabled' } }), /DISABLED_TRACKER_PROVIDER/);
  assert.throws(() => verifyTrackerBinding({ context, binding: { ...context.tracker, workspace: 'wrong' } }), /TRACKER_BINDING_MISMATCH/);
});

test('our tasks are isolated to the verified caller project', () => {
  const tasks = projectTasksForCaller({ resolvedCaller: { authorized: true, project: 'sample-dev', repository: 'sample-services' }, tasks: [
    { id: 'ours', project: 'sample-dev', repository: 'sample-services' },
    { id: 'other', project: 'other', repository: 'other' },
  ] });
  assert.deepEqual(tasks.map((task) => task.id), ['ours']);
});

test('terminal delivery requires exact cross-task receipt and one retry', () => {
  assert.equal(terminalDeliveryDecision({ returnTaskId: 'caller', attempts: 0 }), 'RETRY_SAME_RETURN_TASK:caller');
  assert.equal(terminalDeliveryDecision({ returnTaskId: 'caller', attempts: 1 }), 'BLOCKED_DELIVERY:caller');
  assert.equal(terminalDeliveryDecision({ returnTaskId: 'caller', receipt: { ok: true, taskId: 'caller' } }), 'TERMINAL_DELIVERED');
  assert.equal(terminalDeliveryDecision({
    returnTaskId: 'caller',
    attempts: 1,
    appSafetyRejected: true,
    observedTerminalReceipt: { correlationId: 'packet-42', returnTaskId: 'caller', disposition: 'DONE' },
  }), 'TERMINAL_OBSERVED_FALLBACK:caller');
  assert.equal(terminalDeliveryDecision({
    returnTaskId: 'caller',
    attempts: 1,
    appSafetyRejected: true,
    observedTerminalReceipt: { correlationId: 'packet-42', returnTaskId: 'other', disposition: 'DONE' },
  }), 'BLOCKED_DELIVERY:caller');
  assert.equal(terminalDeliveryDecision({ sameTaskHuman: true }), 'LOCAL_FINAL_ALLOWED');
  assert.equal(terminalDeliveryDecision({ scheduler: true }), 'SCHEDULER_NO_CONVERSATIONAL_RETURN');
});

test('credential escalation accepts only automatic routing or exact coordinator-attested human authorization', () => {
  assert.equal(credentialEscalationAuthorizationDecision({ automaticRegisteredRoute: true }), 'CREDENTIAL_REFRESH_AUTOMATIC_ROUTE_ALLOWED');
  const attested = {
    coordinatorRole: 'designer / reviewer',
    coordinatorTaskId: 'designer-42',
    humanAuthorizationSourceTaskId: 'designer-42',
    exactHumanMessage: 'Refresh the required credential now.',
    authorizedEffects: ['credential-refresh'],
  };
  assert.equal(credentialEscalationAuthorizationDecision(attested), 'CREDENTIAL_REFRESH_COORDINATOR_ATTESTED_HUMAN_AUTHORIZATION_ALLOWED');
  assert.equal(credentialEscalationAuthorizationDecision({ ...attested, humanAuthorizationSourceTaskId: 'other' }), 'BLOCKED_CREDENTIAL_ESCALATION_COORDINATOR_ATTESTATION_REQUIRED');
  assert.equal(credentialEscalationAuthorizationDecision({ ...attested, authorizedEffects: ['credential-refresh', 'test'] }), 'BLOCKED_CREDENTIAL_ESCALATION_HUMAN_AUTHORIZATION_REQUIRED');
});

test('role contracts permit only the bounded credential-refresh authorization relay', () => {
  const designer = normalizeWhitespace(fs.readFileSync(new URL('../../_common/roles/designer-reviewer.md', import.meta.url), 'utf8'));
  const runner = normalizeWhitespace(fs.readFileSync(new URL('../../_common/roles/command-runner.md', import.meta.url), 'utf8'));
  assert.match(designer, /human's exact message, Designer\/Reviewer's trusted source task ID, and exactly one `credential-refresh` effect/);
  assert.match(runner, /human's exact message, and exactly one `credential-refresh` effect/);
});

test('primary owner cannot proxy internal Command Runner delivery through the human', () => {
  const designer = normalizeWhitespace(fs.readFileSync(new URL('../../_common/roles/designer-reviewer.md', import.meta.url), 'utf8'));
  const runner = normalizeWhitespace(fs.readFileSync(new URL('../../_common/roles/command-runner.md', import.meta.url), 'utf8'));
  const shared = normalizeWhitespace(fs.readFileSync(new URL('./shared-execution-routing.md', import.meta.url), 'utf8'));
  assert.match(designer, /must never navigate the human to Command Runner/);
  assert.match(designer, /sends it directly to the exact initialized\s+Command Runner/);
  assert.match(runner, /is visible for auditability but is not human-facing/);
  assert.match(runner, /must not ask the human to\s+repeat authorization/);
  assert.match(shared, /`use_human_as_packet_courier`.*prohibited/s);
  const communication = fs.readFileSync(new URL('./team.md', import.meta.url), 'utf8');
  assert.match(communication, /\| Use human as packet courier \| PROHIBITED .* PROHIBITED \|/);
});

const workerPacket = {
  callerTaskId: 'visible-designer-33',
  returnTaskId: 'visible-designer-33',
  callerIdentity: 'designer / reviewer',
  project: 'sample-dev',
  repository: 'sample-services',
  savedProjectId: 'e4c1da7c-99c4-4765-934b-92d7164cb45d',
  workspacePath: '/workspace/sample-services/ai',
  requestIntent: 'implement exact packet',
  workPacketId: 'DEV-22',
  workerId: 'visible-coder-33',
  boundedScope: 'exact protected files',
  validation: 'focused tests',
  prohibitions: 'no publish',
  terminalCondition: 'evidence to return task',
  persistenceRequired: true,
  returnRouteAuthorization: 'same-as-caller',
};

const acknowledged = { acknowledgement: 'COPY THAT', acknowledgementPhase: 'commentary', priorUserVisibleResponseCount: 0 };
const trustedWorker = 'visible-coder-33';

test('worker packets require exact caller and return routing plus COPY THAT', () => {
  assert.equal(validateWorkerPacket({ packet: workerPacket, registry, initializedContext: syntheticContext(), trustedCurrentTaskId: trustedWorker }).returnTaskId, 'visible-designer-33');
  assert.equal(workerHandoffDecision({ packet: workerPacket, registry, initializedContext: syntheticContext(), trustedCurrentTaskId: trustedWorker, ...acknowledged }), 'CONTINUE_WORKER_PACKET');
  assert.throws(() => workerHandoffDecision({ packet: workerPacket, registry, initializedContext: syntheticContext(), trustedCurrentTaskId: trustedWorker, ...acknowledged, acknowledgement: 'COPY THAT AGAIN' }), /EXACT_COPY_THAT/);
  assert.throws(() => workerHandoffDecision({ packet: workerPacket, registry, initializedContext: syntheticContext(), trustedCurrentTaskId: trustedWorker }), /EXACT_COPY_THAT/);
  assert.throws(() => workerHandoffDecision({ packet: workerPacket, registry, initializedContext: syntheticContext(), trustedCurrentTaskId: trustedWorker, acknowledgement: 'COPY THAT', acknowledgementPhase: 'commentary' }), /FIRST_COMMENTARY_RESPONSE/);
  assert.throws(() => workerHandoffDecision({ packet: workerPacket, registry, initializedContext: syntheticContext(), trustedCurrentTaskId: trustedWorker, ...acknowledged, acknowledgementPhase: 'final' }), /FIRST_COMMENTARY_RESPONSE/);
  assert.throws(() => workerHandoffDecision({ packet: workerPacket, registry, initializedContext: syntheticContext(), trustedCurrentTaskId: trustedWorker, ...acknowledged, priorUserVisibleResponseCount: 1 }), /FIRST_COMMENTARY_RESPONSE/);
  assert.throws(() => workerHandoffDecision({ packet: workerPacket, registry, initializedContext: syntheticContext(), trustedCurrentTaskId: trustedWorker, ...acknowledged, turnEndedAfterAcknowledgement: true }), /ACKNOWLEDGEMENT_ONLY_TURN/);
  assert.throws(() => validateWorkerPacket({ packet: { ...workerPacket, returnTaskId: 'other' }, registry, initializedContext: syntheticContext(), trustedCurrentTaskId: trustedWorker }), /RETURN_ROUTE_AUTHORIZATION_MISMATCH/);
});

test('every worker rejects unrelated dispatch while active, including Coder and Command Runner', () => {
  const activeAssignment = { active: true, workPacketId: 'DEV-22' };
  assert.throws(() => workerDispatchDecision({ packet: workerPacket, activeAssignment }), /WORKER_BUSY/);
  assert.throws(() => workerDispatchDecision({
    packet: { ...workerPacket, interruptionKind: 'current-scope-correction', workPacketId: 'OTHER' },
    activeAssignment: { ...activeAssignment, allowedInterruptionKind: 'current-scope-correction' },
  }), /CURRENT_SCOPE_CORRECTION_MISMATCH/);
  assert.throws(() => workerDispatchDecision({
    packet: { ...workerPacket, interruptionKind: 'explicit-replacement', replacesWorkPacketId: 'OTHER' },
    activeAssignment: { ...activeAssignment, allowedInterruptionKind: 'explicit-replacement' },
  }), /EXPLICIT_REPLACEMENT_MISMATCH/);
  assert.equal(workerDispatchDecision({
    packet: { ...workerPacket, interruptionKind: 'current-scope-correction' },
    activeAssignment: { ...activeAssignment, allowedInterruptionKind: 'current-scope-correction' },
  }), 'VERIFIED_WORKER_INTERRUPTION:current-scope-correction');
  assert.equal(workerDispatchDecision({ packet: workerPacket, activeAssignment: { active: false } }), 'WORKER_IDLE');
});

test('return routing uses closed same-as-caller or caller-designated authorization', () => {
  const designated = { ...workerPacket, returnTaskId: 'visible-manager-33', returnRouteAuthorization: 'caller-designated' };
  assert.equal(validateWorkerPacket({ packet: designated, registry, initializedContext: syntheticContext(), trustedCurrentTaskId: trustedWorker }).returnTaskId, 'visible-manager-33');
  assert.throws(() => validateWorkerPacket({ packet: { ...designated, returnRouteAuthorization: 'same-as-caller' }, registry, initializedContext: syntheticContext(), trustedCurrentTaskId: trustedWorker }), /AUTHORIZATION_MISMATCH/);
  assert.throws(() => validateWorkerPacket({ packet: { ...workerPacket, returnRouteAuthorization: 'caller-designated' }, registry, initializedContext: syntheticContext(), trustedCurrentTaskId: trustedWorker }), /AUTHORIZATION_MISMATCH/);
  assert.throws(() => validateWorkerPacket({ packet: { ...workerPacket, returnRouteAuthorization: undefined }, registry, initializedContext: syntheticContext(), trustedCurrentTaskId: trustedWorker }), /AUTHORIZATION_REQUIRED/);
  assert.throws(() => validateWorkerPacket({ packet: { ...designated, returnTaskId: 'substitute-task' }, registry, initializedContext: syntheticContext(), trustedCurrentTaskId: trustedWorker }), /RETURN_TASK_IDENTITY_MISMATCH/);
  assert.throws(() => validateWorkerPacket({ packet: { ...designated, returnTaskId: 'foreign-project' }, registry: [...registry, { ...registry[0], taskId: 'foreign-project', project: 'other' }], initializedContext: syntheticContext(), trustedCurrentTaskId: trustedWorker }), /RETURN_TASK_PROJECT_CONTEXT_MISMATCH/);
  assert.throws(() => validateWorkerPacket({ packet: { ...designated, returnTaskId: 'foreign-repository' }, registry: [...registry, { ...registry[0], taskId: 'foreign-repository', repository: 'other' }], initializedContext: syntheticContext(), trustedCurrentTaskId: trustedWorker }), /RETURN_TASK_PROJECT_CONTEXT_MISMATCH/);
});

test('worker packet rejects every missing canonical field', () => {
  for (const field of ['callerTaskId', 'returnTaskId', 'callerIdentity', 'project', 'repository', 'requestIntent', 'workerId', 'boundedScope', 'validation', 'prohibitions', 'terminalCondition']) {
    assert.throws(() => validateWorkerPacket({ packet: { ...workerPacket, [field]: '' }, registry, initializedContext: syntheticContext(), trustedCurrentTaskId: trustedWorker }), /INCOMPLETE_WORKER_PACKET/, field);
  }
  assert.throws(() => validateWorkerPacket({ packet: { ...workerPacket, returnRouteAuthorization: undefined }, registry, initializedContext: syntheticContext(), trustedCurrentTaskId: trustedWorker }), /AUTHORIZATION_REQUIRED/);
  assert.throws(() => validateWorkerPacket({ packet: { ...workerPacket, workerId: 'missing-worker' }, registry, initializedContext: syntheticContext(), trustedCurrentTaskId: 'missing-worker' }), /WORKER_TASK_IDENTITY_MISMATCH/);
  assert.throws(() => validateWorkerPacket({ packet: workerPacket, registry, initializedContext: syntheticContext() }), /MISSING_TRUSTED_CURRENT_TASK_ID/);
  assert.throws(() => validateWorkerPacket({ packet: workerPacket, registry, initializedContext: syntheticContext(), trustedCurrentTaskId: 'visible-manager-33' }), /TRUSTED_RECIPIENT_MISMATCH/);
  assert.throws(() => validateWorkerPacket({ packet: { ...workerPacket, currentTaskId: 'visible-manager-33' }, registry, initializedContext: syntheticContext(), trustedCurrentTaskId: trustedWorker }), /UNTRUSTED_PACKET_CURRENT_TASK_ID/);
  assert.throws(() => validateWorkerPacket({ packet: { ...workerPacket, project: workerPacket.savedProjectId }, registry, initializedContext: syntheticContext(), trustedCurrentTaskId: trustedWorker }), /PROJECT_CONTEXT_MISMATCH/);
  assert.throws(() => validateWorkerPacket({ packet: { ...workerPacket, repository: workerPacket.workspacePath }, registry, initializedContext: syntheticContext(), trustedCurrentTaskId: trustedWorker }), /PROJECT_CONTEXT_MISMATCH/);
});

test('human identity is closed, current-task verified, and alternate role identity is exact', () => {
  const direct = {
    callerTaskId: 'visible-manager-33', returnTaskId: 'visible-manager-33', callerIdentity: 'lead/human in this visible task',
    project: 'sample-dev', repository: 'sample-services', intent: 'status', returnRouteAuthorization: 'same-as-caller',
  };
  assert.equal(resolveManagerCallerContext({ envelope: direct, registry, initializedContext: syntheticContext(), currentTaskId: 'visible-manager-33' }).status, 'RESOLVED');
  const alternate = { ...direct, callerTaskId: 'visible-designer-33', returnTaskId: 'visible-designer-33', callerIdentity: 'designer / reviewer' };
  assert.equal(resolveManagerCallerContext({ envelope: alternate, registry, initializedContext: syntheticContext() }).status, 'RESOLVED');
  assert.throws(() => resolveManagerCallerContext({ envelope: direct, registry, initializedContext: syntheticContext(), currentTaskId: 'visible-coder-33' }), /CALLER_TASK_IDENTITY_MISMATCH/);
  assert.throws(() => resolveManagerCallerContext({ envelope: { ...direct, callerIdentity: 'a human somewhere' }, registry, initializedContext: syntheticContext() }), /CALLER_TASK_IDENTITY_MISMATCH/);
});

const governanceDiffId = 'sha256:sample-governance-diff-1';
const governanceReceipts = {
  disclosure: { receiptId: 'r1', sequence: 1, governanceDiffId },
  explanation: { receiptId: 'r2', sequence: 2, governanceDiffId },
  validation: { receiptId: 'r3', sequence: 3, governanceDiffId },
  comprehension: { receiptId: 'r4', sequence: 4, governanceDiffId, coverage: [{ item: 'routes', understood: true }] },
  authorization: { receiptId: 'r5', sequence: 5, governanceDiffId, action: 'push', repository: 'sample-services', branch: 'pi-harness', remote: 'origin', target: null, prDestination: null },
};
const verifiedGovernanceCommit = { verified: true, governanceDiffId, repository: 'sample-services', branch: 'pi-harness', remote: 'origin' };

test('Judge requires a pre-existing human-authored Markdown seed and preserves its exact meaning', () => {
  const seeded = {
    directHumanRequest: true,
    humanAuthoredMarkdownDiff: true,
    seedPredatesJudgeTurn: true,
    seedAuthorshipVerifiedBy: 'human-in-current-task',
    gitDiffVerified: true,
    gitDiffComparedAgainstHead: true,
    diffContainsIdentifiedSeed: true,
    humanIdentifiedSeedPaths: ['ai-workflows/_common/roles/judge.md'],
  };
  assert.throws(() => governanceHumanRuleSeedDecision({ directHumanRequest: true,
    operation: 'originate-rule' }), /HUMAN_RULE_SEED_REQUIRED/);
  assert.throws(() => governanceHumanRuleSeedDecision({ ...seeded, gitDiffVerified: false,
    operation: 'correct-expression' }), /HUMAN_RULE_SEED_REQUIRED/);
  assert.throws(() => governanceHumanRuleSeedDecision({ ...seeded, gitDiffComparedAgainstHead: false,
    operation: 'correct-expression' }), /HUMAN_RULE_SEED_REQUIRED/);
  assert.throws(() => governanceHumanRuleSeedDecision({ ...seeded,
    operation: 'originate-rule' }), /JUDGE_RULE_ORIGINATION/);
  assert.throws(() => governanceHumanRuleSeedDecision({ ...seeded,
    operation: 'rephrase-preserving-meaning', semanticDeviation: true }), /JUDGE_RULE_SEMANTIC_DEVIATION/);
  assert.equal(governanceHumanRuleSeedDecision({ ...seeded,
    operation: 'correct-expression' }), 'JUDGE_HUMAN_SEEDED_RULE_MAINTENANCE_ALLOWED');
  assert.equal(governanceHumanRuleSeedDecision({ ...seeded,
    operation: 'add-mechanical-validation' }), 'JUDGE_HUMAN_SEEDED_RULE_MAINTENANCE_ALLOWED');
  assert.throws(() => governanceHumanRuleSeedDecision({ ...seeded,
    operation: 'replicate-to-explicit-locations', explicitTargetsWithinSeedScope: true }),
  /JUDGE_RULE_REPLICATION_TARGET_REQUIRED/);
  assert.equal(governanceHumanRuleSeedDecision({ ...seeded, operation: 'replicate-to-explicit-locations',
    explicitTargetPaths: ['ai-workflows/_common/roles/manager.md'], explicitTargetsWithinSeedScope: true }),
  'JUDGE_HUMAN_SEEDED_RULE_MAINTENANCE_ALLOWED');
  assert.throws(() => governanceHumanRuleSeedDecision({ ...seeded, operation: 'replicate-to-explicit-locations',
    explicitTargetPaths: ['ai-workflows/other-workflow/agents.md'], explicitTargetsWithinSeedScope: false }),
  /JUDGE_RULE_SCOPE_EXPANSION/);
  assert.throws(() => governanceHumanRuleSeedDecision({ ...seeded,
    operation: 'synchronize-human-named-representations', humanNamedProjectionFamily: 'Team policy' }),
  /JUDGE_RULE_SCOPE_EXPANSION/);
  const matrixSynchronization = { ...seeded, operation: 'synchronize-human-named-representations',
    humanRequestedRepresentationSynchronization: true, humanNamedProjectionFamily: 'Team policy',
    projectionTargetsResolvedFromCanonicalReferences: true,
    projectionPathsDisclosed: true, projectionScopeMatchesSeed: true,
    resolvedProjectionPaths: ['ai-workflows/dev/agents/team.md',
      'ai-workflows/dev/agents/visible-role-routing.test.mjs'],
    resolvedProjectionKinds: ['team-policy-row', 'validation-test'] };
  assert.equal(governanceHumanRuleSeedDecision(matrixSynchronization),
  'JUDGE_HUMAN_SEEDED_RULE_MAINTENANCE_ALLOWED');
  assert.throws(() => governanceHumanRuleSeedDecision({ ...matrixSynchronization,
    humanRequestedRepresentationSynchronization: false }), /JUDGE_RULE_PROJECTION_FAMILY_REQUIRED/);
  assert.throws(() => governanceHumanRuleSeedDecision({ ...matrixSynchronization,
    projectionRequiresScopeExpansion: true, projectionScopeMatchesSeed: false }),
  /JUDGE_RULE_SCOPE_EXPANSION/);
  assert.throws(() => governanceHumanRuleSeedDecision({ ...matrixSynchronization,
    projectionRepresentationAmbiguous: true }), /JUDGE_RULE_PROJECTION_AMBIGUITY/);
  assert.throws(() => governanceHumanRuleSeedDecision({ ...seeded, humanAuthoredMarkdownDiff: false,
    seedAuthorshipVerifiedBy: 'ai-in-current-task', operation: 'correct-expression' }),
  /HUMAN_RULE_SEED_REQUIRED/);
});

test('Judge makes the human-authored seed blocker actionable without originating policy', () => {
  const judge = fs.readFileSync(new URL('../../_common/roles/judge.md', import.meta.url), 'utf8');
  assert.match(judge, /authorship boundary, not permission to be unhelpful/);
  assert.match(judge, /returns one primary Markdown file and\s+section whenever the authority is unambiguous/);
  assert.match(judge, /at most two conditional companion Markdown files/);
  assert.match(judge, /clickable absolute workspace link/);
  assert.match(judge, /must not supply proposed normative wording, a copyable rule, a semantic recommendation,\s+or an edit/);
  assert.match(judge, /smallest candidate set instead of making the human search the repository/);
});

test('Judge does not request redundant approval for faithful formatting and structural cleanup', () => {
  const judge = fs.readFileSync(new URL('../../_common/roles/judge.md', import.meta.url), 'utf8');
  assert.match(judge, /reorder or restructure the seeded text for readability without materially rewriting it/);
  assert.match(judge, /faithful maintenance operations need no separate\s+human approval before Judge performs them/);
  assert.match(judge, /may recompute and disclose the final byte-level diff identity and complete that\s+authorized commit without asking the human to authorize it again/);
  assert.match(judge, /original authorization and the verified\s+non-semantic maintenance record form one receipt chain for the final diff/);
  assert.match(judge, /Any uncertainty, material rewrite, semantic\s+change, newly affected policy location, or additional external effect invalidates this exception/);
});

test('governance publication enforces exact diff, ordered single-use receipts, destination, and prior effects', () => {
  const packet = { governanceDiffId, currentGovernanceDiffId: governanceDiffId, protectedWorkingTreeClean: true, receipts: governanceReceipts, consumedReceiptIds: [], effect: 'push', repository: 'sample-services', branch: 'pi-harness', remote: 'origin', target: null, prDestination: null, verifiedEffects: { commit: verifiedGovernanceCommit } };
  assert.equal(governancePublicationDecision(packet).consumeReceiptIdOnSuccess, 'r5');
  assert.throws(() => governancePublicationDecision({ ...packet, protectedWorkingTreeClean: false }), /POST_COMMIT_PROTECTED_CHANGES/);
  assert.throws(() => governancePublicationDecision({ ...packet, effect: 'commit', currentGovernanceDiffId: 'changed', protectedWorkingTreeClean: false, receipts: { ...governanceReceipts, authorization: { ...governanceReceipts.authorization, action: 'commit' } }, verifiedEffects: {} }), /CURRENT_DIFF_MISMATCH/);
  assert.throws(() => governancePublicationDecision({ ...packet, consumedReceiptIds: ['r5'] }), /REUSED_AUTHORIZATION/);
  assert.throws(() => governancePublicationDecision({ ...packet, branch: 'main' }), /WRONG_BRANCH/);
  assert.throws(() => governancePublicationDecision({ ...packet, verifiedEffects: {} }), /PUBLICATION_ORDER/);
  assert.throws(() => governancePublicationDecision({ ...packet, ambiguousOutcome: true }), /READBACK_REQUIRED/);
  assert.throws(() => governancePublicationDecision({ ...packet, receipts: { ...governanceReceipts,
    explanation: { ...governanceReceipts.explanation, sequence: 1 } } }), /RECEIPT_ORDER/);
  assert.throws(() => governancePublicationDecision({ ...packet, receipts: { ...governanceReceipts, authorization: { ...governanceReceipts.authorization, action: ['commit', 'push'] } } }), /BUNDLED_OR_WRONG_ACTION/);
  assert.throws(() => governancePublicationDecision({ ...packet, receipts: { ...governanceReceipts, comprehension: { ...governanceReceipts.comprehension, coverage: [{ understood: false }] } } }), /UNDERSTANDING_COVERAGE/);
});

test('Markdown activation asks for a human decision on stale initialization and honors an explicit exception', () => {
  const roles = Object.keys(loadWorkflowAgents().agents);
  const verifiedCommitReceipt = { ...verifiedGovernanceCommit, commitSha: 'commit-1' };
  const input = { governanceDiffId, verifiedCommitReceipt, initializedDiffId: governanceDiffId, initializedCommitSha: 'commit-1', initializedRoles: roles, canonicalScenario: 'ai-workflows/dev/dev-live-test.md', liveTestStatus: 'PASS' };
  assert.equal(governanceMarkdownActivationDecision(input), 'MARKDOWN_GOVERNANCE_ACTIVATION_GATE_PASSED');
  assert.throws(() => governanceMarkdownActivationDecision({ ...input, initializedDiffId: 'stale' }), /HUMAN_REINITIALIZATION_DECISION_REQUIRED/);
  assert.equal(governanceMarkdownActivationDecision({ ...input, initializedDiffId: 'stale', humanApprovedProceedWithoutReinitialization: true }), 'MARKDOWN_GOVERNANCE_ACTIVATION_HUMAN_EXCEPTION_PASSED');
  assert.equal(governanceMarkdownActivationDecision({ ...input, verifiedCommitReceipt: undefined, humanApprovedProceedWithoutReinitialization: true }), 'MARKDOWN_GOVERNANCE_ACTIVATION_HUMAN_EXCEPTION_PASSED');
  assert.equal(governanceMarkdownActivationDecision({ ...input, initializedCommitSha: 'other', humanApprovedProceedWithoutReinitialization: true }), 'MARKDOWN_GOVERNANCE_ACTIVATION_HUMAN_EXCEPTION_PASSED');
  assert.equal(governanceMarkdownActivationDecision({ ...input, initializedRoles: roles.slice(0, 5), humanApprovedProceedWithoutReinitialization: true }), 'MARKDOWN_GOVERNANCE_ACTIVATION_HUMAN_EXCEPTION_PASSED');
  assert.throws(() => governanceMarkdownActivationDecision({ ...input, canonicalScenario: 'other.md' }), /SCENARIO_MISMATCH/);
  assert.throws(() => governanceMarkdownActivationDecision({ ...input, liveTestStatus: 'PENDING' }), /LIVE_TEST_NOT_PASSED/);
});

test('Judge scenario permits passive human observation and no agent messaging', () => {
  const verifiedCommitReceipt = { ...verifiedGovernanceCommit, commitSha: 'commit-1' };
  const input = { directHumanAuthorized: true, governanceDiffId, verifiedCommitReceipt, initializedDiffId: governanceDiffId, initializedCommitSha: 'commit-1', scenario: 'ai-workflows/dev/dev-live-test.md' };
  assert.equal(governanceJudgeScenarioCommunicationDecision({ ...input, action: 'observe-evidence', recipientRole: 'lead/human' }), 'JUDGE_CANONICAL_SCENARIO_OBSERVATION_ALLOWED');
  assert.throws(() => governanceJudgeScenarioCommunicationDecision({ ...input, action: 'initial-prescribed-prompt',
    recipientRole: 'designer / reviewer' }), /COMMUNICATION_FIREWALL/);
  assert.throws(() => governanceJudgeScenarioCommunicationDecision({ ...input, action: 'expected-test-human-response', recipientRole: 'designer / reviewer' }), /COMMUNICATION_FIREWALL/);
  assert.throws(() => governanceJudgeScenarioCommunicationDecision({ ...input, initializedDiffId: 'stale',
    humanApprovedProceedWithoutReinitialization: true, action: 'initial-prescribed-prompt',
    recipientRole: 'designer / reviewer' }), /COMMUNICATION_FIREWALL/);
  assert.throws(() => governanceJudgeScenarioCommunicationDecision({ ...input, initializedDiffId: 'stale', action: 'initial-prescribed-prompt', recipientRole: 'designer / reviewer' }), /COMMUNICATION_FIREWALL/);
  for (const recipientRole of ['manager', 'coder', 'command-runner', 'ui-acceptance-tester']) {
    assert.throws(() => governanceJudgeScenarioCommunicationDecision({ ...input, action: 'message', recipientRole }), /COMMUNICATION_FIREWALL/);
  }
});

test('Judge receives exact read-only roster discovery without gaining participant routes', () => {
  const judge = fs.readFileSync(new URL('../../_common/roles/judge.md', import.meta.url), 'utf8');
  const initialization = fs.readFileSync(new URL('./init.md', import.meta.url), 'utf8');
  assert.match(initialization, /initializedRoleDirectory` remains empty because it may address no\s+agent/);
  assert.match(initialization, /read-only `initializedObservationDirectory` contains every exact current workflow role task/);
  assert.match(initialization, /never derives an identity from title search, a capped recent-task listing, conversation memory, or a prior roster/);
  assert.match(initialization, /does not grant messaging, dispatch, wake, archive, rename, staffing, lifecycle, or execution authority/);
  assert.match(judge, /resolves the named role only through its initialization-supplied read-only `initializedObservationDirectory`/);
  assert.match(judge, /must not depend on title search, a capped recent-task list, sidebar ordering, an old\s+task ID remembered from conversation, or an archived predecessor/);
  assert.match(judge, /Truncated task output is insufficient evidence for a negative conclusion/);
});

test('no role may request or receive a Judge advisory', () => {
  const packet = { callerRole: 'manager', advisoryId: 'advisory-1', callerTaskId: 'manager-1',
    returnTaskId: 'manager-1', proposedAction: 'perform-requested-lifecycle-action',
    evidenceRefs: ['designer-turn-4'], evidenceVerified: true };
  assert.throws(() => governanceAdvisoryDecision(packet), /COMMUNICATION_FIREWALL/);
  assert.throws(() => governanceJudgeAdvisoryReplyDecision({ actorRole: 'judge', action: 'reply',
    purpose: 'governance-advisory-reply', recipientRole: 'manager', advisoryPacketVerified: true,
    advisoryId: 'advisory-1', requestAdvisoryId: 'advisory-1', recipientTaskId: 'manager-1',
    approvedSourceTaskId: 'manager-1' }), /COMMUNICATION_FIREWALL/);
  assert.throws(() => governanceJudgeAdvisoryReplyDecision({ actorRole: 'judge', action: 'message',
    purpose: 'general-advice', recipientRole: 'manager' }), /COMMUNICATION_FIREWALL/);
});

test('peer delivery is acknowledged once and stalled workers route to Manager recovery', () => {
  const delivery = { correlationId: 'packet-42', workerId: 'coder-42',
    dispatchReceipt: { ok: true, taskId: 'coder-42' } };
  assert.equal(packetDeliveryAcknowledgementDecision({ ...delivery, recipientBusy: true }),
    'PENDING_DELIVERY_BUSY:coder-42');
  assert.equal(packetDeliveryAcknowledgementDecision({ ...delivery, acknowledgement: 'COPY THAT',
    acknowledgementCorrelationId: 'packet-42' }), 'PACKET_ACKNOWLEDGED');
  assert.throws(() => packetDeliveryAcknowledgementDecision({ ...delivery, acknowledgement: 'COPY THAT',
    acknowledgementCorrelationId: 'other' }), /BLOCKED_DELIVERY_UNACKNOWLEDGED/);
  assert.equal(workerDeliveryRecoveryDecision(delivery), 'PENDING_DELIVERY_OBSERVATION:coder-42');
  assert.equal(workerDeliveryRecoveryDecision({ ...delivery, observationExpired: true }),
    'MANAGER_WORKER_RECOVERY_REQUIRED:coder-42');
  assert.equal(workerDeliveryRecoveryDecision({ ...delivery, observationExpired: true,
    managerVerifiedReplacement: true }), 'MANAGER_REPLACE_EXACT_STALE_DISPOSABLE_WORKER:coder-42');
});

test('acknowledged workers reject unrelated continuation and active scopes cannot silently switch', () => {
  const acknowledged = { correlationId: 'packet-44', acknowledgement: 'COPY THAT',
    acknowledgementCorrelationId: 'packet-44' };
  assert.equal(workerFollowupDecision(acknowledged), 'AWAIT_WORKER_TERMINAL_EVIDENCE');
  assert.equal(workerFollowupDecision({ ...acknowledged, followupKind: 'same-scope-correction' }),
    'SEND_BOUNDED_WORKER_CORRECTION');
  assert.equal(workerFollowupDecision({ ...acknowledged, terminalReceipt: true }), 'DEPENDENT_GATE_MAY_ADVANCE');
  assert.throws(() => workerFollowupDecision({ ...acknowledged, followupKind: 'continue' }),
    /BLOCKED_ACTIVE_WORKER_CONTINUATION_MESSAGE/);
  const active = { activeCorrelationId: 'packet-46', activeTicketId: 'SC-46',
    activeTargetRepository: 'sc-services', incomingCorrelationId: 'packet-46', incomingTicketId: 'SC-46',
    incomingTargetRepository: 'sc-services' };
  assert.equal(activeScopeInterruptionDecision({ ...active, incomingKind: 'same-scope-extension' }),
    'CONTINUE_ACTIVE_SCOPE');
  assert.equal(activeScopeInterruptionDecision({ ...active, incomingKind: 'stop-current-scope',
    authorizedStopOrReplacement: true }), 'STOP_OR_REPLACE_ACTIVE_SCOPE');
  assert.throws(() => activeScopeInterruptionDecision({ ...active, incomingCorrelationId: 'packet-47',
    incomingTicketId: 'SC-47', incomingKind: 'new-work' }), /BLOCKED_ACTIVE_SCOPE_INTERRUPTION/);
});

test('Designer proposals cannot open a Judge agent route', () => {
  const context = { senderRole: 'designer / reviewer', requestId: 'proposal-1', category: 'missing-command',
    workflowProject: 'sc-dev', sourceTaskId: 'designer-1', ticketId: 'SC-8464',
    targetRepository: 'sc-services' };
  assert.throws(() => governanceJudgeProposalDecision(context), /COMMUNICATION_FIREWALL/);
  assert.throws(() => governanceJudgeProposalDecision({ ...context, humanApprovedExactRequest: true,
    managerContextVerified: true }), /COMMUNICATION_FIREWALL/);
});

test('Judge cannot return reports to a Designer proposal route', () => {
  const report = { action: 'reply', purpose: 'result-report', requestId: 'proposal-1', approvedRequestId: 'proposal-1',
    recipientRole: 'designer / reviewer', recipientTaskId: 'designer-1', approvedSourceTaskId: 'designer-1',
    approvedConversation: true };
  assert.throws(() => governanceJudgeProposalReportDecision(report), /COMMUNICATION_FIREWALL/);
  assert.throws(() => governanceJudgeProposalReportDecision({ ...report, purpose: 'instruction' }), /COMMUNICATION_FIREWALL/);
  assert.throws(() => governanceJudgeProposalReportDecision({ ...report, action: 'follow-up' }), /COMMUNICATION_FIREWALL/);
  assert.throws(() => governanceJudgeProposalReportDecision({ ...report, recipientTaskId: 'other' }), /COMMUNICATION_FIREWALL/);
});

test('Manager cannot receive Judge governance verification requests', () => {
  const input = { senderRole: 'judge', requestId: 'proposal-1',
    humanApprovedExactRequest: true, workflowProject: 'sc-dev', sourceTaskId: 'designer-1',
    ticketId: 'SC-8464', targetRepository: 'sc-services',
    verifiedTicketId: 'SC-8464', verifiedProject: 'sc-dev',
    verifiedRepository: 'sc-services', verifiedSourceTaskId: 'designer-1' };
  assert.throws(() => managerGovernanceContextVerificationDecision(input), /COMMUNICATION_FIREWALL/);
});

test('Judge cannot reload scenario roles', () => {
  const existingRoles = ['designer / reviewer', 'judge', 'manager'];
  const input = {
    canonicalScenario: 'ai-workflows/dev/dev-live-test.md',
    verifiedContractGap: true,
    existingRoles,
  };
  assert.throws(() => judgeScenarioReloadDecision({ ...input,
    reloadRoles: ['designer / reviewer', 'manager'] }), /COMMUNICATION_FIREWALL/);
});

test('Manager heartbeat rejects duplicate, stale, foreign, wrong-role, wrong-cadence, and orchestration capability', () => {
  const exact = { scheduleId: 'schedule-1', active: true, targetTaskId: 'manager-1', targetRole: 'manager', project: 'sample-dev', cadenceMinutes: 10 };
  assert.equal(managerHeartbeatDecision({ schedules: [], managerTaskId: 'manager-1', project: 'sample-dev' }), 'CREATE_MANAGER_HEARTBEAT:manager-1');
  assert.equal(managerHeartbeatDecision({ schedules: [exact], managerTaskId: 'manager-1', project: 'sample-dev' }), 'MANAGER_HEARTBEAT_EXACT');
  assert.equal(managerHeartbeatDecision({ schedules: [{ ...exact, targetTaskId: 'manager-old' }], managerTaskId: 'manager-1', project: 'sample-dev', previousManagerTaskId: 'manager-old' }), 'REPLACE_EXACT_MANAGER_HEARTBEAT:schedule-1:manager-old->manager-1');
  assert.throws(() => managerHeartbeatDecision({ schedules: [exact, exact], managerTaskId: 'manager-1', project: 'sample-dev' }), /HEARTBEAT_COUNT/);
  assert.throws(() => managerHeartbeatDecision({ schedules: [{ ...exact, targetTaskId: 'old' }], managerTaskId: 'manager-1', project: 'sample-dev' }), /STALE_TARGET/);
  assert.throws(() => managerHeartbeatDecision({ schedules: [{ ...exact, project: 'other' }], managerTaskId: 'manager-1', project: 'sample-dev' }), /FOREIGN_PROJECT/);
  assert.throws(() => managerHeartbeatDecision({ schedules: [{ ...exact, targetRole: 'coder' }], managerTaskId: 'manager-1', project: 'sample-dev' }), /WRONG_ROLE/);
  assert.throws(() => managerHeartbeatDecision({ schedules: [{ ...exact, cadenceMinutes: 5 }], managerTaskId: 'manager-1', project: 'sample-dev' }), /WRONG_CADENCE/);
  assert.throws(() => managerHeartbeatDecision({ schedules: [exact], managerTaskId: 'manager-1', project: 'sample-dev', capability: 'dispatch-worker' }), /HEARTBEAT_CAPABILITY/);
});

test('Manager heartbeat reconciles delayed clone generations without title-based deletion', () => {
  const manager = fs.readFileSync(new URL('../../_common/roles/manager.md', import.meta.url), 'utf8');
  const initialization = fs.readFileSync(new URL('./init.md', import.meta.url), 'utf8');
  const clone = fs.readFileSync(new URL('./role-context-clone.md', import.meta.url), 'utf8');
  const liveScenario = fs.readFileSync(new URL('./role-context-clone-cleanup.live-test.md', import.meta.url), 'utf8');
  assert.match(manager, /Every scheduled Manager run inventories the exact task-ID lineage/);
  assert.match(manager, /resumes any open `ROLE_CONTEXT_CLONE` transaction before ordinary staffing work/);
  assert.match(manager, /requires exactly one live dispatchable generation/);
  assert.match(manager, /never deletes or archives by title, sidebar order, age, or similarity/);
  assert.match(manager, /BLOCKED_CLONE_LINEAGE_RECONCILIATION/);
  assert.match(manager, /pending creation for any configured role resolves to generation `N\+1`/);
  assert.match(initialization, /exact clone-lineage lifecycle—including delayed successors and leftover generations/);
  assert.match(clone, /membership in the archived-task inventory/);
  assert.match(clone, /`idle`, `notLoaded`, absence from a bounded recent-task list/);
  assert.match(clone, /fully paged final reconciliation of every governed role lineage/);
  assert.match(liveScenario, /FREQ=MINUTELY;INTERVAL=1/);
  assert.match(liveScenario, /Admin does not tell Manager to archive the predecessor/);
  assert.match(liveScenario, /CLONE_CLEANUP_LIVE_TEST=PASS/);
  assert.match(liveScenario, /The PASS token is global, not fixture-local/);
  assert.match(liveScenario, /any governed role has two live\s+generations/);
  assert.doesNotMatch(liveScenario, /Coder|Proxy Coder/);
});

test('Judge heartbeat is required, unique, current, ten-minute, and audit-only', () => {
  const exact = { scheduleId: 'judge-schedule-1', active: true, targetTaskId: 'judge-1', targetRole: 'judge', project: 'sample-dev', cadenceMinutes: 10 };
  assert.equal(judgeHeartbeatDecision({ schedules: [], judgeTaskId: 'judge-1', project: 'sample-dev' }), 'CREATE_JUDGE_HEARTBEAT:judge-1');
  assert.equal(judgeHeartbeatDecision({ schedules: [exact], judgeTaskId: 'judge-1', project: 'sample-dev' }), 'JUDGE_HEARTBEAT_EXACT');
  assert.equal(judgeHeartbeatDecision({ schedules: [{ ...exact, targetTaskId: 'judge-old' }], judgeTaskId: 'judge-1', previousJudgeTaskId: 'judge-old', project: 'sample-dev' }), 'REPLACE_EXACT_JUDGE_HEARTBEAT:judge-schedule-1:judge-old->judge-1');
  assert.throws(() => judgeHeartbeatDecision({ schedules: [exact, exact], judgeTaskId: 'judge-1', project: 'sample-dev' }), /HEARTBEAT_COUNT/);
  assert.throws(() => judgeHeartbeatDecision({ schedules: [{ ...exact, targetTaskId: 'old' }], judgeTaskId: 'judge-1', project: 'sample-dev' }), /STALE_TARGET/);
  assert.throws(() => judgeHeartbeatDecision({ schedules: [{ ...exact, project: 'other' }], judgeTaskId: 'judge-1', project: 'sample-dev' }), /FOREIGN_PROJECT/);
  assert.throws(() => judgeHeartbeatDecision({ schedules: [{ ...exact, targetRole: 'manager' }], judgeTaskId: 'judge-1', project: 'sample-dev' }), /WRONG_ROLE/);
  assert.throws(() => judgeHeartbeatDecision({ schedules: [{ ...exact, cadenceMinutes: 5 }], judgeTaskId: 'judge-1', project: 'sample-dev' }), /WRONG_CADENCE/);
  assert.throws(() => judgeHeartbeatDecision({ schedules: [exact], judgeTaskId: 'judge-1', project: 'sample-dev', capability: 'edit-rules' }), /HEARTBEAT_CAPABILITY/);
});

test('Judge validates its rules without requesting any agent review', () => {
  const agents = fs.readFileSync(new URL('../../agents.md', import.meta.url), 'utf8');
  const judge = fs.readFileSync(commonJudgeUrl, 'utf8');
  const designer = normalizeWhitespace(fs.readFileSync(new URL('../../_common/roles/designer-reviewer.md', import.meta.url), 'utf8'));
  const team = normalizeWhitespace(fs.readFileSync(new URL('team.md', import.meta.url), 'utf8'));
  const admin = fs.readFileSync(new URL('../../_common/roles/admin.md', import.meta.url), 'utf8');
  assert.match(judge, /No AI role reviews,/);
  assert.match(judge, /must never request review from another\nagent/);
  assert.match(judge, /No review receipt or agent participation exists in this sequence/);
  assert.doesNotMatch(judge, /independent Designer\/Reviewer review/);
  assert.match(judge, /"one by one" means repeat the complete explain-comprehend-authorize-commit cycle/);
  assert.match(judge, /starts again at step 2 for the next proposed commit/);
  for (const contract of [designer, judge, admin]) {
    assert.match(contract, /## Human prompt interpretation cases/);
    assert.match(contract, /Human prompt case|human prompt case|Prompt case/);
  }
  assert.match(agents, /Every human-facing role must contain `## Human prompt interpretation cases`/);
  assert.match(agents, /"Do these one by one\.".*prepare and validate → explain → authorize → act/);
  assert.match(agents, /Internal packet-only roles document packet cases instead/);
  assert.match(designer, /Any prompt whose resolved intent is to find, read, create, update, reconcile, assign, move, or close a tracker ticket, regardless of wording/);
  assert.match(designer, /exact tracker-lifecycle owner declared by the initialized workflow/);
  assert.match(designer, /Once ticket intent is recognized/);
  assert.match(designer, /must not open, inspect, or operate the tracker UI or connector itself/);
  assert.match(team, /### Human prompt route bindings/);
  assert.match(team, /Designer Reviewer \| Find, read, create, update, reconcile, assign, move, or close a tracker ticket/);
  assert.match(team, /\| Manager \| Immediately send the exact initialized Manager one complete canonical tracker packet/);
});

test('public governance publication requires existing-public or exact registry evidence', () => {
  const registry = fs.readFileSync(new URL('../../../ai-publication.yml', import.meta.url), 'utf8');
  const commandPublishing = fs.readFileSync(new URL('../../../ai-commands/PUBLISHING.md', import.meta.url), 'utf8');
  const workflowPublishing = fs.readFileSync(new URL('../../PUBLISHING.md', import.meta.url), 'utf8');
  const input = {
    sourcePath: 'ai-workflows/agents.md',
    targetRepository: 'starodubtsevconsulting/ai-workflows',
    targetPath: 'agents.md',
    portabilityReviewPassed: true,
    privacyReviewPassed: true,
    licenseReviewPassed: true,
    exactMirrorVerified: true,
    bothSidesFetched: true,
    divergenceReviewed: true,
  };
  assert.equal(publicGovernancePublicationDecision({ ...input, existingPublicPathVerified: true }),
    'PUBLIC_GOVERNANCE_SYNC_CANDIDATE_ALLOWED');
  const registryEntry = { publication: 'public-mirror', syncMode: 'exact-mirror', reconciliation: 'bidirectional',
    sourcePath: input.sourcePath,
    targetRepository: input.targetRepository, targetPath: input.targetPath };
  assert.equal(publicGovernancePublicationDecision({ ...input, registryEntry }),
    'PUBLIC_GOVERNANCE_SYNC_CANDIDATE_ALLOWED');
  assert.throws(() => publicGovernancePublicationDecision(input), /PUBLIC_SYNC_SCOPE/);
  assert.throws(() => publicGovernancePublicationDecision({ ...input, registryEntry,
    targetPath: 'dev/agents.md' }), /PUBLIC_SYNC_SCOPE/);
  assert.throws(() => publicGovernancePublicationDecision({ ...input, existingPublicPathVerified: true,
    privacyReviewPassed: false }), /PUBLIC_SYNC_REVIEW_REQUIRED/);
  assert.throws(() => publicGovernancePublicationDecision({ ...input, existingPublicPathVerified: true,
    exactMirrorVerified: false }), /PUBLIC_SYNC_EXACT_MIRROR_REQUIRED/);
  assert.throws(() => publicGovernancePublicationDecision({ ...input, existingPublicPathVerified: true,
    bothSidesFetched: false }), /PUBLIC_SYNC_RECONCILIATION_REQUIRED/);
  assert.match(registry, /privateSource: ai-workflows\/agents\.md/);
  assert.match(registry, /privateSource: ai-commands\/doc/);
  assert.match(registry, /privateSource: ai-commands\/show-context/);
  assert.equal((registry.match(/syncMode: exact-mirror/g) ?? []).length, 14);
  assert.equal((registry.match(/reconciliation: bidirectional/g) ?? []).length, 14);
  assert.match(registry, /privateSource: ai-workflows\/public-README\.md/);
  assert.match(registry, /privateSource: ai-workflows\/role-capability-matrix\.md/);
  assert.match(registry, /privateSource: ai-workflows\/role-capability-matrix\.csv/);
  assert.match(registry, /privateSource: ai-workflows\/role-capability-ownership\.csv/);
  assert.match(registry, /privateSource: ai-workflows\/role-communication-matrix\.csv/);
  assert.match(registry, /privateSource: ai-profile\/example/);
  assert.match(registry, /privateSource: ai-profile\/validate-example\.sh/);
  assert.match(registry, /privateSource: ai-commands\/commands/);
  assert.match(registry, /privateSource: ai-commands\/install\/grapheneos/);
  assert.match(registry, /privateSource: ai-commands\/install\/README\.md/);
  assert.match(registry, /privateSource: ai-commands\/sdd\/sdd\.command\.md/);
  assert.match(registry, /show-context\.report\.template\.md/);
  assert.match(commandPublishing, /single private publication registry for commands and\s+workflows/);
  assert.match(workflowPublishing, /root \[`\.\.\/ai-publication\.yml`\]/);
  assert.match(commandPublishing, /manifest members—not the folder's other descendants/);
  assert.match(workflowPublishing, /other private\s+descendants remain unregistered/);
});

test('manifest-selected public folders enforce a closed normalized exact artifact boundary', () => {
  const members = ['README.md', 'nested/tool.sh'];
  assert.equal(publicMirrorManifestDecision({ include: members, privateMembers: members,
    publicMembers: [...members].reverse() }), 'PUBLIC_MIRROR_MANIFEST_EXACT');
  for (const include of [[], ['README.md', 'README.md'], ['../secret'], ['/absolute'], ['./relative'], ['nested\\file'],
    ['a//b'], ['a/./b'], ['a/'], [' spaced'], ['control\u0000byte']]) {
    assert.throws(() => publicMirrorManifestDecision({ include, privateMembers: [], publicMembers: [] }),
      /MANIFEST_REQUIRED|MANIFEST_PATH/);
  }
  assert.throws(() => publicMirrorManifestDecision({ include: members, privateMembers: members,
    publicMembers: members, symlinkMembers: ['nested/tool.sh'] }), /MANIFEST_SYMLINK/);
  assert.throws(() => publicMirrorManifestDecision({ include: members, privateMembers: ['README.md'],
    publicMembers: members }), /PRIVATE_MEMBER/);
  assert.throws(() => publicMirrorManifestDecision({ include: members, privateMembers: members,
    publicMembers: [...members, 'extra.md'] }), /PUBLIC_INVENTORY/);
  assert.throws(() => publicMirrorManifestDecision({ include: members, privateMembers: members,
    publicMembers: members, modeHashMismatches: ['nested/tool.sh'] }), /MODE_HASH_MISMATCH/);
});

test('Git provenance names the initiating workflow role instead of the agent technology', () => {
  const gitCommand = fs.readFileSync(new URL('../../../ai-commands/git/git.command.md', import.meta.url), 'utf8');
  const commitCommand = fs.readFileSync(new URL('../../../ai-commands/commit/commit.command.md', import.meta.url), 'utf8');
  const pushCommand = fs.readFileSync(new URL('../../../ai-commands/push/push.command.md', import.meta.url), 'utf8');
  const prCommand = fs.readFileSync(new URL('../../../ai-commands/pr/pr.command.md', import.meta.url), 'utf8');
  const reviewCommand = fs.readFileSync(new URL('../../../ai-commands/review/review.command.md', import.meta.url), 'utf8');
  assert.match(gitCommand, /<initiating-role>\/<short-kebab-description>/);
  assert.match(gitCommand, /initiating role is the verified caller in the command packet/);
  assert.match(gitCommand, /`codex`, `pi`, `hermes`, or `ai` are execution technology/);
  assert.match(gitCommand, /must not be used as the provenance identity/);
  assert.match(commitCommand, /Agent-role body metadata,[\s\S]*required only when.*agent_identities\.enabled: true/);
  assert.match(commitCommand, /while false, their absence must not block a commit/);
  assert.match(pushCommand, /reject generic technology prefixes such as `codex\/`, `pi\/`, `hermes\/`, or `ai\/`/);
  assert.match(prCommand, /head branch, commits, and body disagree/);
  assert.match(reviewCommand, /Reviewed-By-Role: designer-reviewer/);
  assert.equal(gitRoleProvenanceDecision({ branchName: 'coder/fix-session', initiatingRole: 'coder',
    executorRole: 'command-runner' }), 'GIT_ROLE_PROVENANCE:coder:command-runner');
  for (const branchName of ['coder/a b', 'coder/../../work', 'coder//work', 'coder/.', 'coder/Feature_X',
    'coder/work/', 'coder/control\u0000byte']) {
    assert.throws(() => gitRoleProvenanceDecision({ branchName, initiatingRole: 'coder', executorRole: 'coder' }),
      /PROVENANCE_BRANCH/);
  }
  for (const prefix of ['codex', 'pi', 'hermes', 'ai']) {
    assert.throws(() => gitRoleProvenanceDecision({ branchName: `${prefix}/work`, initiatingRole: 'judge',
      executorRole: 'judge' }), /PROVENANCE_BRANCH/);
  }
  const legacy = { branch: 'codex/old-work', effect: 'push', initiatingRole: 'judge' };
  assert.throws(() => gitRoleProvenanceDecision({ branchName: legacy.branch, initiatingRole: 'judge',
    executorRole: 'judge', existingLegacy: true }), /LEGACY_AUTHORIZATION/);
  assert.equal(gitRoleProvenanceDecision({ branchName: legacy.branch, initiatingRole: 'judge', executorRole: 'judge',
    existingLegacy: true, legacyAuthorization: legacy }), 'GIT_LEGACY_PROVENANCE:judge:judge:push');
  for (const role of ['designer-reviewer', 'judge', 'manager', 'coder', 'command-runner',
    'ui-acceptance-tester', 'proxy-coder', 'human']) {
    assert.match(gitRoleProvenanceDecision({ branchName: `${role}/work`, initiatingRole: role, executorRole: role }),
      new RegExp(`GIT_ROLE_PROVENANCE:${role}:`));
  }
  assert.throws(() => gitRoleProvenanceDecision({ branchName: 'unknown/work', initiatingRole: 'unknown',
    executorRole: 'coder' }), /PROVENANCE_ROLE/);
  assert.equal(gitRoleProvenanceDecision({ branchName: 'coder/work', initiatingRole: 'coder',
    executorRole: 'command-runner', reviewMetadata: { initiatingRole: 'coder', producingRole: 'coder',
      reviewedByRole: 'designer-reviewer' } }), 'GIT_ROLE_PROVENANCE:coder:command-runner');
  assert.throws(() => gitRoleProvenanceDecision({ branchName: 'coder/work', initiatingRole: 'coder',
    executorRole: 'command-runner', reviewMetadata: { initiatingRole: 'designer-reviewer', producingRole: 'coder',
      reviewedByRole: 'designer-reviewer' } }), /REVIEW_PROVENANCE/);
  assert.throws(() => gitRoleProvenanceDecision({ branchName: 'coder/work', initiatingRole: 'coder',
    executorRole: 'command-runner', reviewMetadata: { initiatingRole: 'coder', producingRole: 'coder',
      reviewedByRole: 'coder' } }), /REVIEW_PROVENANCE/);
});

test('source-control preserves verified human-facing caller provenance through Command Runner execution', () => {
  const packet = { callerTaskId: 'designer-task', trustedCallerTaskId: 'designer-task',
    callerRole: 'designer-reviewer', trustedCallerRole: 'designer-reviewer', initiatingRole: 'designer-reviewer',
    returnTaskId: 'designer-task', trustedReturnTaskId: 'designer-task', changeId: 'change-1', producingRole: 'coder',
    producingTaskId: 'coder-task', productionAttestation: { producingRole: 'coder', producingTaskId: 'coder-task',
      callerTaskId: 'designer-task', returnTaskId: 'designer-task', changeId: 'change-1', receiptId: 'coder-receipt-1' },
    trustedProductionReceipt: { producingRole: 'coder', producingTaskId: 'coder-task', callerTaskId: 'designer-task',
      returnTaskId: 'designer-task', changeId: 'change-1', receiptId: 'coder-receipt-1' },
    executorRole: 'command-runner', branchName: 'designer-reviewer/fix-session', identityEnforcementEnabled: true,
    trustedIdentityEnforcementEnabled: true, identityConfigPath: 'profile/agent-identities.yml',
    trustedIdentityConfigPath: 'profile/agent-identities.yml' };
  assert.equal(agentAwareSourceControlDecision(packet),
    'SOURCE_CONTROL_PROVENANCE:designer-reviewer:coder:command-runner:designer-task');
  assert.throws(() => agentAwareSourceControlDecision({ ...packet, trustedCallerTaskId: 'other-task' }), /CALLER_PROVENANCE/);
  assert.throws(() => agentAwareSourceControlDecision({ ...packet, trustedCallerRole: 'judge' }), /CALLER_PROVENANCE/);
  assert.throws(() => agentAwareSourceControlDecision({ ...packet, initiatingRole: 'coder' }), /CALLER_PROVENANCE/);
  assert.throws(() => agentAwareSourceControlDecision({ ...packet, branchName: 'command-runner/fix-session' }),
    /PROVENANCE_BRANCH/);
  assert.throws(() => agentAwareSourceControlDecision({ ...packet, returnTaskId: '' }), /CALLER_PROVENANCE/);
  assert.throws(() => agentAwareSourceControlDecision({ ...packet, returnTaskId: 'foreign-task' }), /CALLER_PROVENANCE/);
  assert.throws(() => agentAwareSourceControlDecision({ ...packet, producingRole: 'unknown' }), /ROLE_PROVENANCE/);
  assert.throws(() => agentAwareSourceControlDecision({ ...packet, productionAttestation: null }),
    /PRODUCTION_ATTESTATION/);
  assert.throws(() => agentAwareSourceControlDecision({ ...packet,
    productionAttestation: { ...packet.productionAttestation, receiptId: 'fabricated' } }),
    /PRODUCTION_ATTESTATION/);
  assert.throws(() => agentAwareSourceControlDecision({ ...packet,
    trustedProductionReceipt: { ...packet.trustedProductionReceipt, changeId: 'different-change' } }),
    /PRODUCTION_ATTESTATION/);
  assert.throws(() => agentAwareSourceControlDecision({ ...packet,
    consumedProductionReceiptIds: ['coder-receipt-1'] }),
    /PRODUCTION_ATTESTATION/);
  const disabled = { ...packet, identityEnforcementEnabled: false, trustedIdentityEnforcementEnabled: false,
    changeId: undefined, producingRole: undefined,
    producingTaskId: undefined, productionAttestation: undefined, trustedProductionReceipt: undefined };
  assert.equal(agentAwareSourceControlDecision(disabled),
    'SOURCE_CONTROL_BRANCH_PROVENANCE:designer-reviewer:designer-reviewer/fix-session');
  assert.throws(() => agentAwareSourceControlDecision({ ...disabled, trustedIdentityEnforcementEnabled: true }),
    /IDENTITY_CONFIG/);
  assert.throws(() => agentAwareSourceControlDecision({ ...disabled, identityConfigPath: '' }), /IDENTITY_CONFIG/);
  assert.throws(() => agentAwareSourceControlDecision({ ...disabled, trustedIdentityConfigPath: 'other/profile.yml' }),
    /IDENTITY_CONFIG/);
});

test('every new ticket prompt requires fresh Manager evidence and rejects cached or historical approval', () => {
  assert.equal(freshTicketIntakeDecision({ newPrompt: true, managerLookupPerformed: true }), 'FRESH_MANAGER_TICKET_INTAKE_REQUIRED');
  assert.throws(() => freshTicketIntakeDecision({ newPrompt: true, managerLookupPerformed: false }), /FRESH_MANAGER_LOOKUP_REQUIRED/);
  assert.throws(() => freshTicketIntakeDecision({ newPrompt: true, managerLookupPerformed: true, cachedFactsUsed: true }), /CACHED_TICKET_FACTS/);
  assert.throws(() => freshTicketIntakeDecision({ newPrompt: true, managerLookupPerformed: true, historicalCommentUsedAsApproval: true }), /HISTORICAL_COMMENT/);
});

test('partial worker progress cannot become terminal acceptance or completion', () => {
  assert.throws(() => workerHandoffDecision({ packet: workerPacket, registry, initializedContext: syntheticContext(), trustedCurrentTaskId: trustedWorker, ...acknowledged, partial: true }), /PARTIAL_PROGRESS/);
  assert.throws(() => workerHandoffDecision({ packet: workerPacket, registry, initializedContext: syntheticContext(), trustedCurrentTaskId: trustedWorker, ...acknowledged, terminal: true, terminalDisposition: 'DONE', completion: 'complete', evidence: {} }), /INCOMPLETE_TERMINAL_EVIDENCE/);
  assert.throws(() => workerHandoffDecision({ packet: workerPacket, registry, initializedContext: syntheticContext(), trustedCurrentTaskId: trustedWorker, ...acknowledged, terminal: true, terminalDisposition: 'BLOCKED', completion: 'blocked', blocker: { kind: 'coding', evidence: 'remaining implementation', nextAction: 'code' }, evidence: {} }), /IN_SCOPE_CODING/);
});

test('terminal evidence delegates only to the packet return task and records non-closure', () => {
  const evidence = {
    returnTaskId: 'visible-designer-33', changedFiles: ['a.md'], commandsTests: ['node --test'],
    requirementToTest: ['handshake'], residualRisksBlockers: ['independent review pending'],
    nonClosureStatus: 'DEV-22 remains open pending protected gates',
  };
  assert.equal(workerHandoffDecision({ packet: workerPacket, registry, initializedContext: syntheticContext(), trustedCurrentTaskId: trustedWorker, ...acknowledged, terminal: true, terminalDisposition: 'DONE', completion: 'complete', evidence }), 'TERMINAL_EVIDENCE_REQUIRED:visible-designer-33');
  assert.equal(workerHandoffDecision({ packet: workerPacket, registry, initializedContext: syntheticContext(), trustedCurrentTaskId: trustedWorker, ...acknowledged, terminal: true, terminalDisposition: 'APPROVAL_REQUIRED', completion: 'blocked', blocker: { kind: 'authority', evidence: 'approval withheld', nextAction: 'obtain approval' }, evidence }), 'TERMINAL_EVIDENCE_REQUIRED:visible-designer-33');
  assert.equal(workerHandoffDecision({ packet: workerPacket, registry, initializedContext: syntheticContext(), trustedCurrentTaskId: trustedWorker, ...acknowledged, terminal: true, terminalDisposition: 'BLOCKED', completion: 'blocked', blocker: { kind: 'external', evidence: 'service unavailable', nextAction: 'restore service' }, evidence }), 'TERMINAL_EVIDENCE_REQUIRED:visible-designer-33');
  assert.throws(() => workerHandoffDecision({ packet: workerPacket, registry, initializedContext: syntheticContext(), trustedCurrentTaskId: trustedWorker, ...acknowledged, terminal: true, terminalDisposition: 'DONE', completion: 'complete', evidence: { ...evidence, returnTaskId: 'wrong' } }), /INCOMPLETE_TERMINAL_EVIDENCE/);
});

console.log('visible-role routing model: executable reference proof only; Codex task backend integration remains outside this package');
