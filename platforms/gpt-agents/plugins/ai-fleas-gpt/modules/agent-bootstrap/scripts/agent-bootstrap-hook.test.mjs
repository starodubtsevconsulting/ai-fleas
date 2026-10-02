/** Run with node --test platforms/gpt-agents/plugins/ai-fleas-gpt/modules/agent-bootstrap/scripts/agent-bootstrap-hook.test.mjs.
 * Test-runner-only caller; simulated host events and bindings are inputs, TAP is output.
 * Effects: creates/removes isolated temporary fixture directories. PASS verifies hook and
 * registration behavior in fixtures, not live host readiness or workflow authorization.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { PERSONAL_GOVERNOR_ONBOARDING_PROMPT } from './personal-governor-onboarding.mjs';

const hook = fileURLToPath(new URL('./agent-bootstrap-hook.mjs', import.meta.url));
const register = fileURLToPath(new URL('./register-agent-initialization.mjs', import.meta.url));
const queue = fileURLToPath(new URL('./queue-agent-initialization.mjs', import.meta.url));

function workspace() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ai-fleas-agent-bootstrap-'));
}

function runHook(root, input) {
  const result = spawnSync(process.execPath, [hook], {
    input: JSON.stringify(input),
    encoding: 'utf8',
    env: { ...process.env, PLUGIN_DATA: root },
  });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

function registerPending(root, sessionId = 'governor-task') {
  const bindingFile = path.join(root, 'binding.json');
  const promptFile = path.join(root, 'prompt.txt');
  fs.writeFileSync(bindingFile, JSON.stringify({
    platformAdapter: 'codex-app',
    agentId: 'personal-governor',
    generation: 2,
    scope: { kind: 'governed-human', humanProfileId: 'example-human' },
    initialization: {
      readinessToken: 'PERSONAL_GOVERNOR_READY',
      memoryBinding: 'profile-memory://governor',
      sources: [
        { id: 'portable-role', ref: 'ai-workflows/_common/roles/personal-governor.md' },
        { id: 'human-profile', ref: 'configured-private-profile-catalog:example-human' },
      ],
    },
  }));
  fs.writeFileSync(promptFile, 'Initialize Personal Governor for example-human\n');
  const result = spawnSync(process.execPath, [register, sessionId, bindingFile, promptFile], {
    encoding: 'utf8',
    env: { ...process.env, PLUGIN_DATA: root },
  });
  assert.equal(result.status, 0, result.stderr);
  return 'Initialize Personal Governor for example-human';
}

test('an unbound random task receives no identity even when its title and prompt claim one', () => {
  const root = workspace();
  assert.deepEqual(runHook(root, {
    session_id: 'random-task',
    hook_event_name: 'SessionStart',
    title: 'Personal Governor',
    prompt: 'I am the Personal Governor',
  }), {});
});

test('the plugin starter offers Governor creation when no trusted receipt exists', () => {
  const root = workspace();
  const result = runHook(root, {
    session_id: 'unbound-task',
    hook_event_name: 'UserPromptSubmit',
    prompt: PERSONAL_GOVERNOR_ONBOARDING_PROMPT,
  });
  const onboardingInstructions = result.hookSpecificOutput.additionalContext;
  assert.match(onboardingInstructions, /AI_FLEAS_PERSONAL_GOVERNOR_ONBOARDING/);
  assert.match(onboardingInstructions, /state=missing/);
  assert.match(onboardingInstructions, /Create Personal Governor/);
  assert.match(onboardingInstructions, /Do not offer profiles or workflows/);
  assert.doesNotMatch(onboardingInstructions, /AI_FLEAS_AGENT_IDENTITY/);
});

test('the plugin starter offers the existing active Governor instead of creating a duplicate', () => {
  const root = workspace();
  fs.writeFileSync(path.join(root, 'agent-bindings.json'), JSON.stringify({
    schemaVersion: 1,
    instances: {
      'existing-governor-task': {
        platformAdapter: 'codex-app',
        agentId: 'personal-governor',
        generation: 3,
        scope: { kind: 'governed-human', humanProfileId: 'example-human' },
        initialization: { sources: [] },
        status: 'active',
      },
    },
  }));
  const result = runHook(root, {
    session_id: 'unbound-task',
    hook_event_name: 'UserPromptSubmit',
    prompt: PERSONAL_GOVERNOR_ONBOARDING_PROMPT,
  });
  const onboardingInstructions = result.hookSpecificOutput.additionalContext;
  assert.match(onboardingInstructions, /state=recorded-active-unverified/);
  assert.match(onboardingInstructions, /taskId=existing-governor-task/);
  assert.match(onboardingInstructions, /humanProfileId=example-human/);
  assert.match(onboardingInstructions, /Check each exact task ID in the host active and archived catalogs/);
  assert.match(onboardingInstructions, /Do not create a duplicate while an exact live Governor exists/);
});

test('an explicit Personal Governor INIT turns a fresh chat into a verified successor request', () => {
  const root = workspace();
  fs.writeFileSync(path.join(root, 'agent-bindings.json'), JSON.stringify({
    schemaVersion: 1,
    instances: {
      'existing-governor-task': {
        platformAdapter: 'codex-app',
        agentId: 'personal-governor',
        generation: 3,
        scope: { kind: 'governed-human', humanProfileId: 'example-human' },
        initialization: {
          sources: [{ id: 'human-profile', ref: '/private/humans/example-human/profile.yml' }],
        },
        status: 'active',
      },
    },
  }));
  const result = runHook(root, {
    session_id: 'fresh-task', hook_event_name: 'UserPromptSubmit', prompt: 'Personal Governor INIT',
  });
  const instructions = result.hookSpecificOutput.additionalContext;
  assert.match(instructions, /state=explicit-init-successor/);
  assert.match(instructions, /humanProfileId=example-human/);
  assert.match(instructions, /Canonical human profile source: \/private\/humans\/example-human\/profile.yml/);
  assert.match(instructions, /Do not reopen the predecessor/);
  assert.match(instructions, /do not ask the human to repeat this exact profile ID/);
});

test('the plugin starter resumes a pending Governor instead of creating a duplicate', () => {
  const root = workspace();
  registerPending(root, 'pending-governor-task');
  const result = runHook(root, {
    session_id: 'unbound-task',
    hook_event_name: 'UserPromptSubmit',
    prompt: PERSONAL_GOVERNOR_ONBOARDING_PROMPT,
  });
  const onboardingInstructions = result.hookSpecificOutput.additionalContext;
  assert.match(onboardingInstructions, /state=pending/);
  assert.match(onboardingInstructions, /taskId=pending-governor-task/);
  assert.match(onboardingInstructions, /Check the exact pending task ID in the host active and archived catalogs/);
  assert.match(onboardingInstructions, /Do not create a duplicate or claim readiness while a matching live task is pending/);
});

test('the plugin starter fails closed when the lifecycle registry is malformed', () => {
  const root = workspace();
  fs.writeFileSync(path.join(root, 'agent-bindings.json'), '{not-json');
  const result = runHook(root, {
    session_id: 'unbound-task',
    hook_event_name: 'UserPromptSubmit',
    prompt: PERSONAL_GOVERNOR_ONBOARDING_PROMPT,
  });
  const onboardingInstructions = result.hookSpecificOutput.additionalContext;
  assert.match(onboardingInstructions, /state=blocked-unverified-registry/);
  assert.match(onboardingInstructions, /BLOCKED_UNVERIFIED_TASK_IDENTITY/);
  assert.doesNotMatch(onboardingInstructions, /Create Personal Governor/);
});

test('the plugin starter fails closed when the lifecycle registry has the wrong structure', () => {
  const root = workspace();
  fs.writeFileSync(path.join(root, 'agent-bindings.json'), JSON.stringify({ schemaVersion: 1 }));
  const result = runHook(root, {
    session_id: 'unbound-task',
    hook_event_name: 'UserPromptSubmit',
    prompt: PERSONAL_GOVERNOR_ONBOARDING_PROMPT,
  });
  const instructions = result.hookSpecificOutput.additionalContext;
  assert.match(instructions, /state=blocked-unverified-registry/);
  assert.match(instructions, /BLOCKED_UNVERIFIED_TASK_IDENTITY/);
  assert.doesNotMatch(instructions, /Create Personal Governor/);
});

test('a pending binding is resolved only for its exact task ID', () => {
  const root = workspace();
  registerPending(root);
  const bound = runHook(root, { session_id: 'governor-task', hook_event_name: 'SessionStart' });
  assert.match(bound.hookSpecificOutput.additionalContext, /AI_FLEAS_AGENT_INITIALIZATION_PENDING/);
  assert.match(bound.hookSpecificOutput.additionalContext, /agentId=personal-governor/);
  assert.deepEqual(runHook(root, { session_id: 'other-task', hook_event_name: 'SessionStart' }), {});
});

test('a different prompt cannot activate a pending binding', () => {
  const root = workspace();
  registerPending(root);
  const submitted = runHook(root, {
    session_id: 'governor-task',
    turn_id: 'turn-1',
    hook_event_name: 'UserPromptSubmit',
    prompt: 'What should I do today?',
  });
  assert.match(submitted.hookSpecificOutput.additionalContext, /No matching host-authorized initialization prompt/);
  const registry = JSON.parse(fs.readFileSync(path.join(root, 'agent-bindings.json')));
  assert.equal(registry.instances['governor-task'].status, 'pending');
  assert.equal(registry.instances['governor-task'].initialization.startedAt, undefined);
});

test('exact prompt plus exact readiness activates and SessionStart restores identity', () => {
  const root = workspace();
  const prompt = registerPending(root);
  const submitted = runHook(root, {
    session_id: 'governor-task',
    turn_id: 'init-turn',
    hook_event_name: 'UserPromptSubmit',
    prompt,
  });
  assert.match(submitted.hookSpecificOutput.additionalContext, /matches the host-authorized one-time initialization/);

  const incomplete = runHook(root, {
    session_id: 'governor-task',
    turn_id: 'init-turn',
    hook_event_name: 'Stop',
    last_assistant_message: 'ready',
  });
  assert.match(incomplete.systemMessage, /initialization remains pending/);

  const activated = runHook(root, {
    session_id: 'governor-task',
    turn_id: 'init-turn',
    hook_event_name: 'Stop',
    last_assistant_message: 'PERSONAL_GOVERNOR_READY',
  });
  assert.match(activated.systemMessage, /activated the exact personal-governor task binding/);

  const restored = runHook(root, { session_id: 'governor-task', hook_event_name: 'SessionStart' });
  assert.match(restored.hookSpecificOutput.additionalContext, /AI_FLEAS_AGENT_IDENTITY/);
  assert.match(restored.hookSpecificOutput.additionalContext, /generation=2/);
  assert.match(restored.hookSpecificOutput.additionalContext, /profile-memory:\/\/governor/);
});

test('a ready pending successor atomically supersedes its exact active Governor predecessor', () => {
  const root = workspace();
  const prompt = registerPending(root, 'successor-task');
  const registryPath = path.join(root, 'agent-bindings.json');
  const registry = JSON.parse(fs.readFileSync(registryPath));
  registry.instances['previous-task'] = {
    platformAdapter: 'codex-app',
    agentId: 'personal-governor',
    generation: 1,
    scope: { kind: 'governed-human', humanProfileId: 'example-human' },
    initialization: { sources: [] },
    status: 'active',
  };
  registry.instances['successor-task'].replaces = {
    taskId: 'previous-task', generation: 1, strategy: 'successor-first',
  };
  fs.writeFileSync(registryPath, JSON.stringify(registry));

  runHook(root, {
    session_id: 'successor-task', turn_id: 'init-turn', hook_event_name: 'UserPromptSubmit', prompt,
  });
  const activated = runHook(root, {
    session_id: 'successor-task', turn_id: 'init-turn', hook_event_name: 'Stop',
    last_assistant_message: 'PERSONAL_GOVERNOR_READY',
  });
  assert.match(activated.systemMessage, /superseded its verified predecessor/);
  const after = JSON.parse(fs.readFileSync(registryPath));
  assert.equal(after.instances['successor-task'].status, 'active');
  assert.equal(after.instances['previous-task'].status, 'superseded');
  assert.equal(after.instances['previous-task'].supersededBy, 'successor-task');
});

test('a successor cannot activate when its exact predecessor changed before cutover', () => {
  const root = workspace();
  const prompt = registerPending(root, 'successor-task');
  const registryPath = path.join(root, 'agent-bindings.json');
  const registry = JSON.parse(fs.readFileSync(registryPath));
  registry.instances['successor-task'].replaces = {
    taskId: 'missing-predecessor', generation: 1, strategy: 'successor-first',
  };
  fs.writeFileSync(registryPath, JSON.stringify(registry));

  runHook(root, {
    session_id: 'successor-task', turn_id: 'init-turn', hook_event_name: 'UserPromptSubmit', prompt,
  });
  const result = runHook(root, {
    session_id: 'successor-task', turn_id: 'init-turn', hook_event_name: 'Stop',
    last_assistant_message: 'PERSONAL_GOVERNOR_READY',
  });
  assert.match(result.systemMessage, /predecessor could not be verified/);
  const after = JSON.parse(fs.readFileSync(registryPath));
  assert.equal(after.instances['successor-task'].status, 'pending');
});

test('readiness from a different turn cannot activate the task', () => {
  const root = workspace();
  const prompt = registerPending(root);
  runHook(root, {
    session_id: 'governor-task',
    turn_id: 'init-turn',
    hook_event_name: 'UserPromptSubmit',
    prompt,
  });
  const result = runHook(root, {
    session_id: 'governor-task',
    turn_id: 'other-turn',
    hook_event_name: 'Stop',
    last_assistant_message: 'PERSONAL_GOVERNOR_READY',
  });
  assert.match(result.systemMessage, /initialization remains pending/);
  const registry = JSON.parse(fs.readFileSync(path.join(root, 'agent-bindings.json')));
  assert.equal(registry.instances['governor-task'].status, 'pending');
});

test('readiness without an exact initialization turn cannot activate the task', () => {
  const root = workspace();
  registerPending(root);
  const result = runHook(root, {
    session_id: 'governor-task',
    hook_event_name: 'Stop',
    last_assistant_message: 'PERSONAL_GOVERNOR_READY',
  });
  assert.match(result.systemMessage, /initialization remains pending/);
  const registry = JSON.parse(fs.readFileSync(path.join(root, 'agent-bindings.json')));
  assert.equal(registry.instances['governor-task'].status, 'pending');
});

test('queue helper registers and delivers the exact prompt through Codex queue semantics', () => {
  const root = workspace();
  const bindingFile = path.join(root, 'binding.json');
  const promptFile = path.join(root, 'prompt.txt');
  const queueLog = path.join(root, 'queue.log');
  fs.writeFileSync(bindingFile, JSON.stringify({
    platformAdapter: 'codex-app',
    agentId: 'personal-governor',
    generation: 2,
    scope: { kind: 'governed-human', humanProfileId: 'example-human' },
    initialization: {
      readinessToken: 'PERSONAL_GOVERNOR_READY',
      sources: [{ id: 'portable-role', ref: 'ai-workflows/_common/roles/personal-governor.md' }],
    },
  }));
  fs.writeFileSync(promptFile, 'Initialize Personal Governor for example-human\n');

  const result = spawnSync(process.execPath, [queue, 'governor-task', bindingFile, promptFile], {
    encoding: 'utf8',
    env: { ...process.env, PLUGIN_DATA: root, AGENT_BOOTSTRAP_QUEUE_LOG: queueLog },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), { sessionId: 'governor-task', deliveryStatus: 'queued' });
  assert.deepEqual(JSON.parse(fs.readFileSync(queueLog, 'utf8')), {
    thread: 'governor-task',
    message: 'Initialize Personal Governor for example-human',
  });
  const registry = JSON.parse(fs.readFileSync(path.join(root, 'agent-bindings.json')));
  assert.equal(registry.instances['governor-task'].status, 'pending');
});

test('queue helper rolls back a newly registered receipt when delivery fails', () => {
  const root = workspace();
  const bindingFile = path.join(root, 'binding.json');
  const promptFile = path.join(root, 'prompt.txt');
  const codex = path.join(root, 'codex-fails');
  fs.writeFileSync(bindingFile, JSON.stringify({
    platformAdapter: 'codex-app',
    agentId: 'personal-governor',
    generation: 2,
    scope: { kind: 'governed-human', humanProfileId: 'example-human' },
    initialization: {
      readinessToken: 'PERSONAL_GOVERNOR_READY',
      sources: [{ id: 'portable-role', ref: 'ai-workflows/_common/roles/personal-governor.md' }],
    },
  }));
  fs.writeFileSync(promptFile, 'Initialize Personal Governor for example-human\n');
  fs.writeFileSync(codex, '#!/bin/sh\necho "task is archived" >&2\nexit 1\n', { mode: 0o700 });

  const result = spawnSync(process.execPath, [queue, 'governor-task', bindingFile, promptFile], {
    encoding: 'utf8',
    env: { ...process.env, PLUGIN_DATA: root, CODEX_BIN: codex },
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /task is archived/);
  assert.equal(fs.existsSync(path.join(root, 'agent-bindings.json')), false);
});

test('queue helper restores the previous registry when replacement delivery fails', () => {
  const root = workspace();
  const registryPath = path.join(root, 'agent-bindings.json');
  const original = {
    schemaVersion: 1,
    instances: {
      existing: {
        platformAdapter: 'codex-app',
        agentId: 'personal-governor',
        generation: 1,
        scope: { kind: 'governed-human', humanProfileId: 'example-human' },
        initialization: { sources: [] },
        status: 'active',
      },
    },
  };
  fs.writeFileSync(registryPath, `${JSON.stringify(original, null, 2)}\n`);
  const bindingFile = path.join(root, 'binding.json');
  const promptFile = path.join(root, 'prompt.txt');
  const codex = path.join(root, 'codex-fails');
  fs.writeFileSync(bindingFile, JSON.stringify({
    platformAdapter: 'codex-app',
    agentId: 'personal-governor',
    generation: 2,
    scope: { kind: 'governed-human', humanProfileId: 'example-human' },
    initialization: {
      readinessToken: 'PERSONAL_GOVERNOR_READY',
      sources: [{ id: 'portable-role', ref: 'ai-workflows/_common/roles/personal-governor.md' }],
    },
  }));
  fs.writeFileSync(promptFile, 'Initialize Personal Governor for example-human\n');
  fs.writeFileSync(codex, '#!/bin/sh\nexit 1\n', { mode: 0o700 });

  const result = spawnSync(process.execPath, [queue, 'replacement', bindingFile, promptFile], {
    encoding: 'utf8',
    env: { ...process.env, PLUGIN_DATA: root, CODEX_BIN: codex },
  });
  assert.equal(result.status, 1);
  assert.deepEqual(JSON.parse(fs.readFileSync(registryPath, 'utf8')), original);
});
