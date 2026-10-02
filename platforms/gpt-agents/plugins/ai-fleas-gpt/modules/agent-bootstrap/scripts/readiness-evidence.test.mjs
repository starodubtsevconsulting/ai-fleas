/**
 * Purpose: check the production readiness matcher with in-memory host events.
 * Caller: node --test readiness-evidence.test.mjs; output: TAP.
 * Effects: no files, agents, runtime bindings, or temporary directories are created.
 * A pass proves matching checks only, not live host initialization.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { initializationCompletion } from './readiness-evidence.mjs';
const binding = { status: 'pending', initialization: { startedAt: '2026-01-01T00:00:00Z', turnId: 'turn-one', readinessToken: 'ADMIN_READY' } };
const event = { hook_event_name: 'Stop', turn_id: 'turn-one', last_assistant_message: 'ADMIN_READY' };
test('matching pending Admin turn retains completion evidence in the existing binding', () => {
  assert.deepEqual(initializationCompletion(binding, event, new Date('2026-01-01T00:01:00Z')),
    { completedTurnId: 'turn-one', completedAt: '2026-01-01T00:01:00.000Z' });
});
test('wrong turns, events, tokens and nonpending bindings do not prove readiness', () => {
  for (const change of [{ turn_id: 'wrong' }, { hook_event_name: 'UserPromptSubmit' },
    { last_assistant_message: 'Admin is ADMIN_READY' }, { last_assistant_message: 'BLOCKED' }]) {
    assert.equal(initializationCompletion(binding, { ...event, ...change }), null);
  }
  assert.equal(initializationCompletion({ ...binding, status: 'active' }, event), null);
  assert.equal(initializationCompletion({ status: 'pending', initialization: { readinessToken: 'ADMIN_READY' } }, event), null);
});
