import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const hook = fileURLToPath(new URL('./agent-bootstrap-hook.mjs', import.meta.url));
const register = fileURLToPath(new URL('./register-agent-initialization.mjs', import.meta.url));

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
    platformAdapter: 'gpt-agents',
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

  const blocked = runHook(root, {
    session_id: 'governor-task',
    turn_id: 'init-turn',
    hook_event_name: 'Stop',
    last_assistant_message: 'ready',
  });
  assert.equal(blocked.decision, 'block');

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
  assert.equal(result.decision, 'block');
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
  assert.equal(result.decision, 'block');
  const registry = JSON.parse(fs.readFileSync(path.join(root, 'agent-bindings.json')));
  assert.equal(registry.instances['governor-task'].status, 'pending');
});
