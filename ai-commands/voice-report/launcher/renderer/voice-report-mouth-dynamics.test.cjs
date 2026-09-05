const assert = require('node:assert/strict');
const { test } = require('node:test');

const dynamics = require('./voice-report-mouth-dynamics.js');

test('synthetic mouth level stays silent when idle and varies while fallback speaking', () => {
  assert.equal(dynamics.syntheticMouthLevel({ visualSpeaking: false, audioPaused: true, audioEnded: false, nowSeconds: 1 }), 0);

  const levels = [0.10, 0.16, 0.22, 0.28, 0.34].map((nowSeconds) => dynamics.syntheticMouthLevel({
    visualSpeaking: true,
    audioPaused: true,
    audioEnded: false,
    nowSeconds
  }));

  assert.ok(Math.max(...levels) > 0.65, `expected open mouth level, got ${levels.join(', ')}`);
  assert.ok(Math.max(...levels) - Math.min(...levels) > 0.25, `expected visible mouth variation, got ${levels.join(', ')}`);
});

test('analyzer mouth level follows multimedia workflow RMS response', () => {
  const quiet = new Uint8Array(1024).fill(128);
  const loud = new Uint8Array(1024).map((_, index) => index % 2 === 0 ? 72 : 184);

  const quietResult = dynamics.analyzerMouthLevel(quiet, 0);
  assert.equal(quietResult.target, 0);
  assert.equal(quietResult.level, 0);

  const loudResult = dynamics.analyzerMouthLevel(loud, 0);
  assert.ok(loudResult.rms > 0.4, `expected loud RMS, got ${loudResult.rms}`);
  assert.ok(loudResult.target > 0.9, `expected high target, got ${loudResult.target}`);
  assert.ok(loudResult.level > 0.7, `expected fast opening response, got ${loudResult.level}`);

  const closingResult = dynamics.analyzerMouthLevel(quiet, loudResult.level);
  assert.ok(closingResult.level < loudResult.level, 'quiet input should close the mouth');
  assert.ok(closingResult.level > 0, 'closing should be smoothed, not instant');
});

test('mouth style maps level into visible lip movement variables', () => {
  const closed = dynamics.mouthStyle(0);
  const open = dynamics.mouthStyle(1);

  assert.equal(closed.mouthOpen, '0.18');
  assert.equal(open.mouthOpen, '2.5300000000000002');
  assert.equal(closed.mouthShift, '0px');
  assert.equal(open.mouthShift, '1.5px');
  assert.ok(Number(open.mouthLipOpacity) < Number(closed.mouthLipOpacity));
  assert.ok(Number(open.mouthHighlightOpacity) < Number(closed.mouthHighlightOpacity));
});
