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
