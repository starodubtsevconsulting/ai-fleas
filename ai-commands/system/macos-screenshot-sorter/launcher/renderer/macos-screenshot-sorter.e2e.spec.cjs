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
  
  // Initial state: Screenshots tab is selected (default)
  const screenshotsTab = page.locator('[data-tab="library"]');
  const settingsTab = page.locator('[data-tab="settings"]');
  
  await expect(screenshotsTab).toHaveAttribute('aria-selected', 'true');
  await expect(settingsTab).toHaveAttribute('aria-selected', 'false');
  
  // Switch to Settings tab to verify its content
  await settingsTab.click();
  await expect(settingsTab).toHaveAttribute('aria-selected', 'true');
  await expect(screenshotsTab).toHaveAttribute('aria-selected', 'false');
  
  // Verify tab content is visible
  await expect(page.locator('[data-panel="settings"]')).toBeVisible();
  await expect(page.locator('[data-panel="library"]')).not.toBeVisible();
  
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

  // Initial state: Screenshots tab is selected (default)
  // Switch to Settings tab to see status
  const settingsTab = page.locator('[data-tab="settings"]');
  await settingsTab.click();
  
  // Wait for settings panel to be visible
  await expect(page.locator('[data-panel="settings"]')).toBeVisible();
  
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

  // Switch to Settings tab to see save button
  const settingsTab = page.locator('[data-tab="settings"]');
  await settingsTab.click();
  
  // Wait for settings panel to be visible
  await expect(page.locator('[data-panel="settings"]')).toBeVisible();
  
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

  // Switch to Settings tab to see status refresh button
  const settingsTab = page.locator('[data-tab="settings"]');
  await settingsTab.click();
  
  // Verify status refresh button exists
  const refreshButton = page.locator('#refresh');
  await expect(refreshButton).toBeVisible();
  await expect(refreshButton).toBeEnabled();
  
  // Switch to Screenshots tab to verify library refresh button
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

  // Switch to Settings tab to see folder choose buttons
  const settingsTab = page.locator('[data-tab="settings"]');
  await settingsTab.click();
  
  // Wait for settings panel to be visible
  await expect(page.locator('[data-panel="settings"]')).toBeVisible();
  
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

  // Switch to Settings tab to see input fields
  const settingsTab = page.locator('[data-tab="settings"]');
  await settingsTab.click();
  
  // Wait for settings panel to be visible
  await expect(page.locator('[data-panel="settings"]')).toBeVisible();
  
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

  // Switch to Settings tab to see hero image
  const settingsTab = page.locator('[data-tab="settings"]');
  await settingsTab.click();
  
  // Wait for settings panel to be visible
  await expect(page.locator('[data-panel="settings"]')).toBeVisible();
  
  // Verify hero image exists in settings tab (use specific selector since library also has hero)
  const heroImage = page.locator('#settings .hero');
  await expect(heroImage).toBeVisible();
  await expect(heroImage).toHaveAttribute('alt', 'A person and an AI Fleas robot working together at a desk');
});

test('Screenshots tab is selected by default on startup (smoke test)', async ({ page }) => {
  page.on('console', msg => console.log(`Console: ${msg.text()}`));
  page.on('pageerror', error => console.log(`Page error: ${error.message}`));
  
  await page.addInitScript(setupMockScreenshotSorter);
  await page.goto(rendererUrl());
  
  // Wait for page to fully load
  await page.waitForLoadState('networkidle');
  
  // Check that Screenshots tab is selected
  const screenshotsTab = page.locator('[data-tab="library"]');
  const settingsTab = page.locator('[data-tab="settings"]');
  
  await expect(screenshotsTab).toHaveAttribute('aria-selected', 'true');
  await expect(settingsTab).toHaveAttribute('aria-selected', 'false');
  
  // Check that Screenshots panel is visible and Settings panel is hidden
  await expect(page.locator('[data-panel="library"]')).toBeVisible();
  await expect(page.locator('[data-panel="settings"]')).not.toBeVisible();
});

test('Library reload button triggers library refresh', { timeout: 90000 }, async ({ page }) => {
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
  
  // Switch to library tab to load initially (panel starts hidden, becomes visible after click)
  const screenshotTab = page.locator('[data-tab="library"]');
  await screenshotTab.click({ timeout: 10000 });
  await page.waitForSelector('[data-panel="library"]', { visible: true, timeout: 10000 });
  
  // Wait for initial load
  await page.waitForFunction(() => window.libraryCallCount >= 1);
  
  // Click reload button
  await page.locator('#reload-library').click();
  
  // Wait for reload to trigger
  await page.waitForFunction(() => window.libraryCallCount >= 2);
});

test('Relative date display works for screenshots', async ({ page }) => {
  page.on('console', msg => console.log(`Console: ${msg.text()}`));
  page.on('pageerror', error => console.log(`Page error: ${error.message}`));
  
  await page.addInitScript(() => {
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
          date: '2026-10-06',
          count: 1,
          screenshots: [{ id: 'shot1', name: 'Screenshot.png', modifiedAt: Date.now(), bytes: 1024 }]
        }
      ],
      chooseFolder: async (current) => null,
      save: async (settings) => ({ output: 'Settings saved' }),
      thumbnail: async (id) => null
    };
  });
  
  await page.goto(rendererUrl());
  
  // Switch to Screenshots tab
  const screenshotTab = page.locator('[data-tab="library"]');
  await screenshotTab.click();
  
  // Wait for folder to be displayed
  await page.waitForSelector('[data-panel="library"] .folder');
  
  // Check that relative date is displayed (e.g., "Today" or "Yesterday")
  const folderHead = page.locator('.folder-head h2');
  // The date 2026-10-06 is Yesterday relative to 2026-10-07 (today)
  await expect(folderHead).toContainText('Yesterday');
});

test('Folder collapse toggle works', async ({ page }) => {
  page.on('console', msg => console.log(`Console: ${msg.text()}`));
  page.on('pageerror', error => console.log(`Page error: ${error.message}`));
  
  await page.addInitScript(() => {
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
          date: '2026-10-06',
          count: 3,
          screenshots: [
            { id: 'shot1', name: 'Screenshot 1.png', modifiedAt: Date.now(), bytes: 1024 },
            { id: 'shot2', name: 'Screenshot 2.png', modifiedAt: Date.now(), bytes: 2048 },
            { id: 'shot3', name: 'Screenshot 3.png', modifiedAt: Date.now(), bytes: 3072 }
          ]
        }
      ],
      chooseFolder: async (current) => null,
      save: async (settings) => ({ output: 'Settings saved' }),
      thumbnail: async (id) => null
    };
  });
  
  await page.goto(rendererUrl());
  
  // Switch to Screenshots tab
  const screenshotTab = page.locator('[data-tab="library"]');
  await screenshotTab.click();
  
  // Wait for folder to be displayed
  await page.waitForSelector('[data-panel="library"] .folder');
  
  const folder = page.locator('.folder');
  const shots = page.locator('.shots');
  
  // Initially expanded
  await expect(folder).toHaveAttribute('aria-expanded', 'true');
  await expect(shots).toBeVisible();
  await expect(page.locator('.shots .shot')).toHaveCount(3);
  
  // Use JavaScript to click on the h2 inside folder-head (where the arrow is)
  await page.evaluate(() => {
    const h2 = document.querySelector('.folder-head h2');
    if (h2) {
      h2.click();
    }
  });
  
  // Wait for the attribute to change
  await page.waitForFunction(() => {
    const folder = document.querySelector('.folder');
    return folder && folder.getAttribute('aria-expanded') === 'false';
  }, { timeout: 2000 });
  
  await expect(shots).not.toBeVisible();
  
  // Click again to expand
  await page.evaluate(() => {
    const h2 = document.querySelector('.folder-head h2');
    if (h2) {
      h2.click();
    }
  });
  await page.waitForFunction(() => {
    const folder = document.querySelector('.folder');
    return folder && folder.getAttribute('aria-expanded') === 'true';
  }, { timeout: 2000 });
  
  await expect(shots).toBeVisible();
  await expect(page.locator('.shots .shot')).toHaveCount(3);
});
