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
