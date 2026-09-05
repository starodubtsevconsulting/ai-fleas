const { chromium } = require('playwright');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1180, height: 760 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.addInitScript(() => {
    class MockAudio {
      constructor() {
        this.currentTime = 0;
        this.duration = 30;
        this.paused = true;
        this.listeners = {};
        window.__lyricsTimestampAudio = this;
      }
      addEventListener(name, handler) {
        this.listeners[name] = this.listeners[name] || [];
        this.listeners[name].push(handler);
      }
      pause() {
        this.paused = true;
      }
      async play() {
        this.paused = false;
      }
      fastSeek(_value) {
        this.fastSeekCalled = true;
      }
      set src(value) {
        this.srcValue = value;
        for (const handler of this.listeners.loadedmetadata || []) handler();
      }
      get src() {
        return this.srcValue || '';
      }
    }
    window.Audio = MockAudio;
    window.AudioContext = class MockAudioContext {
      async decodeAudioData(_arrayBuffer) {
        window.__lyricsTimestampWaveformDecoded = true;
        const samples = Float32Array.from({ length: 480 }, (_value, index) => index % 80 === 0 ? 1 : Math.sin(index / 8) * 0.35);
        return {
          getChannelData: () => samples
        };
      }
      async close() {}
    };
    window.lyricsTimestamp = {
      defaults: async () => ({
        commandDir: '/tmp/lyrics-timestamp',
        scopePath: '/tmp/bright-star',
        lyricsFile: '/tmp/bright-star/lyrics/lyrics.md',
        audioFile: '/tmp/bright-star/audio/voice.mp3',
        timingHintsFile: '/tmp/bright-star/lyrics/timing-hints.json',
        dist: '/tmp/bright-star/lyrics'
      }),
      pickLyrics: async () => '',
      pickAudio: async () => '',
      pickHints: async () => '',
      pickDist: async () => '',
      audioData: async () => {
        window.__lyricsTimestampAudioDataRequested = true;
        return new ArrayBuffer(16);
      },
      loadExisting: async () => ({
        found: true,
        saved: true,
        jsonPath: '/tmp/bright-star/lyrics/lyrics-timestamp.json',
        srtPath: '/tmp/bright-star/lyrics/lyrics-timestamp.srt',
        srt: '',
        payload: {
          lines: [
            { index: 1, startMs: 0, endMs: 3000, text: 'one' },
            { index: 2, startMs: 3000, endMs: 7000, text: 'two' },
            { index: 3, startMs: 7000, endMs: 11000, text: 'three' },
            { index: 4, startMs: 11000, endMs: 16000, text: 'four' },
            { index: 5, startMs: 16000, endMs: 20105, text: 'five' },
            { index: 6, startMs: 20106, endMs: 24128, text: 'six' }
          ]
        }
      }),
      save: async (_input, mapped) => {
        window.__lyricsTimestampSaveCalls = (window.__lyricsTimestampSaveCalls || 0) + 1;
        window.__lyricsTimestampSaved = true;
        window.__lyricsTimestampSavedStart = mapped.payload.lines[5].startMs;
        window.__lyricsTimestampSavedLine2Start = mapped.payload.lines[1].startMs;
        return {
          jsonPath: '/tmp/bright-star/lyrics/lyrics-timestamp.json',
          srtPath: '/tmp/bright-star/lyrics/lyrics-timestamp.srt'
        };
      },
      map: async () => {
        window.__lyricsTimestampMapCalls = (window.__lyricsTimestampMapCalls || 0) + 1;
        return ({
        jsonPath: '/tmp/bright-star/lyrics/lyrics-timestamp.json',
        srtPath: '/tmp/bright-star/lyrics/lyrics-timestamp.srt',
        srt: '',
        payload: {
          lines: [
            { index: 1, startMs: 0, endMs: 3000, text: 'one' },
            { index: 2, startMs: 3000, endMs: 7000, text: 'two' },
            { index: 3, startMs: 7000, endMs: 11000, text: 'three' },
            { index: 4, startMs: 11000, endMs: 16000, text: 'four' },
            { index: 5, startMs: 16000, endMs: 20105, text: 'five' },
            { index: 6, startMs: 20106, endMs: 24128, text: 'six' }
          ]
        }
      });
      }
    };
  });

  await page.goto(pathToFileURL(process.env.LYRICS_TIMESTAMP_PANEL_HTML || path.resolve(__dirname, 'index.html')).href);
  await page.waitForSelector('.timestamp-row[data-index="6"]');
  const previewStatus = await page.locator('#status').textContent();
  if (!previewStatus.includes('Loaded existing mapped file')) {
    throw new Error(`Expected existing mapped file status, got ${previewStatus}`);
  }
  const saveDisabledAfterLoad = await page.locator('#save').isDisabled();
  if (!saveDisabledAfterLoad) {
    throw new Error('Expected Save button to stay disabled after loading already-saved output.');
  }
  const runDisabledAfterLoad = await page.locator('#run').isDisabled();
  if (!runDisabledAfterLoad) {
    throw new Error('Expected Run button to be disabled after loading existing mapped output.');
  }
  await page.locator('#run').click({ force: true });
  const mapCallsAfterBlockedRun = await page.evaluate(() => window.__lyricsTimestampMapCalls || 0);
  if (mapCallsAfterBlockedRun !== 0) {
    throw new Error(`Expected disabled/protected Run not to call map, got ${mapCallsAfterBlockedRun}`);
  }
  const zeroProgressState = await page.evaluate(() => {
    const progress = document.getElementById('playbackProgress');
    const style = window.getComputedStyle(progress);
    return {
      value: progress.value,
      marginLeft: style.marginLeft,
      marginRight: style.marginRight,
      paddingLeft: style.paddingLeft,
      paddingRight: style.paddingRight,
      appearance: style.appearance || style.webkitAppearance || ''
    };
  });
  if (zeroProgressState.value !== '0') {
    throw new Error(`Expected progress value to start at 0, got ${zeroProgressState.value}`);
  }
  for (const key of ['marginLeft', 'marginRight', 'paddingLeft', 'paddingRight']) {
    if (zeroProgressState[key] !== '0px') {
      throw new Error(`Expected progress ${key} to be 0px for visual zero alignment, got ${zeroProgressState[key]}`);
    }
  }
  await page.locator('#playbackProgress').evaluate((element) => {
    element.value = '6.045';
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.locator('.timestamp-row[data-index="2"] button[data-field="startMs"]').click();
  const syncedStart = await page.locator('.timestamp-row[data-index="2"] input[data-field="startMs"]').inputValue();
  if (syncedStart !== '6.045') {
    throw new Error(`Expected row 2 start to sync from progress at 6.045, got ${syncedStart}`);
  }
  await page.waitForFunction(() => window.__lyricsTimestampSaveCalls === 1);
  const syncedSave = await page.evaluate(() => ({
    row2Start: window.__lyricsTimestampSavedLine2Start,
    status: document.getElementById('status').textContent
  }));
  if (syncedSave.row2Start !== 6045) {
    throw new Error(`Expected Now to immediately save row 2 startMs 6045, got ${syncedSave.row2Start}`);
  }
  if (!syncedSave.status.includes('Synced and saved')) {
    throw new Error(`Expected Now save status, got ${syncedSave.status}`);
  }
  const syncedPreview = await page.evaluate(() => ({
    rawJson: document.getElementById('json').textContent,
    rawSrt: document.getElementById('srt').textContent
  }));
  if (!syncedPreview.rawJson.includes('\"startMs\": 6045')) {
    throw new Error('Expected raw JSON preview to include synced startMs 6045.');
  }
  if (!syncedPreview.rawSrt.includes('00:00:06,045')) {
    throw new Error('Expected SRT preview to include synced timestamp 00:00:06,045.');
  }
  await page.waitForFunction(() => window.__lyricsTimestampWaveformDecoded === true);
  const waveformState = await page.evaluate(() => {
    const canvas = document.getElementById('waveform');
    const context = canvas.getContext('2d');
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let bluePixels = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      if (pixels[index] === 93 && pixels[index + 1] === 163 && pixels[index + 2] === 199) {
        bluePixels += 1;
      }
    }
    return {
      width: canvas.width,
      height: canvas.height,
      audioDataRequested: Boolean(window.__lyricsTimestampAudioDataRequested),
      bluePixels
    };
  });
  if (!waveformState.audioDataRequested) {
    throw new Error('Expected waveform loader to request audio data.');
  }
  if (waveformState.width <= 1 || waveformState.height <= 1 || waveformState.bluePixels <= 0) {
    throw new Error(`Expected waveform canvas to draw blue peak bars, got ${JSON.stringify(waveformState)}`);
  }
  await page.locator('.timestamp-row[data-index="6"] input[data-field="startMs"]').fill('20.000');
  const previousEndAfterOverlapEdit = await page.locator('.timestamp-row[data-index="5"] input[data-field="endMs"]').inputValue();
  if (previousEndAfterOverlapEdit !== '20.000') {
    throw new Error(`Expected previous row end to move to 20.000, got ${previousEndAfterOverlapEdit}`);
  }
  await page.locator('.timestamp-row[data-index="6"] input[data-field="startMs"]').fill('20.500');
  const tunedPreview = await page.evaluate(() => ({
    rawJson: document.getElementById('json').textContent,
    rawSrt: document.getElementById('srt').textContent
  }));
  if (!tunedPreview.rawJson.includes('\"startMs\": 20500')) {
    throw new Error('Expected raw JSON preview to include tuned startMs 20500.');
  }
  if (!tunedPreview.rawSrt.includes('00:00:20,500')) {
    throw new Error('Expected SRT preview to include tuned timestamp 00:00:20,500.');
  }
  await page.locator('#save').click();
  const saved = await page.evaluate(() => ({
    row2Start: window.__lyricsTimestampSavedLine2Start,
    row6Start: window.__lyricsTimestampSavedStart
  }));
  if (saved.row2Start !== 6045) {
    throw new Error(`Expected explicit Save to keep synced row 2 startMs 6045, got ${saved.row2Start}`);
  }
  if (saved.row6Start !== 20500) {
    throw new Error(`Expected Save to receive tuned row 6 startMs 20500, got ${saved.row6Start}`);
  }
  await page.locator('.timestamp-row[data-index="6"] .timestamp-line-text').click();

  const state = await page.evaluate(() => {
    const timeRect = document.getElementById('playbackTime').getBoundingClientRect();
    const progressRect = document.getElementById('playbackProgress').getBoundingClientRect();
    return {
      audioCurrentTime: window.__lyricsTimestampAudio.currentTime,
      fastSeekCalled: Boolean(window.__lyricsTimestampAudio.fastSeekCalled),
      progressValue: document.getElementById('playbackProgress').value,
      playbackTime: document.getElementById('playbackTime').textContent,
      activeText: document.querySelector('.timestamp-row.is-active .timestamp-line-text')?.textContent || '',
      playbackGap: progressRect.left - timeRect.right
    };
  });

  if (state.fastSeekCalled) {
    throw new Error('Expected row seek to set audio.currentTime directly, not fastSeek.');
  }
  if (Math.abs(state.audioCurrentTime - 20.5) > 0.001) {
    throw new Error(`Expected audio currentTime 20.5, got ${state.audioCurrentTime}`);
  }
  if (Math.abs(Number(state.progressValue) - 20.5) > 0.001) {
    throw new Error(`Expected progress 20.5, got ${state.progressValue}`);
  }
  if (!state.playbackTime.startsWith('00:20.500')) {
    throw new Error(`Expected playback display to start at 00:20.500, got ${state.playbackTime}`);
  }
  if (state.activeText !== 'six') {
    throw new Error(`Expected row six active, got ${state.activeText}`);
  }
  if (state.playbackGap < 0) {
    throw new Error(`Expected playback time not to overlap progress control, gap ${state.playbackGap}`);
  }
  if (errors.length > 0) {
    throw new Error(errors.join('\n'));
  }

  await browser.close();
  console.log('Lyrics Timestamp renderer row seek test passed.');
}

main().catch(async (error) => {
  console.error(error.message || error);
  process.exit(1);
});
