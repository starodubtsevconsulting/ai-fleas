const assert = require('node:assert/strict');
const test = require('node:test');
const actions = require('./cloudflare-ui-actions.cjs');

test('extracts only the public host from redacted validation output', () => {
  assert.equal(
    actions.publicUrlFromValidation('cloudflare configuration valid: tunnel=example public_host=ai.example.invalid approved_identities=2'),
    'https://ai.example.invalid'
  );
});

test('redacts connector tokens from logs', () => {
  assert.equal(actions.safeLog('cloudflared run --token secret-value'), 'cloudflared run --token [REDACTED]');
  assert.equal(actions.safeLog('Authorization: Bearer secret-value'), 'Authorization: Bearer [REDACTED]');
});

test('counts connector processes and exposes duplicate conflicts', () => {
  assert.equal(actions.countPids('101\n202\n'), 2);
  assert.equal(actions.countPids('', false), 0);
});

test('detects a connector owned by another controller from command status', () => {
  assert.equal(actions.connectorIsOpen({ ok: true, stdout: 'connector open: tunnel=example pid=123\n' }), true);
  assert.equal(actions.connectorIsOpen({ ok: true, stdout: 'connector closed: tunnel=example\n' }), false);
});

test('reads the persistent controller desired state', () => {
  assert.equal(actions.controllerWantsRunning({ ok: true, stdout: 'controller desired: running server=example\n' }), true);
  assert.equal(actions.controllerWantsRunning({ ok: true, stdout: 'controller desired: stopped server=example\n' }), false);
  assert.equal(actions.controllerWantsRunning({ ok: false, stdout: '' }), false);
});
