const { test, expect } = require('@playwright/test');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

function rendererUrl() {
  return pathToFileURL(path.resolve(__dirname, 'index.html')).href;
}

// Mock window.screenshotSorter for E2E tests
function setupMockScreenshotSorter() {
  window.screenshotSorter = {
    settings: async () => ({
      sourceDir: '/Users/sergii/Screenshots',
      destinationDir: '/Users/sergii/Screenshots',
      settleSeconds: 2,
      startIntervalSeconds: 10
    }),
    status: async () => 'Sorter is running',
    library: async () => [],
    chooseFolder: async (current) => null,
    save: async (settings) => ({ output: 'Settings saved' }),
    thumbnail: async (id) => null
  };
}

// Mock with library data for gallery tests
function setupMockWithLibrary() {
  window.screenshotSorter = {
    settings: async () => ({
      sourceDir: '/Users/sergii/Screenshots',
      destinationDir: '/Users/sergii/Screenshots',
      settleSeconds: 2,
      startIntervalSeconds: 10
    }),
    status: async () => 'Sorter is running',
    library: async () => [
      {
        date: '2026-10-05',
        count: 3,
        screenshots: [
          { id: 'shot1', name: 'Screenshot 2026-10-05 at 10-30-00.png', modifiedAt: Date.now() - 3600000, bytes: 102400 },
          { id: 'shot2', name: 'Screenshot 2026-10-05 at 10-35-00.png', modifiedAt: Date.now() - 1800000, bytes: 153600 },
          { id: 'shot3', name: 'Screenshot 2026-10-05 at 10-40-00.png', modifiedAt: Date.now() - 900000, bytes: 204800 }
        ]
      },
      {
        date: '2026-10-04',
        count: 1,
        screenshots: [
          { id: 'shot4', name: 'Screenshot 2026-10-04 at 09-15-00.png', modifiedAt: Date.now() - 86400000, bytes: 51200 }
        ]
      }
    ],
    chooseFolder: async (current) => null,
    save: async (settings) => ({ output: 'Settings saved' }),
    thumbnail: async (id) => `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6twAAAABJRU5ErkJggg==`
  };
}

test('Settings tab shows default config values', async ({ page }) => {
  page.on('console', msg => console.log(`Console: ${msg.text()}`));
  page.on('pageerror', error => console.log(`Page error: ${error.message}`));
  
  await page.addInitScript(setupMockScreenshotSorter);
  await page.goto(rendererUrl());

  // Wait for the page to fully load
  await page.waitForLoadState('networkidle');
  
  // Check tabs by data attribute instead of role
  const tabs = page.locator('[data-tab]');
  await expect(tabs).toHaveCount(2);
  
  const firstTab = tabs.nth(0);
  await expect(firstTab).toHaveText('Screenshots');
  await expect(firstTab).toHaveAttribute('aria-selected', 'true');
  
  const secondTab = tabs.nth(1);
  await expect(secondTab).toHaveText('Settings');
  await expect(secondTab).toHaveAttribute('aria-selected', 'false');

  // Check settings form fields are populated
  await expect(page.locator('#source')).toBeVisible();
  await expect(page.locator('#source')).toHaveValue('/Users/sergii/Screenshots');
  
  await expect(page.locator('#destination')).toBeVisible();
  await expect(page.locator('#destination')).toHaveValue('/Users/sergii/Screenshots');
});

test('Screenshot tab loads', async ({ page }) => {
  page.on('console', msg => console.log(`Console: ${msg.text()}`));
  page.on('pageerror', error => console.log(`Page error: ${error.message}`));
  
  await page.addInitScript(setupMockScreenshotSorter);
  await page.goto(rendererUrl());

  // Switch to Screenshots tab
  const screenshotTab = page.locator('[data-tab="library"]');
  await screenshotTab.click();

  // Verify tab is selected
  await expect(screenshotTab).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('[data-tab="settings"]')).toHaveAttribute('aria-selected', 'false');
  
  // Verify tab content is visible (library panel should now be visible, settings hidden)
  await expect(page.locator('[data-panel="library"]')).toBeVisible();
  await expect(page.locator('[data-panel="settings"]')).not.toBeVisible();
});

test('Tab switching works correctly', async ({ page }) => {
  page.on('console', msg => console.log(`Console: ${msg.text()}`));
  page.on('pageerror', error => console.log(`Page error: ${error.message}`));
  
  await page.addInitScript(setupMockScreenshotSorter);
  await page.goto(rendererUrl());

  // Initial state: Screenshots tab active
  const screenshotsTab = page.locator('[data-tab="library"]');
  const settingsTab = page.locator('[data-tab="settings"]');
  
  await expect(screenshotsTab).toHaveAttribute('aria-selected', 'true');
  await expect(settingsTab).toHaveAttribute('aria-selected', 'false');

  // Click Settings tab
  await settingsTab.click();
  await expect(settingsTab).toHaveAttribute('aria-selected', 'true');
  await expect(screenshotsTab).toHaveAttribute('aria-selected', 'false');

  // Click Screenshots tab again
  await screenshotsTab.click();
  await expect(screenshotsTab).toHaveAttribute('aria-selected', 'true');
  await expect(settingsTab).toHaveAttribute('aria-selected', 'false');
});

test('Screenshot tab displays library content with mock data', async ({ page }) => {
  page.on('console', msg => console.log(`Console: ${msg.text()}`));
  page.on('pageerror', error => console.log(`Page error: ${error.message}`));
  
  await page.addInitScript(setupMockWithLibrary);
  await page.goto(rendererUrl());

  // Switch to Screenshots tab to trigger library load
  const screenshotTab = page.locator('[data-tab="library"]');
  await screenshotTab.click();

  // Wait for library to load
  await page.waitForSelector('[data-panel="library"] .folder');
  
  // Verify folders are displayed
  const folders = page.locator('.folder');
  await expect(folders).toHaveCount(2);
  
  // Verify first folder has expected date
  const firstFolder = folders.nth(0);
  await expect(firstFolder).toContainText('2026-10-05');
  await expect(firstFolder).toContainText('3 screenshots');
  
  // Verify screenshot thumbnails exist
  const shots = page.locator('.shot');
  await expect(shots).toHaveCount(4);
  
  // Verify first screenshot name
  const firstShotName = page.locator('.shot-name').nth(0);
  await expect(firstShotName).toContainText('Screenshot 2026-10-05 at 10-30-00');
});

test('Tab order is correct (Screenshots before Settings)', async ({ page }) => {
  page.on('console', msg => console.log(`Console: ${msg.text()}`));
  page.on('pageerror', error => console.log(`Page error: ${error.message}`));
  
  await page.addInitScript(setupMockScreenshotSorter);
  await page.goto(rendererUrl());

  const tabs = page.locator('[data-tab]');
  await expect(tabs).toHaveCount(2);
  
  // First tab should be Screenshots
  const firstTab = tabs.nth(0);
  await expect(firstTab).toHaveText('Screenshots');
  await expect(firstTab).toHaveAttribute('aria-selected', 'true');
  
  // Second tab should be Settings
  const secondTab = tabs.nth(1);
  await expect(secondTab).toHaveText('Settings');
  await expect(secondTab).toHaveAttribute('aria-selected', 'false');
});

test('Status display shows sorter is running', async ({ page }) => {
  page.on('console', msg => console.log(`Console: ${msg.text()}`));
  page.on('pageerror', error => console.log(`Page error: ${error.message}`));
  
  await page.addInitScript(setupMockScreenshotSorter);
  await page.goto(rendererUrl());

  // Status should show running state
  const status = page.locator('#status');
  await expect(status).toBeVisible();
  await expect(status).toContainText('Sorter is running');
});

test('Empty library shows appropriate message', async ({ page }) => {
  page.on('console', msg => console.log(`Console: ${msg.text()}`));
  page.on('pageerror', error => console.log(`Page error: ${error.message}`));
  
  // Create a fresh mock with empty library
  await page.addInitScript(() => {
    window.screenshotSorter = {
      settings: async () => ({
        sourceDir: '/Users/sergii/Screenshots',
        destinationDir: '/Users/sergii/Screenshots',
        settleSeconds: 2,
        startIntervalSeconds: 10
      }),
      status: async () => 'Sorter is running',
      library: async () => [],
      chooseFolder: async (current) => null,
      save: async (settings) => ({ output: 'Settings saved' }),
      thumbnail: async (id) => null
    };
  });
  
  await page.goto(rendererUrl());

  // Switch to Screenshots tab
  const screenshotTab = page.locator('[data-tab="library"]');
  await screenshotTab.click();

  // Wait for empty state message
  await page.waitForSelector('[data-panel="library"] .empty');
  await expect(page.locator('[data-panel="library"] .empty')).toBeVisible();
});

test('Save button is present and enabled', async ({ page }) => {
  page.on('console', msg => console.log(`Console: ${msg.text()}`));
  page.on('pageerror', error => console.log(`Page error: ${error.message}`));
  
  await page.addInitScript(setupMockScreenshotSorter);
  await page.goto(rendererUrl());

  // Verify save button exists and is enabled
  const saveButton = page.locator('#save');
  await expect(saveButton).toBeVisible();
  await expect(saveButton).toBeEnabled();
});

test('Refresh buttons are present and enabled', async ({ page }) => {
  page.on('console', msg => console.log(`Console: ${msg.text()}`));
  page.on('pageerror', error => console.log(`Page error: ${error.message}`));
  
  await page.addInitScript(setupMockScreenshotSorter);
  await page.goto(rendererUrl());

  // Verify status refresh button exists
  const refreshButton = page.locator('#refresh');
  await expect(refreshButton).toBeVisible();
  await expect(refreshButton).toBeEnabled();
  
  // Verify library refresh button exists (after switching tabs)
  const screenshotTab = page.locator('[data-tab="library"]');
  await screenshotTab.click();
  await page.waitForSelector('[data-panel="library"] #reload-library');
  
  const reloadButton = page.locator('#reload-library');
  await expect(reloadButton).toBeVisible();
  await expect(reloadButton).toBeEnabled();
});

test('Folder choose buttons are present for source and destination', async ({ page }) => {
  page.on('console', msg => console.log(`Console: ${msg.text()}`));
  page.on('pageerror', error => console.log(`Page error: ${error.message}`));
  
  await page.addInitScript(setupMockScreenshotSorter);
  await page.goto(rendererUrl());

  // Verify source folder choose button exists
  const sourceChoose = page.locator('[data-pick="source"]');
  await expect(sourceChoose).toBeVisible();
  await expect(sourceChoose).toHaveText('Choose…');
  
  // Verify destination folder choose button exists
  const destChoose = page.locator('[data-pick="destination"]');
  await expect(destChoose).toBeVisible();
  await expect(destChoose).toHaveText('Choose…');
});

test('Input fields are properly configured', async ({ page }) => {
  page.on('console', msg => console.log(`Console: ${msg.text()}`));
  page.on('pageerror', error => console.log(`Page error: ${error.message}`));
  
  await page.addInitScript(setupMockScreenshotSorter);
  await page.goto(rendererUrl());

  // Verify source input
  const sourceInput = page.locator('#source');
  await expect(sourceInput).toBeVisible();
  await expect(sourceInput).toHaveValue('/Users/sergii/Screenshots');
  
  // Verify destination input
  const destInput = page.locator('#destination');
  await expect(destInput).toBeVisible();
  await expect(destInput).toHaveValue('/Users/sergii/Screenshots');
  
  // Verify settle seconds input (number type)
  const settleInput = page.locator('#settle');
  await expect(settleInput).toBeVisible();
  await expect(settleInput).toHaveAttribute('type', 'number');
  await expect(settleInput).toHaveAttribute('min', '0');
  await expect(settleInput).toHaveAttribute('max', '60');
  
  // Verify interval input (number type)
  const intervalInput = page.locator('#interval');
  await expect(intervalInput).toBeVisible();
  await expect(intervalInput).toHaveAttribute('type', 'number');
  await expect(intervalInput).toHaveAttribute('min', '0');
  await expect(intervalInput).toHaveAttribute('max', '3600');
});

test('Settings tab hero image is displayed', async ({ page }) => {
  page.on('console', msg => console.log(`Console: ${msg.text()}`));
  page.on('pageerror', error => console.log(`Page error: ${error.message}`));
  
  await page.addInitScript(setupMockScreenshotSorter);
  await page.goto(rendererUrl());

  // Verify hero image exists in settings tab
  const heroImage = page.locator('.hero');
  await expect(heroImage).toBeVisible();
  await expect(heroImage).toHaveAttribute('alt', 'A person and an AI Fleas robot working together at a desk');
});

test('Library reload button triggers library refresh', async ({ page }) => {
  page.on('console', msg => console.log(`Console: ${msg.text()}`));
  page.on('pageerror', error => console.log(`Page error: ${error.message}`));
  
  let loadLibraryCallCount = 0;
  
  await page.addInitScript(() => {
    window.screenshotSorter = {
      settings: async () => ({
        sourceDir: '/Users/sergii/Screenshots',
        destinationDir: '/Users/sergii/Screenshots',
        settleSeconds: 2,
        startIntervalSeconds: 10
      }),
      status: async () => 'Sorter is running',
      library: async () => {
        window.libraryCallCount = (window.libraryCallCount || 0) + 1;
        return [];
      },
      chooseFolder: async (current) => null,
      save: async (settings) => ({ output: 'Settings saved' }),
      thumbnail: async (id) => null
    };
  });
  
  await page.goto(rendererUrl());
  await page.waitForSelector('[data-panel="library"]');

  // Switch to library tab to load initially
  const screenshotTab = page.locator('[data-tab="library"]');
  await screenshotTab.click();
  
  // Wait for initial load
  await page.waitForFunction(() => window.libraryCallCount >= 1);
  
  // Click reload button
  await page.locator('#reload-library').click();
  
  // Wait for reload to trigger
  await page.waitForFunction(() => window.libraryCallCount >= 2);
});
