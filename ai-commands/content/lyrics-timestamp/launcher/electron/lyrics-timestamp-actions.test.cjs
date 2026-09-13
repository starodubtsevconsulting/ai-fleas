const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const actions = require('./lyrics-timestamp-actions.cjs');

test('Lyrics Timestamp launcher builds map args', () => {
  assert.deepEqual(actions.mapArgs({
    lyricsFile: '/tmp/lyrics.txt',
    audioFile: '/tmp/song.mp3',
    dist: '/tmp/out',
    tailMs: 500,
    timingHintsFile: '/tmp/hints.json'
  }), [
    'map',
    '--lyrics-file', '/tmp/lyrics.txt',
    '--audio-file', '/tmp/song.mp3',
    '--dist', '/tmp/out',
    '--line-mode', 'non-empty',
    '--format', 'json,srt',
    '--tail-ms', '500',
    '--timing-hints-file', '/tmp/hints.json'
  ]);
});


test('Lyrics Timestamp launcher loads existing mapped JSON and SRT from output folder', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lyrics-timestamp-existing-'));
  const jsonPath = path.join(root, 'lyrics-timestamp.json');
  const srtPath = path.join(root, 'lyrics-timestamp.srt');
  fs.writeFileSync(jsonPath, JSON.stringify({ lines: [{ index: 1, startMs: 123, endMs: 456, text: 'loaded' }] }), 'utf8');
  fs.writeFileSync(srtPath, '1\n00:00:00,123 --> 00:00:00,456\nloaded\n', 'utf8');

  const result = actions.loadExistingMappedLyrics({ dist: root }, fs);

  assert.equal(result.found, true);
  assert.equal(result.saved, true);
  assert.equal(result.jsonPath, jsonPath);
  assert.equal(result.payload.lines[0].text, 'loaded');
  assert.match(result.srt, /loaded/);
});

test('Lyrics Timestamp launcher reports no existing mapped output when JSON is absent', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lyrics-timestamp-no-existing-'));

  const result = actions.loadExistingMappedLyrics({ dist: root }, fs);

  assert.equal(result.found, false);
  assert.equal(result.jsonPath, path.join(root, 'lyrics-timestamp.json'));
});


test('Lyrics Timestamp launcher guard rejects mapping when mapped JSON already exists', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lyrics-timestamp-guard-'));
  const jsonPath = path.join(root, 'lyrics-timestamp.json');
  fs.writeFileSync(jsonPath, JSON.stringify({ lines: [] }), 'utf8');

  assert.throws(
    () => actions.assertNoExistingMappedOutput({ dist: root }, fs),
    /Refusing to run mapping because mapped output already exists/
  );
});

test('Lyrics Timestamp launcher does not invoke mapper when mapped JSON already exists', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lyrics-timestamp-map-guard-'));
  fs.writeFileSync(path.join(root, 'lyrics-timestamp.json'), JSON.stringify({ lines: [] }), 'utf8');
  let runCommandCalled = false;

  await assert.rejects(
    () => actions.mapLyrics({
      lyricsFile: '/tmp/lyrics.txt',
      audioFile: '/tmp/song.mp3',
      dist: root
    }, { commandDir: '/tmp/command' }, async () => {
      runCommandCalled = true;
      return { stdout: '{}', stderr: '' };
    }, fs),
    /Refusing to run mapping because mapped output already exists/
  );
  assert.equal(runCommandCalled, false);
});

test('Lyrics Timestamp launcher previews generated JSON and SRT without writing mapped files', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lyrics-timestamp-launcher-'));
  const jsonPath = path.join(root, 'lyrics-timestamp.json');
  const srtPath = path.join(root, 'lyrics-timestamp.srt');
  let receivedArgs = [];

  const result = await actions.mapLyrics({
    lyricsFile: '/tmp/lyrics.txt',
    audioFile: '/tmp/song.mp3',
    dist: root
  }, { commandDir: '/tmp/command' }, async (args) => {
    receivedArgs = args;
    return {
      stdout: JSON.stringify({
        payload: { lines: [{ index: 1, startMs: 0, endMs: 1000, text: 'hello' }] },
        srt: '1\n00:00:00,000 --> 00:00:01,000\nhello\n'
      }),
      stderr: ''
    };
  }, fs);

  assert.equal(receivedArgs[0], 'preview');
  assert.equal(result.jsonPath, jsonPath);
  assert.equal(result.payload.lines[0].text, 'hello');
  assert.match(result.srt, /00:00:00,000/);
  assert.equal(fs.existsSync(jsonPath), false);
  assert.equal(fs.existsSync(srtPath), false);
});

test('Lyrics Timestamp launcher saves the latest preview when Save is pressed', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lyrics-timestamp-save-'));
  const jsonPath = path.join(root, 'lyrics-timestamp.json');
  const srtPath = path.join(root, 'lyrics-timestamp.srt');

  const result = await actions.saveMappedLyrics({
    lyricsFile: '/tmp/lyrics.txt',
    audioFile: '/tmp/song.mp3',
    dist: root
  }, {
    payload: { lines: [{ index: 1, startMs: 0, endMs: 1000, text: 'hello' }] },
    srt: '1\n00:00:00,000 --> 00:00:01,000\nhello\n'
  }, fs);

  assert.equal(result.saved, true);
  assert.equal(JSON.parse(fs.readFileSync(jsonPath, 'utf8')).lines[0].text, 'hello');
  assert.match(fs.readFileSync(srtPath, 'utf8'), /hello/);
});


test('Lyrics Timestamp launcher does not report or write SRT for JSON-only save', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lyrics-timestamp-save-json-'));

  const result = await actions.saveMappedLyrics({
    lyricsFile: '/tmp/lyrics.txt',
    audioFile: '/tmp/song.mp3',
    dist: root,
    format: 'json'
  }, {
    payload: { lines: [{ index: 1, startMs: 0, endMs: 1000, text: 'hello' }] },
    srt: '1\n00:00:00,000 --> 00:00:01,000\nhello\n'
  }, fs);

  assert.equal(result.saved, true);
  assert.equal(result.srtPath, '');
  assert.equal(fs.existsSync(path.join(root, 'lyrics-timestamp.json')), true);
  assert.equal(fs.existsSync(path.join(root, 'lyrics-timestamp.srt')), false);
});

test('Lyrics Timestamp launcher defaults paths from selected multimedia video context', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lyrics-timestamp-context-'));
  const videoPath = path.join(root, 'Poems', ' John Keats', 'Bright star');
  const lyricsPath = path.join(videoPath, 'lyrics', 'lyrics.md');
  const audioPath = path.join(videoPath, 'audio', 'slower', 'voice.mp3');
  const hintsPath = path.join(videoPath, 'lyrics', 'timing-hints.json');
  fs.mkdirSync(path.dirname(lyricsPath), { recursive: true });
  fs.mkdirSync(path.dirname(audioPath), { recursive: true });
  fs.writeFileSync(lyricsPath, 'Bright star', 'utf8');
  fs.writeFileSync(audioPath, 'mp3', 'utf8');
  fs.writeFileSync(hintsPath, '{"lines":[]}', 'utf8');

  const defaults = actions.defaults({
    commandDir: '/tmp/command',
    launchContext: {
      scopeType: 'video',
      scopePath: videoPath,
      videoPath,
      suggestedTextFilePath: lyricsPath,
      outputPath: path.join(videoPath, 'lyrics', 'subtitles'),
      timingHintsFilePath: hintsPath,
      breadcrumbLabel: 'example > multimedia > Poems > John Keats > Bright star'
    }
  }, fs);

  assert.equal(defaults.lyricsFile, lyricsPath);
  assert.equal(defaults.audioFile, audioPath);
  assert.equal(defaults.timingHintsFile, hintsPath);
  assert.equal(defaults.dist, path.join(videoPath, 'lyrics'));
  assert.equal(defaults.breadcrumbLabel, 'example > multimedia > Poems > John Keats > Bright star');
});

test('Lyrics Timestamp launcher opens file browser at the current file parent folder', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lyrics-timestamp-dialog-'));
  const audioFolder = path.join(root, 'audio');
  const audioFile = path.join(audioFolder, 'voice.mp3');
  fs.mkdirSync(audioFolder, { recursive: true });
  fs.writeFileSync(audioFile, 'mp3', 'utf8');

  assert.equal(actions.dialogDefaultPath(fs, audioFile), audioFolder);
});

test('Lyrics Timestamp launcher opens folder browser at the current folder', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lyrics-timestamp-dialog-folder-'));
  const lyricsFolder = path.join(root, 'lyrics');
  fs.mkdirSync(lyricsFolder, { recursive: true });

  assert.equal(actions.dialogDefaultPath(fs, lyricsFolder), lyricsFolder);
});
