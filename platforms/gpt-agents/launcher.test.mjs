/** Launcher CLI and result-reporting regression tests.
 * Run: node --test platforms/gpt-agents/launcher.test.mjs.
 * Uses isolated host-command fixtures and a canceled macOS selector; lifecycle
 * reporting tests inject an in-process host and never connect to a desktop socket.
 * Passing verifies mocked launch decisions/reporting, not native delivery or live readiness.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { governorLaunchReport } from './launcher.mjs';
import { ensurePersonalGovernor } from './governor-launch.mjs';

test('Governor report distinguishes a blocked creation from pending or ready', () => {
  const result = { status: 'blocked', taskId: 'exact-created-task',
    reason: 'GOVERNOR_CREATED_TASK_METADATA_UNAVAILABLE', classification: 'transient-metadata' };
  const report = governorLaunchReport(result);
  assert.equal(report.platformStatus, 'AI Fleas GPT is blocked.');
  assert.match(report.destination, /exact-created-task/);
  assert.match(report.destination, /GOVERNOR_CREATED_TASK_METADATA_UNAVAILABLE/);
  assert.match(report.destination, /classification: transient-metadata/);
  assert.doesNotMatch(report.destination, /still pending|activation and welcome INIT completed/);
  assert.deepEqual(result, { status: 'blocked', taskId: 'exact-created-task',
    reason: 'GOVERNOR_CREATED_TASK_METADATA_UNAVAILABLE', classification: 'transient-metadata' });
});

test('Governor report preserves blocked results without an accepted task ID', () => {
  const report = governorLaunchReport({ status: 'blocked', reason: 'GOVERNOR_CREATED_TASK_ID_UNAVAILABLE' });
  assert.equal(report.platformStatus, 'AI Fleas GPT is blocked.');
  assert.match(report.destination, /before a task ID was verified: GOVERNOR_CREATED_TASK_ID_UNAVAILABLE/);
});

test('Governor report preserves ready, pending, existing, and welcome behavior', () => {
  assert.deepEqual(governorLaunchReport({ status: 'ready', welcomeStatus: 'completed' }), {
    platformStatus: 'AI Fleas GPT is ready.',
    destination: 'Personal Governor activation and welcome INIT completed; the verified task is pinned.',
  });
  assert.deepEqual(governorLaunchReport({ status: 'pending' }), {
    platformStatus: 'AI Fleas GPT is pending.',
    destination: 'Personal Governor initialization is still pending; the task will not be opened until a later launcher run verifies readiness.',
  });
  assert.deepEqual(governorLaunchReport({ status: 'existing' }), {
    platformStatus: 'AI Fleas GPT is ready.',
    destination: 'Existing Personal Governor readiness was verified, but welcome completion was not verified.',
  });
  assert.match(governorLaunchReport({ status: 'existing', welcomeStatus: 'completed' }).destination,
    /welcome completion were verified/);
  for (const welcomeStatus of ['blocked', 'pending']) {
    const report = governorLaunchReport({ status: 'existing', welcomeStatus, welcomeReason: 'EXACT_WELCOME_REASON' });
    assert.equal(report.platformStatus, 'AI Fleas GPT is pending.');
    assert.match(report.destination, /Personal Governor is active/);
    assert.match(report.destination, /EXACT_WELCOME_REASON/);
  }
  const foreignWriter = governorLaunchReport({ status: 'existing',
    welcomeStatus: 'pending', welcomeReason: 'GOVERNOR_WELCOME_FOREIGN_WRITER_ACTIVE' });
  assert.equal(foreignWriter.platformStatus, 'AI Fleas GPT is pending.');
  assert.match(foreignWriter.destination, /activation is verified/);
  assert.match(foreignWriter.destination, /do not close, archive, unarchive, or replace/);
  assert.match(foreignWriter.destination, /Do not retry the launcher until the writer is released/);
  assert.doesNotMatch(foreignWriter.destination, /Run the launcher again to verify completion/);
});

const launcher = fileURLToPath(new URL('./launcher.mjs', import.meta.url));
const setupScript = fileURLToPath(new URL('./setup.sh', import.meta.url));
const repositoryRoot = fs.realpathSync(fileURLToPath(new URL('../..', import.meta.url)));

function fixture({ marketplace = false, plugins = false, legacy = false, staleMarketplace = false } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-fleas-gpt-launcher-'));
  const bin = path.join(root, 'bin');
  const app = path.join(root, 'ChatGPT.app');
  const log = path.join(root, 'calls.log');
  const state = path.join(root, 'state');
  fs.mkdirSync(bin);
  fs.mkdirSync(app);
  fs.writeFileSync(state, `${marketplace ? 'marketplace' : ''}\n${plugins ? 'plugins' : ''}\n${legacy ? 'legacy' : ''}\n${staleMarketplace ? 'stale' : ''}\n`);
  const codex = path.join(bin, 'codex');
  const embeddedCodex = path.join(app, 'Contents', 'Resources', 'codex-cli', 'bin', 'codex');
  const open = path.join(bin, 'open');
  const defaults = path.join(bin, 'defaults');
  const git = path.join(bin, 'git');
  const osascript = path.join(bin, 'osascript');
  const gitState = path.join(root, 'git-state');
  fs.writeFileSync(codex, `#!/bin/sh
printf '%s\\n' "$*" >> "$AI_FLEAS_TEST_LOG"
case "$*" in
  '--version') echo 'codex-test 1.0' ;;
  'plugin marketplace list --json')
    if grep -q marketplace "$AI_FLEAS_TEST_STATE"; then
      if grep -q stale "$AI_FLEAS_TEST_STATE"; then echo '{"marketplaces":[{"name":"ai-fleas","root":"/private/tmp/stale-ai-fleas"}]}'
      else printf '{"marketplaces":[{"name":"ai-fleas","root":"%s"}]}\\n' "$AI_FLEAS_EXPECTED_MARKETPLACE_ROOT"; fi
    else echo '{"marketplaces":[]}'; fi ;;
  'plugin marketplace remove ai-fleas') sed -i.bak -e '/marketplace/d' -e '/stale/d' "$AI_FLEAS_TEST_STATE"; echo '{}' ;;
  'plugin marketplace add '*) printf 'marketplace\\n' >> "$AI_FLEAS_TEST_STATE"; echo '{}' ;;
  'plugin add '*) printf 'plugins\\n' >> "$AI_FLEAS_TEST_STATE"; echo '{}' ;;
  'plugin remove '*) sed -i.bak '/legacy/d' "$AI_FLEAS_TEST_STATE"; echo '{}' ;;
  'plugin list --json')
    if grep -q plugins "$AI_FLEAS_TEST_STATE"; then
      if grep -q legacy "$AI_FLEAS_TEST_STATE"; then
        echo '{"installed":[{"pluginId":"ai-fleas-gpt@ai-fleas","enabled":true},{"pluginId":"ai-fleas-agent-bootstrap@ai-fleas","enabled":true},{"pluginId":"ai-fleas-workflow-router@ai-fleas","enabled":true},{"pluginId":"ai-fleas-gpt@personal","enabled":true}]}'
      else echo '{"installed":[{"pluginId":"ai-fleas-gpt@ai-fleas","enabled":true}]}'; fi
    elif grep -q legacy "$AI_FLEAS_TEST_STATE"; then
      echo '{"installed":[{"pluginId":"ai-fleas-agent-bootstrap@ai-fleas","enabled":true},{"pluginId":"ai-fleas-workflow-router@ai-fleas","enabled":true}]}'
    else echo '{"installed":[]}'; fi ;;
  *) echo '{}' ;;
esac
`);
  fs.mkdirSync(path.dirname(embeddedCodex), { recursive: true });
  fs.copyFileSync(codex, embeddedCodex);
  fs.writeFileSync(open, '#!/bin/sh\nprintf \'open %s\\n\' "$*" >> "$AI_FLEAS_TEST_LOG"\n');
  fs.writeFileSync(defaults, '#!/bin/sh\nprintf \'defaults %s\\n\' "$*" >> "$AI_FLEAS_TEST_LOG"\n');
  fs.writeFileSync(osascript, `#!/bin/sh
printf 'osascript %s\\n' "$*" >> "$AI_FLEAS_TEST_LOG"
printf 'execution error: User canceled. (-128)\\n' >&2
exit 1
`);
  fs.writeFileSync(git, `#!/bin/sh
printf 'git %s\\n' "$*" >> "$AI_FLEAS_TEST_LOG"
case "$*" in
  *' branch --show-current') echo "\${AI_FLEAS_TEST_GIT_BRANCH:-main}" ;;
  *' status --porcelain') if [ "\${AI_FLEAS_TEST_GIT_DIRTY:-0}" = 1 ]; then echo ' M local-change'; fi ;;
  *' rev-parse HEAD') if [ -f "$AI_FLEAS_TEST_GIT_STATE" ]; then echo updated; else echo original; fi ;;
  *' fetch origin main') : ;;
  *' merge-base --is-ancestor HEAD origin/main') : ;;
  *' merge --ff-only origin/main') touch "$AI_FLEAS_TEST_GIT_STATE" ;;
  *) echo "unexpected git call: $*" >&2; exit 1 ;;
esac
`);
  fs.chmodSync(codex, 0o755);
  fs.chmodSync(embeddedCodex, 0o755);
  fs.chmodSync(open, 0o755);
  fs.chmodSync(defaults, 0o755);
  fs.chmodSync(git, 0o755);
  fs.chmodSync(osascript, 0o755);
  return { root, app, log, state, codex, open, defaults, git, gitState, osascript };
}

function run(item, args, { finderEnvironment = false } = {}) {
  const env = testEnvironment(item, { finderEnvironment });
  return spawnSync(process.execPath, [launcher, ...args], {
    encoding: 'utf8',
    timeout: 15_000,
    env,
  });
}

function testEnvironment(item, {
  finderEnvironment = false,
  sourceUpdate = false,
  dirtyCheckout = false,
  gitBranch = 'main',
} = {}) {
  const env = {
    ...process.env,
    AI_FLEAS_OS: 'darwin',
    AI_FLEAS_OPEN_BIN: item.open,
    AI_FLEAS_DEFAULTS_BIN: item.defaults,
    AI_FLEAS_OSASCRIPT_BIN: item.osascript,
    AI_FLEAS_GIT_BIN: item.git,
    AI_FLEAS_TEST_GIT_STATE: item.gitState,
    AI_FLEAS_TEST_GIT_DIRTY: dirtyCheckout ? '1' : '0',
    AI_FLEAS_TEST_GIT_BRANCH: gitBranch,
    AI_FLEAS_CHATGPT_APP: item.app,
    AI_FLEAS_TEST_LOG: item.log,
    AI_FLEAS_TEST_STATE: item.state,
    AI_FLEAS_EXPECTED_MARKETPLACE_ROOT: repositoryRoot,
    XDG_CONFIG_HOME: path.join(item.root, 'config'),
    XDG_DATA_HOME: path.join(item.root, 'data'),
    CODEX_HOME: path.join(item.root, 'codex-home'),
  };
  delete env.AI_FLEAS_HUMANS_DIR;
  if (!sourceUpdate) env.AI_FLEAS_SKIP_SOURCE_UPDATE = '1';
  if (finderEnvironment) {
    delete env.AI_FLEAS_CODEX_BIN;
    env.PATH = '/usr/bin:/bin';
  } else {
    env.AI_FLEAS_CODEX_BIN = item.codex;
  }
  return env;
}

function assertCanceledBeforeLifecycle(item, result) {
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Personal Governor initialization canceled; no task was created\./);
  assert.doesNotMatch(result.stderr, /AI_FLEAS_GPT_BLOCKED|EINVAL/);
  const calls = fs.readFileSync(item.log, 'utf8');
  assert.equal(calls.split('\n').filter(line => line.startsWith('osascript ')).length, 1);
  assert.doesNotMatch(calls, /queue --thread|threads\/new|thread\/start|turn\/start|app-server/);
  assert.equal(fs.existsSync(path.join(item.root, 'data', 'ai-fleas', 'humans')), false);
  const events = fs.readFileSync(path.join(item.root, 'config', 'ai-fleas', 'gpt-agents', 'launcher.log'), 'utf8')
    .trim().split('\n').map(line => JSON.parse(line).event);
  assert.ok(events.includes('launch-start'));
  assert.equal(events.includes('governor-progress'), false);
  assert.equal(events.includes('governor-resolved'), false);
}

test('doctor reports setup-required when marketplace and plugins are absent', () => {
  const item = fixture();
  const result = run(item, ['doctor']);
  assert.equal(result.status, 2, result.stderr);
  assert.equal(JSON.parse(result.stdout).status, 'setup-required');
});

test('setup adds marketplace and the single AI Fleas GPT plugin', () => {
  const item = fixture();
  const result = run(item, ['setup']);
  assert.equal(result.status, 0, result.stderr);
  const calls = fs.readFileSync(item.log, 'utf8');
  assert.match(calls, /plugin marketplace add/);
  assert.match(calls, /plugin add ai-fleas-gpt@ai-fleas/);
  assert.doesNotMatch(calls, /plugin add ai-fleas-agent-bootstrap/);
  assert.doesNotMatch(calls, /plugin add ai-fleas-workflow-router/);
});

test('one-step setup migrates, verifies, enables updates, and honors launch cancellation', () => {
  const item = fixture();
  const legacyData = path.join(
    item.root,
    'codex-home',
    'plugins',
    'data',
    'ai-fleas-agent-bootstrap-personal',
  );
  fs.mkdirSync(legacyData, { recursive: true });
  fs.writeFileSync(path.join(legacyData, 'agent-bindings.json'), '{"instances":{}}');
  const result = spawnSync('/bin/zsh', [setupScript], {
    encoding: 'utf8',
    timeout: 15_000,
    env: testEnvironment(item),
  });
  assertCanceledBeforeLifecycle(item, result);
  const calls = fs.readFileSync(item.log, 'utf8');
  assert.match(calls, /plugin marketplace add/);
  assert.match(calls, /plugin add ai-fleas-gpt@ai-fleas/);
  assert.match(calls, /defaults write com\.openai\.codex SUEnableAutomaticChecks -bool true/);
  assert.match(calls, /defaults write com\.openai\.codex SUAutomaticallyUpdate -bool true/);
  assert.match(calls, /open -a ChatGPT/);
  assert.match(result.stdout, /"status": "ready"/);
  const migratedData = path.join(
    item.root,
    'codex-home',
    'plugins',
    'data',
    'ai-fleas-gpt-ai-fleas',
    'agent-bindings.json',
  );
  assert.equal(fs.readFileSync(migratedData, 'utf8'), '{"instances":{}}');
});

test('one-step setup fast-forwards and re-executes before honoring launch cancellation', () => {
  const item = fixture();
  const result = spawnSync('/bin/zsh', [setupScript], {
    encoding: 'utf8',
    timeout: 15_000,
    env: testEnvironment(item, { sourceUpdate: true }),
  });
  assertCanceledBeforeLifecycle(item, result);
  const calls = fs.readFileSync(item.log, 'utf8');
  assert.match(calls, /git .* fetch origin main/);
  assert.match(calls, /git .* merge-base --is-ancestor HEAD origin\/main/);
  assert.match(calls, /git .* merge --ff-only origin\/main/);
  assert.match(calls, /plugin add ai-fleas-gpt@ai-fleas/);
  assert.match(calls, /open -a ChatGPT/);
});

test('one-step setup skips a dirty checkout update and honors launch cancellation', () => {
  const item = fixture();
  const result = spawnSync('/bin/zsh', [setupScript], {
    encoding: 'utf8',
    timeout: 15_000,
    env: testEnvironment(item, { sourceUpdate: true, dirtyCheckout: true }),
  });
  assertCanceledBeforeLifecycle(item, result);
  assert.match(result.stdout, /source update skipped: the visible checkout has local changes/);
  const calls = fs.readFileSync(item.log, 'utf8');
  assert.doesNotMatch(calls, /fetch origin main/);
  assert.match(calls, /plugin add ai-fleas-gpt@ai-fleas/);
  assert.match(calls, /open -a ChatGPT/);
});

test('one-step setup uses the development branch and honors launch cancellation', () => {
  const item = fixture();
  const result = spawnSync('/bin/zsh', [setupScript], {
    encoding: 'utf8',
    timeout: 15_000,
    env: testEnvironment(item, { sourceUpdate: true, gitBranch: 'feature/test-launcher' }),
  });
  assertCanceledBeforeLifecycle(item, result);
  assert.match(result.stdout, /source update skipped on feature\/test-launcher/);
  const calls = fs.readFileSync(item.log, 'utf8');
  assert.doesNotMatch(calls, /fetch origin main/);
  assert.match(calls, /plugin add ai-fleas-gpt@ai-fleas/);
  assert.match(calls, /open -a ChatGPT/);
});

test('launch cancellation stops after one selection without a task or profile', () => {
  const item = fixture({ marketplace: true, plugins: true });
  const result = run(item, ['launch']);
  assertCanceledBeforeLifecycle(item, result);
  assert.equal(fs.existsSync(path.join(item.root, 'codex-home', 'plugins', 'data',
    'ai-fleas-gpt-ai-fleas', 'agent-bindings.json')), false);
});

test('launch cancellation leaves an existing Governor receipt unchanged', () => {
  const item = fixture({ marketplace: true, plugins: true });
  const pluginData = path.join(
    item.root,
    'codex-home',
    'plugins',
    'data',
    'ai-fleas-gpt-ai-fleas',
  );
  fs.mkdirSync(pluginData, { recursive: true });
  const registryFile = path.join(pluginData, 'agent-bindings.json');
  const receipt = JSON.stringify({
    instances: {
      'governor-task-id': {
        agentId: 'personal-governor',
        scope: { kind: 'governed-human', humanProfileId: 'example-human' },
        status: 'active',
      },
    },
  });
  fs.writeFileSync(registryFile, receipt);

  const result = run(item, ['launch']);
  assertCanceledBeforeLifecycle(item, result);
  const calls = fs.readFileSync(item.log, 'utf8');
  assert.match(calls, /default answer "example-human"/);
  assert.equal(fs.readFileSync(registryFile, 'utf8'), receipt);
});

test('launch finds the current Codex CLI bundled in ChatGPT when Finder PATH is minimal', () => {
  const item = fixture({ marketplace: true, plugins: true });
  const result = run(item, ['launch'], { finderEnvironment: true });
  assertCanceledBeforeLifecycle(item, result);
  assert.match(fs.readFileSync(item.log, 'utf8'), /open -a ChatGPT/);
});

const governorHumanDir = path.resolve(fileURLToPath(new URL('./fixtures/governor/example-human/', import.meta.url)));

// Exercise the controller/result boundary in process. Native transport and
// receipt reconciliation have their own suites; these host calls are injected.
for (const previous of ['absent', 'archived']) {
  test(`launch controller reports pending for one fresh task when Governor is ${previous}`, async () => {
    const oldId = '00000000-0000-4000-8000-000000000021';
    const taskId = '00000000-0000-4000-8000-000000000022';
    const registry = { instances: previous === 'archived' ? { [oldId]: {
      agentId: 'personal-governor', status: 'archived',
      scope: { kind: 'governed-human', humanProfileId: 'example-human' },
    } } : {} };
    const calls = [];
    const client = { request: async (method, params) => {
      calls.push({ method, params });
      assert.ok(['thread/start', 'thread/read'].includes(method), `Unexpected RPC: ${method}`);
      return { thread: { id: taskId, cwd: governorHumanDir, projectId: null,
        ephemeral: false, turns: [] } };
    } };
    let initializations = 0;
    const result = await ensurePersonalGovernor({ client, registryFile: '/unused/registry.json',
      humanId: 'example-human', humanDir: governorHumanDir,
      preflight: () => {}, readRegistry: () => registry, reconcile: async () => registry,
      hostState: async (_, id) => {
        assert.equal(id, taskId);
        return { archived: false, task: { id: taskId, projectId: null } };
      },
      initialize: async (_, __, id) => { assert.equal(id, taskId); initializations++; },
      wait: async (_, __, id) => ({ status: 'pending', taskId: id }),
      openTask: () => assert.fail('Pending task cannot be opened'),
      welcome: () => assert.fail('Pending activation cannot receive welcome INIT'),
    });
    assert.equal(initializations, 1);
    assert.equal(calls.filter(call => call.method === 'thread/start').length, 1);
    assert.equal(calls.find(call => call.method === 'thread/start').params.projectId, null);
    assert.equal(calls.some(call => call.params?.threadId === oldId), false);
    assert.deepEqual(result, { status: 'pending', taskId });
    const report = governorLaunchReport(result);
    assert.equal(report.platformStatus, 'AI Fleas GPT is pending.');
    assert.match(report.destination, /still pending/);
  });
}

test('launch controller reuses verified ready Governor and reports navigation without status INIT', async () => {
  const taskId = '00000000-0000-4000-8000-000000000023';
  const registry = { instances: { [taskId]: {
    agentId: 'personal-governor', status: 'active', activatedAt: '2026-10-03T12:00:00Z',
    scope: { kind: 'governed-human', humanProfileId: 'example-human' },
    initialization: { completedTurnId: 'ready-turn', readinessToken: 'PERSONAL_GOVERNOR_READY' },
  } } };
  const calls = [];
  const client = { request: async (method, params) => {
    calls.push({ method, params });
    if (method === 'threadSection/list') return { data: [{ id: 'pinned', name: 'Pinned' }] };
    if (method === 'thread/read') return { thread: { name: '🧭 Personal Governor', section: { id: 'pinned' } } };
    assert.ok(['thread/name/set', 'thread/section/move'].includes(method), `Unexpected RPC: ${method}`);
    return {};
  } };
  const result = await ensurePersonalGovernor({ client, registryFile: '/unused/registry.json',
    humanId: 'example-human', humanDir: governorHumanDir,
    preflight: () => {}, readRegistry: () => registry, reconcile: async () => registry,
    hostState: async (_, id) => {
      assert.equal(id, taskId);
      return { archived: false, task: { id: taskId, projectId: null } };
    },
    initialize: () => assert.fail('Ready Governor cannot be initialized again'),
    welcome: async () => ({ status: 'completed', turnId: 'welcome-turn' }),
  });
  assert.deepEqual(result, { status: 'existing', taskId, welcomeStatus: 'completed' });
  assert.equal(calls.some(call => ['thread/start', 'turn/start'].includes(call.method)), false);
  const report = governorLaunchReport(result);
  assert.equal(report.platformStatus, 'AI Fleas GPT is ready.');
  assert.match(report.destination, /welcome completion were verified/);
  assert.match(report.destination, /no activation INIT was queued/);
});

test('doctor reports migration-required for legacy and duplicate plugin copies', () => {
  const item = fixture({ marketplace: true, plugins: true, legacy: true });
  const result = run(item, ['doctor']);
  assert.equal(result.status, 2, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.status, 'migration-required');
  assert.deepEqual(report.conflictingPlugins, [
    'ai-fleas-agent-bootstrap@ai-fleas',
    'ai-fleas-workflow-router@ai-fleas',
    'ai-fleas-gpt@personal',
  ]);
});

test('setup requires explicit migration before replacing legacy or duplicate plugins', () => {
  const item = fixture({ marketplace: true, plugins: true, legacy: true });
  const bootstrapData = path.join(item.root, 'codex-home', 'plugins', 'data', 'ai-fleas-agent-bootstrap-ai-fleas');
  const routerData = path.join(item.root, 'codex-home', 'plugins', 'data', 'ai-fleas-workflow-router-ai-fleas');
  const orphanedPersonalData = path.join(item.root, 'codex-home', 'plugins', 'data', 'ai-fleas-agent-bootstrap-personal');
  fs.mkdirSync(bootstrapData, { recursive: true });
  fs.mkdirSync(path.join(routerData, 'correlations'), { recursive: true });
  fs.mkdirSync(orphanedPersonalData, { recursive: true });
  fs.writeFileSync(path.join(bootstrapData, 'agent-bindings.json'), '{"bindings":[]}');
  fs.writeFileSync(path.join(routerData, 'bindings.json'), '{"bindings":[]}');
  fs.writeFileSync(path.join(routerData, 'correlations', 'task.json'), '{"task":"bound"}');
  fs.writeFileSync(path.join(orphanedPersonalData, 'legacy-receipt.json'), '{"receipt":"preserved"}');
  const blocked = run(item, ['setup']);
  assert.equal(blocked.status, 1);
  assert.match(blocked.stderr, /--migrate/);
  assert.doesNotMatch(fs.readFileSync(item.log, 'utf8'), /plugin remove/);

  const migrated = run(item, ['setup', '--migrate']);
  assert.equal(migrated.status, 0, migrated.stderr);
  const calls = fs.readFileSync(item.log, 'utf8');
  assert.match(calls, /plugin add ai-fleas-gpt@ai-fleas/);
  assert.match(calls, /plugin remove ai-fleas-agent-bootstrap@ai-fleas/);
  assert.match(calls, /plugin remove ai-fleas-workflow-router@ai-fleas/);
  assert.match(calls, /plugin remove ai-fleas-gpt@personal/);
  const mergedData = path.join(item.root, 'codex-home', 'plugins', 'data', 'ai-fleas-gpt-ai-fleas');
  assert.equal(fs.readFileSync(path.join(mergedData, 'agent-bindings.json'), 'utf8'), '{"bindings":[]}');
  assert.equal(fs.readFileSync(path.join(mergedData, 'bindings.json'), 'utf8'), '{"bindings":[]}');
  assert.equal(fs.readFileSync(path.join(mergedData, 'correlations', 'task.json'), 'utf8'), '{"task":"bound"}');
  assert.equal(fs.readFileSync(path.join(mergedData, 'legacy-receipt.json'), 'utf8'), '{"receipt":"preserved"}');
});

test('doctor reports migration-required when marketplace name points to another checkout', () => {
  const item = fixture({ marketplace: true, plugins: true, staleMarketplace: true });
  const result = run(item, ['doctor']);
  assert.equal(result.status, 2, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.status, 'migration-required');
  assert.equal(report.marketplaceRootMismatch.configured, '/private/tmp/stale-ai-fleas');
  assert.equal(report.marketplaceRootMismatch.expected, repositoryRoot);
});

test('setup requires explicit migration before relocating a marketplace', () => {
  const item = fixture({ marketplace: true, plugins: true, staleMarketplace: true });
  const blocked = run(item, ['setup']);
  assert.equal(blocked.status, 1);
  assert.match(blocked.stderr, /--migrate to relocate it/);
  assert.doesNotMatch(fs.readFileSync(item.log, 'utf8'), /plugin marketplace remove/);

  const migrated = run(item, ['setup', '--migrate']);
  assert.equal(migrated.status, 0, migrated.stderr);
  const calls = fs.readFileSync(item.log, 'utf8');
  assert.match(calls, /plugin marketplace remove ai-fleas/);
  assert.match(calls, /plugin marketplace add/);
});
