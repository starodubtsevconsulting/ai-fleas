const { test, expect } = require('@playwright/test');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

function rendererUrl() {
  return pathToFileURL(path.resolve(__dirname, 'index.html')).href;
}

test('Settings tab shows default config values', async ({ page }) => {
  await page.goto(rendererUrl());

  // Wait for UI to load
  await expect(page.locator('.tab-content.active')).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Settings' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Screenshots' })).toBeVisible();

  // Check tab order - Screenshots should be first (visible on left)
  const tabs = page.locator('.tabs .tab');
  await expect(tabs).toHaveCount(2);
  
  const firstTab = tabs.nth(0);
  await expect(firstTab).toHaveText('Screenshots');
  await expect(firstTab).toHaveAttribute('aria-selected', 'true');
  
  const secondTab = tabs.nth(1);
  await expect(secondTab).toHaveText('Settings');
  await expect(secondTab).toHaveAttribute('aria-selected', 'false');

  // Check settings form fields are populated
  await expect(page.locator('#sourceDir')).toBeVisible();
  await expect(page.locator('#sourceDir')).toHaveValue('');
  
  await expect(page.locator('#destinationDir')).toBeVisible();
  await expect(page.locator('#destinationDir')).toHaveValue('');
});

test('Screenshot tab loads', async ({ page }) => {
  await page.goto(rendererUrl());

  // Switch to Screenshots tab
  const screenshotTab = page.getByRole('tab', { name: 'Screenshots' });
  await screenshotTab.click();

  // Verify tab is selected
  await expect(screenshotTab).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tab', { name: 'Settings' })).toHaveAttribute('aria-selected', 'false');
  
  // Verify tab content is visible
  await expect(page.locator('.tab-content.active')).toBeVisible();
});

test('Tab switching works correctly', async ({ page }) => {
  await page.goto(rendererUrl());

  // Initial state: Settings tab active (reversed order means Screenshots is first)
  const screenshotsTab = page.getByRole('tab', { name: 'Screenshots' });
  const settingsTab = page.getByRole('tab', { name: 'Settings' });
  
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
