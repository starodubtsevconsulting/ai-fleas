const { test, expect } = require('@playwright/test');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

function rendererUrl() {
  return pathToFileURL(path.resolve(__dirname, 'index.html')).href;
}

test('Voice Report renderer syncs face animation to actual audio play and pause', async ({ page }) => {
  await page.addInitScript(() => {
    window.__voiceReportAudioStatusCalls = 0;
    window.__voiceReportPlayCalls = 0;
    HTMLMediaElement.prototype.play = function play() {
      window.__voiceReportPlayCalls += 1;
      return Promise.resolve();
    };
    HTMLMediaElement.prototype.load = function load() {};
    window.voiceReportLauncher = {
      initialState: async () => ({
        text: 'Voice Report e2e waits for generated audio and then syncs the talking face to playback events.',
        audioFile: '/tmp/voice-report-e2e.wav',
        voiceGender: 'male',
        voiceId: 'en-US-AndrewNeural'
      }),
      audioStatus: async () => {
        window.__voiceReportAudioStatusCalls += 1;
        return {
          exists: window.__voiceReportAudioStatusCalls >= 2,
          size: window.__voiceReportAudioStatusCalls >= 2 ? 4096 : 0,
          audioFile: '/tmp/voice-report-e2e.wav',
        voiceGender: 'male',
        voiceId: 'en-US-AndrewNeural'
        };
      }
    };
  });
  await page.goto(rendererUrl());

  const face = page.getByTestId('voice-report-read-aloud-face');
  const mouth = page.locator('.mouth-open');
  const signal = page.locator('.agent-signal path').first();
  const beforeTransform = await mouth.evaluate((element) => getComputedStyle(element).transform);

  await expect(face).toBeVisible();
  await expect(face).toHaveClass(/is-male/);
  await expect(face).not.toHaveClass(/is-female/);
  await expect.poll(async () => face.evaluate((element) => getComputedStyle(element).getPropertyValue('--agent-accent').trim())).toBe('#58a6ff');
  await expect(page.locator('#subtitleLine')).toContainText('Voice Report e2e waits for generated audio');
  await expect(page.locator('#subtitleLine')).not.toContainText('VoiceReporte2e');
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(17, 20, 24)');
  await expect(page.locator('body')).toHaveCSS('overflow', 'hidden');
  const pageMetrics = await page.evaluate(() => ({
    clientHeight: document.scrollingElement.clientHeight,
    scrollHeight: document.scrollingElement.scrollHeight
  }));
  expect(pageMetrics.scrollHeight).toBe(pageMetrics.clientHeight);

  await expect.poll(async () => page.evaluate(() => window.__voiceReportAudioStatusCalls)).toBeGreaterThanOrEqual(2);
  await expect.poll(async () => page.evaluate(() => window.__voiceReportPlayCalls)).toBeGreaterThanOrEqual(1);
  await expect(face).not.toHaveClass(/is-speaking/);

  await page.evaluate(() => {
    const audio = document.getElementById('reportAudio');
    Object.defineProperty(audio, 'paused', { configurable: true, get: () => false });
    Object.defineProperty(audio, 'ended', { configurable: true, get: () => false });
    audio.dispatchEvent(new Event('play'));
  });
  await expect(face).toHaveClass(/is-speaking/);
  await expect(page.locator('#readAloudFaceState')).toHaveText('Speaking');
  await expect.poll(async () => signal.evaluate((element) => Number(getComputedStyle(element).opacity))).toBeGreaterThan(0.2);

  await page.evaluate(() => window.__voiceReportLauncherTest.applyMouthLevel(1));
  await expect.poll(async () => mouth.evaluate((element) => getComputedStyle(element).transform)).not.toBe(beforeTransform);

  await page.evaluate(() => {
    const audio = document.getElementById('reportAudio');
    Object.defineProperty(audio, 'paused', { configurable: true, get: () => true });
    audio.dispatchEvent(new Event('pause'));
  });
  await expect(face).not.toHaveClass(/is-speaking/);
  await expect(page.locator('#readAloudFaceState')).toHaveText('Agent ready');
});

test('Voice Report renderer does not animate the face when audio play is rejected', async ({ page }) => {
  await page.addInitScript(() => {
    HTMLMediaElement.prototype.play = function play() {
      return Promise.reject(new DOMException('Autoplay denied by test', 'NotAllowedError'));
    };
    HTMLMediaElement.prototype.load = function load() {};
    window.voiceReportLauncher = {
      initialState: async () => ({
        text: 'Voice Report e2e confirms rejected audio playback does not fake talking.',
        audioFile: '/tmp/voice-report-e2e.wav',
        voiceGender: 'male',
        voiceId: 'en-US-AndrewNeural'
      }),
      audioStatus: async () => ({ exists: true, size: 4096, audioFile: '/tmp/voice-report-e2e.wav',
        voiceGender: 'male',
        voiceId: 'en-US-AndrewNeural' })
    };
  });
  await page.goto(rendererUrl());

  const face = page.getByTestId('voice-report-read-aloud-face');
  await expect(page.locator('#state')).toHaveText('Autoplay blocked. Press Replay.');
  await expect(face).not.toHaveClass(/is-speaking/);
  await expect(page.locator('#readAloudFaceState')).toHaveText('Agent ready');
});


test('Voice Report renderer uses rose face styling for explicit female voice', async ({ page }) => {
  await page.addInitScript(() => {
    HTMLMediaElement.prototype.play = function play() {
      return Promise.resolve();
    };
    HTMLMediaElement.prototype.load = function load() {};
    window.voiceReportLauncher = {
      initialState: async () => ({
        text: 'Voice Report e2e confirms female voice uses the rose face.',
        audioFile: '/tmp/voice-report-e2e.wav',
        voiceGender: 'female',
        voiceId: 'en-US-AriaNeural'
      }),
      audioStatus: async () => ({ exists: true, size: 4096, audioFile: '/tmp/voice-report-e2e.wav' }),
      ready: async () => ({ ok: true })
    };
  });
  await page.goto(rendererUrl());

  const face = page.getByTestId('voice-report-read-aloud-face');
  await expect(face).toHaveClass(/is-female/);
  await expect(face).not.toHaveClass(/is-male/);
  await expect.poll(async () => face.evaluate((element) => getComputedStyle(element).getPropertyValue('--agent-accent').trim())).toBe('#f472b6');
});

test('Voice Report renderer blocks playback when voice gender is unclear', async ({ page }) => {
  await page.addInitScript(() => {
    window.__voiceReportPlayCalls = 0;
    window.__voiceReportReadyPayloads = [];
    HTMLMediaElement.prototype.play = function play() {
      window.__voiceReportPlayCalls += 1;
      return Promise.resolve();
    };
    HTMLMediaElement.prototype.load = function load() {};
    window.voiceReportLauncher = {
      initialState: async () => ({
        text: 'Voice Report e2e must not play unclear voice gender.',
        audioFile: '/tmp/voice-report-e2e.wav',
        voiceId: 'en-US-TestNeural'
      }),
      audioStatus: async () => ({ exists: true, size: 4096, audioFile: '/tmp/voice-report-e2e.wav' }),
      ready: async (payload) => {
        window.__voiceReportReadyPayloads.push(payload);
        return { ok: true };
      }
    };
  });
  await page.goto(rendererUrl());

  const face = page.getByTestId('voice-report-read-aloud-face');
  await expect(page.locator('#state')).toContainText('does not have a clear male or female gender');
  await expect(face).not.toHaveClass(/is-speaking/);
  await expect(face).not.toHaveClass(/is-male/);
  await expect(face).not.toHaveClass(/is-female/);
  await expect.poll(async () => page.evaluate(() => window.__voiceReportPlayCalls)).toBe(0);
  await expect.poll(async () => page.evaluate(() => window.__voiceReportReadyPayloads.at(-1)?.status)).toBe('error');
});
