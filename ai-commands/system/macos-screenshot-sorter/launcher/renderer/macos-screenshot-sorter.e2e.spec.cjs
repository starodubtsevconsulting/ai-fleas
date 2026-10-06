const { test, expect } = require('@playwright/test');
const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');

// Start a local HTTP server to serve the Angular app
let server, serverPort;

async function startServer() {
  return new Promise((resolve) => {
    server = http.createServer((req, res) => {
      let filePath = path.join(__dirname, req.url === '/' ? 'index.html' : req.url);
      const ext = path.extname(filePath);
      const contentTypes = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json' };
      fs.readFile(filePath, (err, data) => {
        if (err) { res.writeHead(404); res.end('Not found'); return; }
        res.writeHead(200, { 'Content-Type': contentTypes[ext] || 'text/plain' });
        res.end(data);
      });
    });
    
    server.listen(0, () => {
      serverPort = server.address().port;
      console.log(`[TEST SERVER] Renderer server running on http://127.0.0.1:${serverPort}`);
      resolve();
    });
  });
}

async function stopServer() {
  return new Promise((resolve) => {
    if (server) {
      server.close(() => resolve());
    } else {
      resolve();
    }
  });
}

function rendererUrl() {
  return `http://127.0.0.1:${serverPort}/`;
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

test.beforeAll(async () => {
  await startServer();
});

test.afterAll(async () => {
  await stopServer();
});

test('Tabs navigation works correctly', async ({ page }) => {
  page.on('console', msg => console.log(`Console: ${msg.text()}`));
  page.on('pageerror', error => console.log(`Page error: ${error.message}`));
  
  await page.addInitScript(setupMockScreenshotSorter);
  await page.goto(rendererUrl());

  // Wait for the page to fully load
  await page.waitForLoadState('networkidle');
  
  // Check tabs by class name
  const tabs = page.locator('.tab');
  await expect(tabs).toHaveCount(2);
  
  const firstTab = tabs.nth(0);
  await expect(firstTab).toHaveText('Screenshots');
  await expect(firstTab).toHaveAttribute('aria-selected', 'true');
  
  const secondTab = tabs.nth(1);
  await expect(secondTab).toHaveText('Settings');
  await expect(secondTab).toHaveAttribute('aria-selected', 'false');

  // Switch to Settings tab
  await secondTab.click();
  await expect(firstTab).toHaveAttribute('aria-selected', 'false');
  await expect(secondTab).toHaveAttribute('aria-selected', 'true');
  
  // Switch back to Screenshots tab
  await firstTab.click();
  await expect(firstTab).toHaveAttribute('aria-selected', 'true');
  await expect(secondTab).toHaveAttribute('aria-selected', 'false');
});

test('Settings tab shows default config values', async ({ page }) => {
  page.on('console', msg => console.log(`Console: ${msg.text()}`));
  page.on('pageerror', error => console.log(`Page error: ${error.message}`));
  
  await page.addInitScript(setupMockScreenshotSorter);
  await page.goto(rendererUrl());
  
  // Switch to Settings tab
  const settingsTab = page.locator('.tab').nth(1);
  await settingsTab.click();
  await page.waitForLoadState('networkidle');
  
  // Check settings form fields are populated
  const inputs = page.locator('input[type="text"]');
  await expect(inputs).toHaveCount(2);
  await expect(inputs.nth(0)).toHaveValue('/Users/sergii/Screenshots');
  await expect(inputs.nth(1)).toHaveValue('/Users/sergii/Screenshots');
});

test('Library tab shows empty state when no screenshots', async ({ page }) => {
  page.on('console', msg => console.log(`Console: ${msg.text()}`));
  page.on('pageerror', error => console.log(`Page error: ${error.message}`));
  
  await page.addInitScript(setupMockScreenshotSorter);
  await page.goto(rendererUrl());

  // Wait for the page to fully load
  await page.waitForLoadState('networkidle');
  
  // Verify empty state message
  const emptyState = page.locator('.empty');
  await expect(emptyState).toBeVisible();
  await expect(emptyState).toHaveText('Loading screenshots...');
});

test('Library tab shows folder list when screenshots exist', async ({ page }) => {
  page.on('console', msg => console.log(`Console: ${msg.text()}`));
  page.on('pageerror', error => console.log(`Page error: ${error.message}`));
  
  await page.addInitScript(setupMockWithLibrary);
  await page.goto(rendererUrl());
  
  // Wait for screenshots to load
  await page.waitForLoadState('networkidle');
  
  // Check that folders are displayed (use .folder-section to avoid matching .folder-open buttons)
  const folders = page.locator('.folder-section');
  await expect(folders).toHaveCount(2);
  
  // Check folder dates
  await expect(folders.nth(0)).toContainText('2026-10-05');
  await expect(folders.nth(1)).toContainText('2026-10-04');
  
  // Check screenshot counts
  await expect(folders.nth(0)).toContainText('3 screenshots');
  await expect(folders.nth(1)).toContainText('1 screenshot');
});

test('Screenshots display with thumbnails', async ({ page }) => {
  page.on('console', msg => console.log(`Console: ${msg.text()}`));
  page.on('pageerror', error => console.log(`Page error: ${error.message}`));
  
  await page.addInitScript(setupMockWithLibrary);
  await page.goto(rendererUrl());
  
  // Wait for screenshots to load
  await page.waitForLoadState('networkidle');
  
  // Wait a bit more for thumbnails to load
  await page.waitForTimeout(500);
  
  // Check that thumbnail images are rendered
  const thumbnails = page.locator('.shot img');
  await expect(thumbnails).toHaveCount(4);
  
  // Verify each thumbnail has a src attribute with base64 data
  for (let i = 0; i < 4; i++) {
    const src = await thumbnails.nth(i).getAttribute('src');
    expect(src).toContain('data:image/');
    expect(src).toContain('base64');
  }
});

test('Hero image in Library tab has close button', async ({ page }) => {
  page.on('console', msg => console.log(`Console: ${msg.text()}`));
  page.on('pageerror', error => console.log(`Page error: ${error.message}`));
  
  await page.addInitScript(setupMockScreenshotSorter);
  await page.goto(rendererUrl());
  
  // Wait for the page to fully load
  await page.waitForLoadState('networkidle');
  
  // Hero should be visible (Library tab is active by default)
  const heroContainers = page.locator('.hero-container');
  await expect(heroContainers).toHaveCount(2);
  const heroContainer = heroContainers.nth(0);
  await expect(heroContainer).toBeVisible();
  
  // Check that close button exists
  const closeBtn = heroContainer.locator('.close');
  await expect(closeBtn).toBeVisible();
  await expect(closeBtn).toHaveText('×');
  
  // Click close button
  await closeBtn.click();
  
  // Hero should be hidden
  await expect(heroContainer).not.toBeVisible();
});

test('Hero image in Settings tab', async ({ page }) => {
  page.on('console', msg => console.log(`Console: ${msg.text()}`));
  page.on('pageerror', error => console.log(`Page error: ${error.message}`));
  
  await page.addInitScript(setupMockScreenshotSorter);
  await page.goto(rendererUrl());
  
  // Switch to Settings tab
  const settingsTab = page.locator('.tab').nth(1);
  await settingsTab.click();
  await page.waitForLoadState('networkidle');
  
  // Hero should be visible in settings
  const heroImages = page.locator('.hero');
  await expect(heroImages).toHaveCount(2); // Library + Settings
  const settingsHero = heroImages.nth(1);
  await expect(settingsHero).toBeVisible();
  await expect(settingsHero).toHaveAttribute('alt', 'A person and an AI Fleas robot working together at a desk');
});

test('Refresh button loads library', async ({ page }) => {
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
  await page.waitForLoadState('networkidle');
  
  // Wait for initial load
  await page.waitForFunction(() => window.libraryCallCount >= 1);
  
  // Click refresh button (filter by text to get the correct button in Library tab)
  const libraryHead = page.locator('.library-head');
  await expect(libraryHead).toBeVisible();
  await libraryHead.locator('.secondary').filter({ hasText: 'Refresh' }).click();
  
  // Wait for reload to trigger
  await page.waitForFunction(() => window.libraryCallCount >= 2);
});

test('Save button triggers save action', async ({ page }) => {
  page.on('console', msg => console.log(`Console: ${msg.text()}`));
  page.on('pageerror', error => console.log(`Page error: ${error.message}`));
  
  await page.addInitScript(setupMockScreenshotSorter);
  await page.goto(rendererUrl());
  
  // Switch to Settings tab
  const settingsTab = page.locator('.tab').nth(1);
  await settingsTab.click();
  await page.waitForLoadState('networkidle');
  
  // Find save button (it's the only button that says "Save and reload sorter")
  const saveButton = page.locator('.card button').filter({ hasText: 'Save and reload sorter' });
  await expect(saveButton).toBeVisible();
  await expect(saveButton).toBeEnabled();
  
  // Click save button
  await saveButton.click();
  
  // Wait for status to update
  const statusText = page.locator('.status');
  await expect(statusText).toContainText('Settings saved');
});

test('App stays visible after window switch (no white screen)', async ({ page }) => {
  page.on('console', msg => console.log(`Console: ${msg.text()}`));
  page.on('pageerror', error => console.log(`Page error: ${error.message}`));
  
  await page.addInitScript(setupMockScreenshotSorter);
  await page.goto(rendererUrl());
  
  // Wait for the page to fully load
  await page.waitForLoadState('networkidle');
  
  // Check that main elements are visible initially
  const tabs = page.locator('.tab');
  await expect(tabs).toHaveCount(2);
  
  // Verify hero image is accessible (not missing) - Library tab is active by default
  const heroContainers = page.locator('.hero-container');
  await expect(heroContainers).toHaveCount(2);
  const heroContainer = heroContainers.nth(0);
  await expect(heroContainer).toBeVisible();
  
  // Verify settings panel is visible (Library is hidden by default due to hidden attribute)
  const settingsPanel = page.locator('.panel[hidden]').nth(0);
  await expect(settingsPanel).not.toBeVisible();
  
  const libraryPanel = page.locator('.panel').nth(0);
  await expect(libraryPanel).toBeVisible();
});

test('Folder-open icon opens image folder in Finder', async ({ page }) => {
  page.on('console', msg => console.log(`Console: ${msg.text()}`));
  page.on('pageerror', error => console.log(`Page error: ${error.message}`));
  
  const openFolderCalls = [];
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
          date: '2026-10-05',
          count: 1,
          screenshots: [
            { id: 'shot1', name: 'Screenshot 2026-10-05 at 10-30-00.png', modifiedAt: Date.now() - 3600000, bytes: 102400, folderPath: '/Users/sergii/Screenshots/2026-10-05' }
          ]
        }
      ],
      chooseFolder: async (current) => null,
      save: async (settings) => ({ output: 'Settings saved' }),
      thumbnail: async (id) => `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6twAAAABJRU5ErkJggg==`,
      openFolder: async (folderPath) => {
        window.openFolderCalls = window.openFolderCalls || [];
        window.openFolderCalls.push(folderPath);
        return null;
      }
    };
  });
  
  await page.goto(rendererUrl());
  await page.waitForLoadState('networkidle');
  
  // Wait for thumbnails to load
  await page.waitForTimeout(500);
  
  // Check that folder-open icon exists
  const folderIcons = page.locator('.shot-actions button.folder');
  await expect(folderIcons).toHaveCount(1);
  
  // Verify the icon is visible
  const folderIcon = folderIcons.nth(0);
  await expect(folderIcon).toBeVisible();
  
  // Click the folder-open icon
  await folderIcon.click();
  
  // Wait for the openFolder call to complete
  await page.waitForTimeout(500);
  
  // Verify openFolder was called with the correct folder path
  await page.waitForFunction(() => window.openFolderCalls && window.openFolderCalls.length > 0);
  const folderPaths = await page.evaluate(() => window.openFolderCalls);
  expect(folderPaths).toEqual(['/Users/sergii/Screenshots/2026-10-05']);
});

test('Folder-open icon shows only icon without text label', async ({ page }) => {
  page.on('console', msg => console.log(`Console: ${msg.text()}`));
  page.on('pageerror', error => console.log(`Page error: ${error.message}`));
  
  await page.addInitScript(() => {
    window.screenshotSorter = {
      settings: async () => ({ sourceDir: '/Users/sergii/Screenshots', destinationDir: '/Users/sergii/Screenshots', settleSeconds: 2, startIntervalSeconds: 10 }),
      status: async () => 'Sorter is running',
      library: async () => [{ date: '2026-10-05', count: 1, screenshots: [{ id: 'shot1', name: 'Screenshot 2026-10-05 at 10-30-00.png', modifiedAt: Date.now() - 3600000, bytes: 102400, folderPath: '/Users/sergii/Screenshots/2026-10-05' }] }],
      chooseFolder: async () => null,
      save: async () => ({ output: 'Settings saved' }),
      thumbnail: async () => `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6twAAAABJRU5ErkJggg==`,
      fullImage: async () => `file:///Users/sergii/Screenshots/2026-10-05/Screenshot%202026-10-05%20at%2010-30-00.png`,
      openFolder: async () => null
    };
  });
  
  await page.goto(rendererUrl());
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);
  
  // Check folder-open icon exists
  const folderIcons = page.locator('.shot-actions button.folder');
  await expect(folderIcons).toHaveCount(1);
  
  // Verify no text label - button should only contain SVG
  const folderIcon = folderIcons.nth(0);
  await expect(folderIcon).toBeVisible();
  const innerHTML = await folderIcon.innerHTML();
  expect(innerHTML).toContain('<svg');
  expect(innerHTML).not.toContain('Open Folder');
  expect(innerHTML).not.toContain('folder');
});

test('Full screen view opens when thumbnail is clicked', async ({ page }) => {
  page.on('console', msg => console.log(`Console: ${msg.text()}`));
  page.on('pageerror', error => console.log(`Page error: ${error.message}`));
  
  await page.addInitScript(() => {
    window.screenshotSorter = {
      settings: async () => ({ sourceDir: '/Users/sergii/Screenshots', destinationDir: '/Users/sergii/Screenshots', settleSeconds: 2, startIntervalSeconds: 10 }),
      status: async () => 'Sorter is running',
      library: async () => [{ date: '2026-10-05', count: 1, screenshots: [{ id: 'shot1', name: 'Screenshot 2026-10-05 at 10-30-00.png', modifiedAt: Date.now() - 3600000, bytes: 102400, folderPath: '/Users/sergii/Screenshots/2026-10-05' }] }],
      chooseFolder: async () => null,
      save: async () => ({ output: 'Settings saved' }),
      thumbnail: async () => `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6twAAAABJRU5ErkJggg==`,
      fullImage: async () => `file:///Users/sergii/Screenshots/2026-10-05/Screenshot%202026-10-05%20at%2010-30-00.png`,
      openFolder: async () => null
    };
  });
  
  await page.goto(rendererUrl());
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);
  
  // Verify full screen overlay is initially hidden
  const fullScreenOverlay = page.locator('app-screenshot-detail .full-screen-overlay');
  await expect(fullScreenOverlay).not.toBeVisible();
  
  // Click the thumbnail to open full screen view
  const thumbnails = page.locator('.shot img');
  await expect(thumbnails).toHaveCount(1);
  await thumbnails.nth(0).click();
  
  // Wait a bit for animation
  await page.waitForTimeout(300);
  
  // Verify full screen overlay is now visible
  await expect(fullScreenOverlay).toBeVisible();
});

test('Full screen view shows correct screenshot', async ({ page }) => {
  page.on('console', msg => console.log(`Console: ${msg.text()}`));
  page.on('pageerror', error => console.log(`Page error: ${error.message}`));
  
  await page.addInitScript(() => {
    window.screenshotSorter = {
      settings: async () => ({ sourceDir: '/Users/sergii/Screenshots', destinationDir: '/Users/sergii/Screenshots', settleSeconds: 2, startIntervalSeconds: 10 }),
      status: async () => 'Sorter is running',
      library: async () => [{ date: '2026-10-05', count: 1, screenshots: [{ id: 'shot1', name: 'Screenshot 2026-10-05 at 10-30-00.png', modifiedAt: Date.now() - 3600000, bytes: 102400, folderPath: '/Users/sergii/Screenshots/2026-10-05' }] }],
      chooseFolder: async () => null,
      save: async () => ({ output: 'Settings saved' }),
      thumbnail: async () => `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6twAAAABJRU5ErkJggg==`,
      fullImage: async () => `file:///Users/sergii/Screenshots/2026-10-05/Screenshot%202026-10-05%20at%2010-30-00.png`,
      openFolder: async () => null
    };
  });
  
  await page.goto(rendererUrl());
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);
  
  // Click the thumbnail to open full screen view
  const thumbnails = page.locator('.shot img');
  await thumbnails.nth(0).click();
  await page.waitForTimeout(300);
  
  // Wait for full screen overlay to be visible (with image)
  const fullScreenOverlay = page.locator('app-screenshot-detail .full-screen-overlay');
  await expect(fullScreenOverlay).toBeVisible();
  
  // Wait for the close button to be visible
  const closeBtn = fullScreenOverlay.locator('.full-screen-close');
  await expect(closeBtn).toBeVisible();
  
  // Verify close button contains SVG
  const closeBtnHTML = await closeBtn.innerHTML();
  expect(closeBtnHTML).toContain('<svg');
  expect(closeBtnHTML).toContain('line');
  expect(closeBtnHTML).toContain('x1=');
  
  // Verify image exists and has correct src
  const fullScreenImg = fullScreenOverlay.locator('img');
  await expect(fullScreenImg).toBeVisible();
  const src = await fullScreenImg.getAttribute('src');
  expect(src).toContain('file://');
});

test('Full screen view closes with X button', async ({ page }) => {
  page.on('console', msg => console.log(`Console: ${msg.text()}`));
  page.on('pageerror', error => console.log(`Page error: ${error.message}`));
  
  await page.addInitScript(() => {
    window.screenshotSorter = {
      settings: async () => ({ sourceDir: '/Users/sergii/Screenshots', destinationDir: '/Users/sergii/Screenshots', settleSeconds: 2, startIntervalSeconds: 10 }),
      status: async () => 'Sorter is running',
      library: async () => [{ date: '2026-10-05', count: 1, screenshots: [{ id: 'shot1', name: 'Screenshot 2026-10-05 at 10-30-00.png', modifiedAt: Date.now() - 3600000, bytes: 102400, folderPath: '/Users/sergii/Screenshots/2026-10-05' }] }],
      chooseFolder: async () => null,
      save: async () => ({ output: 'Settings saved' }),
      thumbnail: async () => `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6twAAAABJRU5ErkJggg==`,
      fullImage: async () => `file:///Users/sergii/Screenshots/2026-10-05/Screenshot%202026-10-05%20at%2010-30-00.png`,
      openFolder: async () => null
    };
  });
  
  await page.goto(rendererUrl());
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);
  
  // Click the thumbnail to open full screen view
  const thumbnails = page.locator('.shot img');
  await thumbnails.nth(0).click();
  await page.waitForTimeout(500);
  
  // Wait for full screen overlay to be visible
  const fullScreenOverlay = page.locator('app-screenshot-detail .full-screen-overlay');
  await expect(fullScreenOverlay).toBeVisible({ timeout: 5000 });
  
  // Verify close button exists
  const closeBtn = fullScreenOverlay.locator('.full-screen-close');
  await expect(closeBtn).toBeVisible();
  
  // Click the close button
  await closeBtn.click();
  await page.waitForTimeout(300);
  
  // Verify full screen overlay is now hidden
  await expect(fullScreenOverlay).not.toBeVisible();
});

test('Full screen view closes when clicking outside', async ({ page }) => {
  page.on('console', msg => console.log(`Console: ${msg.text()}`));
  page.on('pageerror', error => console.log(`Page error: ${error.message}`));
  
  await page.addInitScript(() => {
    window.screenshotSorter = {
      settings: async () => ({ sourceDir: '/Users/sergii/Screenshots', destinationDir: '/Users/sergii/Screenshots', settleSeconds: 2, startIntervalSeconds: 10 }),
      status: async () => 'Sorter is running',
      library: async () => [{ date: '2026-10-05', count: 1, screenshots: [{ id: 'shot1', name: 'Screenshot 2026-10-05 at 10-30-00.png', modifiedAt: Date.now() - 3600000, bytes: 102400, folderPath: '/Users/sergii/Screenshots/2026-10-05' }] }],
      chooseFolder: async () => null,
      save: async () => ({ output: 'Settings saved' }),
      thumbnail: async () => `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6twAAAABJRU5ErkJggg==`,
      fullImage: async () => `file:///Users/sergii/Screenshots/2026-10-05/Screenshot%202026-10-05%20at%2010-30-00.png`,
      openFolder: async () => null
    };
  });
  
  await page.goto(rendererUrl());
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);
  
  // Click the thumbnail to open full screen view
  const thumbnails = page.locator('.shot img');
  await thumbnails.nth(0).click();
  await page.waitForTimeout(300);
  
  // Verify full screen overlay is visible
  const fullScreenOverlay = page.locator('app-screenshot-detail .full-screen-overlay');
  await expect(fullScreenOverlay).toBeVisible();
  
  // Click outside the content (on the overlay background)
  await fullScreenOverlay.click({ position: { x: 10, y: 10 } });
  await page.waitForTimeout(300);
  
  // Verify full screen overlay is now hidden
  await expect(fullScreenOverlay).not.toBeVisible();
});
