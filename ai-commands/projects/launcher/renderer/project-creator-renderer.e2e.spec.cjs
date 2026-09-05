const { test, expect } = require('@playwright/test');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

test('Project Creator renderer edits multimedia fields and submits create payload', async ({ page }) => {
  await page.addInitScript(() => {
    window.__projectCreatorCalls = [];
    window.projectCreator = {
      defaults: async () => ({
        repoRoot: '/tmp/project-creator-e2e/repo',
        appRoot: '/tmp/project-creator-e2e/repo/ai',
        configRoot: '/tmp/project-creator-e2e/repo/ai-config',
        registryPath: '/tmp/project-creator-e2e/registry.yml',
        rootPath: '/tmp/project-creator-e2e/projects'
      }),
      specTemplate: async (input) => {
        window.__projectCreatorCalls.push({ type: 'specTemplate', input });
        return `# ${input.name}\n\nType: ${input.contentType}\nRelease: ${input.releaseType}\nLyrics: ${input.lyricsSource}\nTODO: Fill specification.`;
      },
      create: async (input) => {
        window.__projectCreatorCalls.push({ type: 'create', input });
        return {
          id: 'keats-song',
          name: input.name,
          path: `${input.rootPath}/keats-song`
        };
      }
    };
  });

  const rendererPath = path.resolve(__dirname, 'index.html');
  await page.goto(pathToFileURL(rendererPath).href);

  await expect(page.locator('#paths')).toHaveText('/tmp/project-creator-e2e/repo/ai-config');
  await expect(page.locator('#specification')).toHaveValue(/New Multimedia Project/);
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(17, 20, 24)');
  await expect(page.locator('body')).toHaveCSS('overflow', 'hidden');
  await expect(page.locator('#create')).toHaveCSS('background-color', 'rgb(47, 125, 104)');
  await expect(page.locator('.launcher-shell')).toHaveCSS('height', '720px');
  const pageMetrics = await page.evaluate(() => ({
    clientHeight: document.scrollingElement.clientHeight,
    scrollHeight: document.scrollingElement.scrollHeight
  }));
  expect(pageMetrics.scrollHeight).toBe(pageMetrics.clientHeight);

  await page.locator('#name').fill('Keats Song');
  await page.locator('#contentType').selectOption('song');
  await page.locator('#releaseType').selectOption('audio');
  await page.locator('#lyricsSource').selectOption('ready-to-post');
  await page.locator('#coverMode').selectOption('static-picture');
  await page.locator('#thumbnailMode').selectOption('separate');
  await page.locator('#template').click();
  await expect(page.locator('#specification')).toHaveValue(/Release: audio/);
  await expect(page.locator('#specification')).toHaveValue(/Lyrics: ready-to-post/);

  await page.locator('#create').click();
  await expect(page.locator('#status')).toContainText('Created Keats Song');
  await expect(page.locator('#status')).toContainText('/tmp/project-creator-e2e/projects/keats-song');

  const createCall = await page.evaluate(() => window.__projectCreatorCalls.find((call) => call.type === 'create'));
  expect(createCall.input).toMatchObject({
    name: 'Keats Song',
    contentType: 'song',
    releaseType: 'audio',
    lyricsSource: 'ready-to-post',
    coverMode: 'static-picture',
    thumbnailMode: 'separate',
    registryPath: '/tmp/project-creator-e2e/registry.yml',
    rootPath: '/tmp/project-creator-e2e/projects'
  });
  expect(createCall.input.specification).toContain('Release: audio');
});
