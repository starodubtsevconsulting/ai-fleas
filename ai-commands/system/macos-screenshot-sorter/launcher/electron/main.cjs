const { app, BrowserWindow, dialog, ipcMain, Tray, Menu, nativeImage } = require('electron');
const { spawn, spawnSync } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');

const commandDir = process.env.SCREENSHOT_SORTER_COMMAND_DIR || path.resolve(__dirname, '../..');
const commandPath = path.join(commandDir, 'macos-screenshot-sorter.command.sh');
const configPath = process.env.AI_COMMAND_CONFIG_PATH;
let mainWindow;
let tray;
let allowQuit = false;
let screenshotItems = new Map();
let rendererServer;
app.setPath('userData', path.join(app.getPath('appData'), 'AI Fleas Screenshot Sorter'));
const isPrimaryInstance = app.requestSingleInstanceLock();
if (!isPrimaryInstance) app.exit(0);

function fail(message) { throw new Error(message); }
function readConfig() {
  if (!configPath) fail('No active profile configuration is available. Launch the UI through macos-screenshot-sorter.command.sh ui.');
  const raw = fs.readFileSync(configPath, 'utf8');
  const values = {};
  for (const line of raw.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(?:"([^"]*)"|'([^']*)'|([^#\s]*))/);
    if (match) {
      values[match[1]] = match[2] ?? match[3] ?? match[4] ?? '';
    }
  }
  return { raw, values };
}
function safePath(value, label) {
  if (typeof value !== 'string' || !path.isAbsolute(value) || value.includes('\0')) fail(`${label} must be an absolute path.`);
  return value;
}
function safeInteger(value, label, minimum, maximum) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) fail(`${label} must be an integer from ${minimum} to ${maximum}.`);
  return value;
}
function requiredConfig(values, key) {
  if (!values[key]) fail(`Active profile configuration must set ${key}.`);
  return values[key];
}
function configuredInteger(values, key, label, minimum, maximum) {
  const raw = requiredConfig(values, key);
  if (!/^\d+$/.test(raw)) fail(`${label} must be a whole number from ${minimum} to ${maximum}.`);
  return safeInteger(Number(raw), label, minimum, maximum);
}
function shellValue(value) { return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\$/g, '\\$').replace(/`/g, '\\`')}"`; }
function updateConfig(settings) {
  const source = safePath(settings.sourceDir, 'Capture inbox');
  const destination = safePath(settings.destinationDir, 'Sorted screenshots folder');
  const settle = safeInteger(settings.settleSeconds, 'Settle delay', 0, 60);
  const interval = safeInteger(settings.startIntervalSeconds, 'Recovery interval', 0, 3600);
  if (interval !== 0 && interval < 10) fail('Recovery interval must be 0 (off) or 10–3600 seconds.');
  if (!fs.existsSync(source) || !fs.statSync(source).isDirectory()) fail('Capture inbox does not exist.');
  if (!fs.existsSync(destination) || !fs.statSync(destination).isDirectory()) fail('Sorted screenshots folder does not exist.');
  const { raw } = readConfig();
  const updates = {
    SCREENSHOT_SORTER_SOURCE_DIR: shellValue(source),
    SCREENSHOT_SORTER_DESTINATION_DIR: shellValue(destination),
    SCREENSHOT_SORTER_SETTLE_SECONDS: String(settle),
    SCREENSHOT_SORTER_START_INTERVAL_SECONDS: String(interval)
  };
  const seen = new Set();
  const rewritten = raw.split(/\r?\n/).map((line) => {
    const match = line.match(/^([A-Z0-9_]+)=/);
    if (!match || !(match[1] in updates)) return line;
    seen.add(match[1]); return `${match[1]}=${updates[match[1]]}`;
  });
  for (const [key, value] of Object.entries(updates)) if (!seen.has(key)) rewritten.push(`${key}=${value}`);
  const temporary = `${configPath}.candidate-${process.pid}`;
  fs.writeFileSync(temporary, `${rewritten.join('\n').replace(/\n+$/, '')}\n`, { mode: 0o600 });
  fs.renameSync(temporary, configPath);
}
function applyMacCaptureLocation(source) {
  const defaults = spawnSync('/usr/bin/defaults', ['write', 'com.apple.screencapture', 'location', source], { encoding: 'utf8' });
  if (defaults.status !== 0) fail(defaults.stderr || 'macOS could not update the screenshot capture location.');
  const restart = spawnSync('/usr/bin/killall', ['SystemUIServer'], { encoding: 'utf8' });
  if (restart.status !== 0 && restart.status !== 1) fail(restart.stderr || 'macOS could not reload screenshot preferences.');
}
function runCommand(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(commandPath, args, { cwd: commandDir, env: process.env });
    let stdout = ''; let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.once('error', reject);
    child.once('exit', (code) => code === 0 ? resolve({ stdout, stderr }) : reject(new Error(stderr || `Command failed with exit ${code}.`)));
  });
}
function settings() {
  const { values } = readConfig();
  const settleSeconds = configuredInteger(values, 'SCREENSHOT_SORTER_SETTLE_SECONDS', 'Settle delay', 0, 60);
  const startIntervalSeconds = configuredInteger(values, 'SCREENSHOT_SORTER_START_INTERVAL_SECONDS', 'Recovery interval', 0, 3600);
  if (startIntervalSeconds !== 0 && startIntervalSeconds < 10) fail('Recovery interval must be 0 (off) or 10–3600 seconds.');
  return {
    sourceDir: requiredConfig(values, 'SCREENSHOT_SORTER_SOURCE_DIR'), destinationDir: requiredConfig(values, 'SCREENSHOT_SORTER_DESTINATION_DIR'),
    settleSeconds, startIntervalSeconds, candidateLabel: requiredConfig(values, 'SCREENSHOT_SORTER_LABEL')
  };
}
const DATE_FOLDER = /^(\d{4}-\d{2}-\d{2})$/;
const IMAGE_SUFFIX = /\.(?:png|jpe?g|heic|webp|tiff?)$/i;
const SCREENSHOT_NAME = /^(?:Screenshot|Screen Shot)(?:[ _-]|$)/i;
function isContained(child, parent) {
  const relative = path.relative(parent, child);
  return Boolean(relative) && !relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative);
}
function isCaptureDate(name) {
  if (!DATE_FOLDER.test(name)) return false;
  const date = new Date(`${name}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === name;
}
function safeScreenshotFile(filePath, folderPath, rootPath) {
  const entry = fs.lstatSync(filePath);
  if (!entry.isFile() || entry.isSymbolicLink() || !IMAGE_SUFFIX.test(path.basename(filePath)) || !SCREENSHOT_NAME.test(path.basename(filePath))) return null;
  const realFile = fs.realpathSync(filePath);
  if (!isContained(realFile, folderPath) || !isContained(realFile, rootPath)) return null;
  return { realFile, stat:fs.statSync(realFile) };
}
function screenshotLibrary() {
  const root = fs.realpathSync(settings().destinationDir);
  screenshotItems = new Map();
  const folders = fs.readdirSync(root, { withFileTypes:true })
    .filter((entry) => entry.isDirectory() && !entry.isSymbolicLink() && isCaptureDate(entry.name))
    .sort((left, right) => right.name.localeCompare(left.name));
  return folders.map((folder) => {
    const folderPath = fs.realpathSync(path.join(root, folder.name));
    if (!isContained(folderPath, root)) return null;
    const images = fs.readdirSync(folderPath, { withFileTypes:true })
      .map((entry) => {
        if (!entry.isFile() || entry.isSymbolicLink()) return null;
        const checked = safeScreenshotFile(path.join(folderPath, entry.name), folderPath, root);
        if (!checked) return null;
        return { name:entry.name, realFile:checked.realFile, modifiedAt:checked.stat.mtimeMs, bytes:checked.stat.size };
      }).filter(Boolean)
      .sort((left, right) => right.modifiedAt - left.modifiedAt);
    return {
      date:folder.name,
      count:images.length,
      screenshots:images.slice(0, 24).map((image) => {
        const id = randomUUID();
        screenshotItems.set(id, { ...image, folderPath, root });
        return { id, name:image.name, modifiedAt:image.modifiedAt, bytes:image.bytes, folderPath };
      })
    };
  }).filter((folder) => folder && folder.count > 0);
}
function screenshotThumbnail(_event, id) {
  if (typeof id !== 'string') fail('Screenshot identifier is invalid.');
  const item = screenshotItems.get(id);
  if (!item) fail('Screenshot is no longer available. Refresh the list and try again.');
  const checked = safeScreenshotFile(item.realFile, item.folderPath, item.root);
  if (!checked || checked.realFile !== item.realFile) fail('Screenshot changed before its thumbnail could be loaded. Refresh the list and try again.');
  return nativeImage.createFromPath(checked.realFile).resize({ width:240, height:135, quality:'good' }).toDataURL();
}
function showWindow() { if (mainWindow) { if (app.dock) app.dock.show(); if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.show(); mainWindow.focus(); } }
function cameraIcon() {
  // macOS menu-bar images need 2x source pixels. The prior 18px SVG became
  // nearly invisible on Retina displays even though the Tray existed.
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 18 18"><path fill="#000" d="M3 5h2l1-2h6l1 2h2c1.1 0 2 .9 2 2v7c0 1.1-.9 2-2 2H3c-1.1 0-2-.9-2-2V7c0-1.1.9-2 2-2Zm6 2.2A3.8 3.8 0 1 0 9 14.8 3.8 3.8 0 0 0 9 7.2Zm0 1.5A2.3 2.3 0 1 1 9 13.3 2.3 2.3 0 0 1 9 8.7Z"/></svg>';
  const icon = nativeImage.createFromDataURL(`data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`);
  icon.setTemplateImage(true); return icon;
}
function createWindow() {
  // Start renderer server for Angular app
  const rendererDir = path.join(__dirname, '../renderer');
  rendererServer = http.createServer((req, res) => {
    let filePath = path.join(rendererDir, req.url === '/' ? 'index.html' : req.url);
    const ext = path.extname(filePath);
    const contentTypes = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json' };
    fs.readFile(filePath, (err, data) => {
      if (err) { res.writeHead(404); res.end('Not found'); return; }
      res.writeHead(200, { 'Content-Type': contentTypes[ext] || 'text/plain' });
      res.end(data);
    });
  });
  
  // Create BrowserWindow BEFORE loading URL (window is visible in app.whenReady)
  mainWindow = new BrowserWindow({ width: 800, height: 600, minWidth: 580, minHeight: 640, title: 'Screenshot Sorter', icon: cameraIcon(), backgroundColor: '#f7f7fb', webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  mainWindow.setMenuBarVisibility(false);
  
  rendererServer.listen(0, '127.0.0.1', () => {
    const port = rendererServer.address().port;
    // Log to both stderr and the output log
    console.error(`[DEV] Renderer server running on http://127.0.0.1:${port}`);
    console.log(`[DEV] Renderer server running on http://127.0.0.1:${port}`);
    // Load Angular app via HTTP instead of file://
    mainWindow.loadURL(`http://127.0.0.1:${port}/`);
    mainWindow.on('close', (event) => { if (allowQuit) return; event.preventDefault(); mainWindow.hide(); if (app.dock) app.dock.hide(); });
  }).on('error', (err) => {
    console.error(`[DEV] Server error: ${err.message}`);
  });
}
// Dev mode: auto-reload when index.html changes (polling-based for macOS reliability)
// rendererDir is now defined inside createWindow() since we serve via HTTP
const indexHtmlPath = path.join(__dirname, '../renderer/index.html');
if (process.env.ELECTRON_DEV === '1') {
  let lastMtime = 0;
  const checkAndReload = () => {
    try {
      const stat = fs.statSync(indexHtmlPath);
      if (stat.mtimeMs > lastMtime) {
        lastMtime = stat.mtimeMs;
        console.error('[DEV] index.html changed, reloading window...');
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.reload();
        }
      }
    } catch { /* ignore */ }
  };
  // Check every 500ms for changes
  setInterval(checkAndReload, 500);
}
if (isPrimaryInstance) {
  ipcMain.handle('sorter:settings', settings);
  ipcMain.handle('sorter:choose-folder', async (_event, current) => {
    const result = await dialog.showOpenDialog(mainWindow, { title: 'Choose folder', defaultPath: typeof current === 'string' ? current : os.homedir(), properties: ['openDirectory', 'createDirectory'] });
    return result.canceled ? null : result.filePaths[0];
  });
  ipcMain.handle('sorter:save', async (_event, next) => { updateConfig(next); screenshotItems = new Map(); applyMacCaptureLocation(next.sourceDir); const result = await runCommand(['install', '--apply']); return { settings: settings(), output: result.stdout.trim() }; });
  ipcMain.handle('sorter:status', async () => (await runCommand(['probe'])).stdout);
  ipcMain.handle('sorter:library', screenshotLibrary);
  ipcMain.handle('sorter:thumbnail', screenshotThumbnail);
  ipcMain.handle('sorter:open-folder', async (_event, folderPath) => {
    const { shell } = require('electron');
    return shell.openExternal('file://' + folderPath);
  });
  app.on('second-instance', showWindow);
  app.whenReady().then(() => {
    createWindow();
    tray = new Tray(cameraIcon());
    // Keep a visible status-bar affordance even if macOS does not render the
    // small template SVG for this unpackaged Electron app.
    // Keep a short text title as a visible fallback on macOS variants that
    // decline to render a programmatic template image in the status bar.
    tray.setTitle('SS');
    tray.setToolTip('Screenshot Sorter');
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: 'Show Screenshot Sorter', click: showWindow },
      { type: 'separator' },
      { label: 'Quit Screenshot Sorter', click: () => { allowQuit = true; app.quit(); } }
    ]));
    tray.on('click', showWindow);
  });
  app.on('before-quit', (event) => { if (!allowQuit) event.preventDefault(); if (rendererServer) rendererServer.close(); });
  app.on('activate', showWindow); app.on('window-all-closed', () => {});
}
