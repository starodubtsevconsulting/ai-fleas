const assert = require('node:assert/strict');
const { test } = require('node:test');

const { applyTimingEdit } = require('./lyrics-timestamp-timing.js');

test('moving a line end forward moves next line start to prevent overlap', () => {
  const lines = [
    { index: 1, startMs: 0, endMs: 3000, text: 'one' },
    { index: 2, startMs: 3000, endMs: 7000, text: 'two' },
    { index: 3, startMs: 7000, endMs: 11000, text: 'three' }
  ];

  const changed = applyTimingEdit(lines, 1, 'endMs', '8.250');

  assert.deepEqual(changed, [1, 2]);
  assert.equal(lines[1].endMs, 8250);
  assert.equal(lines[2].startMs, 8250);
  assert.equal(lines[2].endMs, 11000);
});

test('moving a line start backward moves previous line end to prevent overlap', () => {
  const lines = [
    { index: 1, startMs: 0, endMs: 3000, text: 'one' },
    { index: 2, startMs: 3000, endMs: 7000, text: 'two' },
    { index: 3, startMs: 7000, endMs: 11000, text: 'three' }
  ];

  const changed = applyTimingEdit(lines, 1, 'startMs', '2.500');

  assert.deepEqual(changed, [0, 1]);
  assert.equal(lines[0].endMs, 2500);
  assert.equal(lines[1].startMs, 2500);
  assert.equal(lines[1].endMs, 7000);
});

test('line duration remains positive when adjacent line cannot move past its own start', () => {
  const lines = [
    { index: 1, startMs: 0, endMs: 1000, text: 'one' },
    { index: 2, startMs: 1000, endMs: 1001, text: 'two' }
  ];

  const changed = applyTimingEdit(lines, 0, 'endMs', '2.000');

  assert.deepEqual(changed, [0, 1]);
  assert.equal(lines[0].endMs, 1000);
  assert.equal(lines[1].startMs, 1000);
  assert.equal(lines[1].endMs, 1001);
});
