import assert from 'node:assert/strict';
import test from 'node:test';
import { withQueuedFollowUps } from './desktop-preferences.mjs';

test('changes only the desktop follow-up mode and is idempotent', () => {
  const original = 'model = "gpt-6-sol"\n\n[desktop]\nfollowUpQueueMode = "steer"\nconversationDetailMode = "STEPS_COMMANDS"\n\n[plugins.example]\nenabled = true\n';
  const expected = original.replace('followUpQueueMode = "steer"', 'followUpQueueMode = "queue"');
  assert.equal(withQueuedFollowUps(original), expected);
  assert.equal(withQueuedFollowUps(expected), expected);
});

test('adds the setting to an existing desktop section without moving other sections', () => {
  assert.equal(withQueuedFollowUps('[desktop]\nambient = true\n\n[plugins.example]\nenabled = true\n'),
    '[desktop]\nambient = true\n\nfollowUpQueueMode = "queue"\n[plugins.example]\nenabled = true\n');
});

test('adds a desktop section if missing and rejects ambiguous sections', () => {
  assert.equal(withQueuedFollowUps('model = "gpt-6-sol"\n'),
    'model = "gpt-6-sol"\n\n[desktop]\nfollowUpQueueMode = "queue"\n');
  assert.throws(() => withQueuedFollowUps('[desktop]\n[desktop]\n'), /duplicate/);
});
