const { app, BrowserWindow, ipcMain, shell, Tray, Menu, nativeImage } = require('electron');
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const actions = require('./cloudflare-ui-actions.cjs');
const profiles = require('./profile-contexts.cjs');

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) app.quit();

const commandDir = process.env.CLOUDFLARE_COMMAND_DIR || path.resolve(__dirname, '../..');
const commandPath = path.join(commandDir, 'cloudflare.command.sh');
const profileRoot = path.resolve(commandDir, '../../../ai-profile');
let mainWindow;
let tray;
let isQuitting = false;
let availableContexts = profiles.discoverContexts(profileRoot);
let selectedContext = availableContexts.find((item) => item.profileId === (process.env.AI_WORK_PROFILE_ID || process.env.WORK_PROFILE_ID) && item.workflow === process.env.AI_FLOW_WORKFLOW) || availableContexts[0];
const connectors = new Map();
const restartBaseMs = 1000;
const restartMaxMs = 30000;
const persistentLogLimit = Math.min(Math.max(Number.parseInt(process.env.CLOUDFLARE_UI_LOG_LIMIT || '10000', 10) || 10000, 1), 1000000);
const startHidden = /^(1|true|yes)$/i.test(process.env.CLOUDFLARE_UI_START_HIDDEN || '');
const logDir = process.env.CLOUDFLARE_UI_LOG_DIR || path.join(os.homedir(), 'Library', 'Logs', 'AI Fleas');
const logPath = path.join(logDir, 'cloudflare-tunnels.log');
let writtenSinceTrim = 0;

function persistLog(line) {
  try {
    fs.mkdirSync(logDir, { recursive: true, mode: 0o700 });
    fs.appendFileSync(logPath, `${line.replace(/\n+$/, '')}\n`, { mode: 0o600 });
    writtenSinceTrim += 1;
    if (writtenSinceTrim >= 250) {
      const lines = fs.readFileSync(logPath, 'utf8').split('\n').filter(Boolean);
      if (lines.length > persistentLogLimit) fs.writeFileSync(logPath, `${lines.slice(-persistentLogLimit).join('\n')}\n`, { mode: 0o600 });
      writtenSinceTrim = 0;
    }
  } catch (error) {
    process.stderr.write(`Cloudflare log persistence failed: ${error.message}\n`);
  }
}

function spawnOptions(providerId) {
  const env = profiles.contextEnv(process.env, selectedContext);
  if (providerId) env.CLOUDFLARE_SERVER_ID = providerId; else delete env.CLOUDFLARE_SERVER_ID;
  delete env.CLOUDFLARE_PROVIDER_ID;
  return { cwd: commandDir, env };
}
function connectorFor(providerId) { return connectors.get(providerId)?.child; }
function emitLog(providerId, chunk) {
  const line = `[${providerId}] ${actions.safeLog(chunk)}`;
  persistLog(`${new Date().toISOString()} ${line}`);
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('cloudflare:log', line);
}
function historicalLogs() {
  try { return fs.readFileSync(logPath, 'utf8').split('\n').filter(Boolean).slice(-persistentLogLimit); } catch { return []; }
}
function controllerLog(message) { persistLog(`${new Date().toISOString()} [controller] ${actions.safeLog(message)}`); }
async function autostartConnectors() {
  const configured = String(process.env.CLOUDFLARE_UI_AUTOSTART || '').trim();
  if (!configured) return;
  const available = await targetIds();
  const requested = configured === 'all' ? available : configured.split(',').map((item) => item.trim()).filter(Boolean);
  for (const providerId of requested) {
    if (!available.includes(providerId)) { emitLog(providerId, 'Autostart skipped: server is not configured.\n'); continue; }
    try { await startConnector(providerId); } catch (error) { emitLog(providerId, `Autostart failed: ${error.message}\n`); }
  }
}
async function targetIds() {
  if (!selectedContext) return [];
  const result = await actions.run(commandPath, ['list-targets'], spawnOptions());
  if (!result.ok) throw new Error(actions.safeLog(result.stderr));
  return result.stdout.trim().split(/\s+/).filter(Boolean);
}
async function targetStatus(providerId) {
  return { providerId, ...(await actions.status({ commandPath, connector: connectorFor(providerId), spawnOptions: () => spawnOptions(providerId) })) };
}
async function allStatuses() { return Promise.all((await targetIds()).map(targetStatus)); }
async function requireTarget(providerId) { if (!(await targetIds()).includes(providerId)) throw new Error('Server target is not configured in the selected profile.'); }

ipcMain.handle('cloudflare:contexts', () => ({ contexts: availableContexts, selected: selectedContext }));
ipcMain.handle('cloudflare:targets', allStatuses);
ipcMain.handle('cloudflare:logs', historicalLogs);
ipcMain.handle('cloudflare:select-context', async (_event, requested) => {
  if ([...connectors.values()].some((state) => state.child.exitCode === null)) throw new Error('Stop UI-managed connectors before switching profile.');
  availableContexts = profiles.discoverContexts(profileRoot);
  const match = availableContexts.find((item) => item.profileId === requested?.profileId && item.workflow === requested?.workflow);
  if (!match) throw new Error('That profile and workflow do not allow the Cloudflare command.');
  selectedContext = match;
  return { selected: selectedContext, targets: await allStatuses() };
});
async function startConnector(providerId, attempt = 0) {
  await requireTarget(providerId);
  const state = connectors.get(providerId);
  const existing = state?.child;
  if (existing && existing.exitCode === null) return targetStatus(providerId);
  const child = spawn(commandPath, ['run-tunnel'], { ...spawnOptions(providerId), stdio: ['ignore', 'pipe', 'pipe'] });
  const nextState = { child, stopping: false, restartTimer: null, attempt };
  connectors.set(providerId, nextState);
  emitLog(providerId, attempt ? `Restart attempt ${attempt} started.\n` : 'Connector start requested.\n');
  child.stdout.on('data', (chunk) => emitLog(providerId, chunk)); child.stderr.on('data', (chunk) => emitLog(providerId, chunk));
  child.once('error', (error) => emitLog(providerId, `Connector error: ${error.message}\n`));
  child.once('exit', async (code, signal) => {
    emitLog(providerId, `Connector stopped (${signal || code}).\n`);
    const current = connectors.get(providerId);
    if (!current || current.child !== child || current.stopping || isQuitting) return;
    const observed = await actions.run(commandPath, ['connector-status'], spawnOptions(providerId));
    if (actions.connectorIsOpen(observed)) {
      emitLog(providerId, 'Connector is already open under another controller; retry stopped.\n');
      connectors.delete(providerId);
      return;
    }
    const nextAttempt = current.attempt + 1;
    const delay = Math.min(restartBaseMs * (2 ** Math.min(nextAttempt - 1, 5)), restartMaxMs);
    emitLog(providerId, `Unexpected disconnect; reconnecting in ${delay / 1000}s.\n`);
    current.restartTimer = setTimeout(() => startConnector(providerId, nextAttempt).catch((error) => emitLog(providerId, `Restart failed: ${error.message}\n`)), delay);
  });
  await new Promise((resolve) => setTimeout(resolve, 900));
  return targetStatus(providerId);
}
ipcMain.handle('cloudflare:start', async (_event, providerId) => {
  return startConnector(providerId);
});
ipcMain.handle('cloudflare:stop', async (_event, providerId) => {
  const state = connectors.get(providerId);
  const child = state?.child;
  if (state) { state.stopping = true; if (state.restartTimer) clearTimeout(state.restartTimer); }
  if (child && child.exitCode === null) { child.kill('SIGTERM'); await new Promise((resolve) => child.once('exit', resolve)); }
  connectors.delete(providerId); return targetStatus(providerId);
});
ipcMain.handle('cloudflare:open-public-url', async (_event, providerId) => {
  const state = await targetStatus(providerId); if (!state.publicUrl) throw new Error('Public URL unavailable.');
  await shell.openExternal(state.publicUrl); return state.publicUrl;
});

function createWindow() {
  mainWindow = new BrowserWindow({ show: !startHidden, width: 1080, height: 760, minWidth: 820, minHeight: 600, title: 'Cloudflare Tunnels', backgroundColor: '#0d1117', webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false } });
  mainWindow.setMenuBarVisibility(false); mainWindow.setAutoHideMenuBar(true); mainWindow.loadFile(path.join(__dirname, '../panel/index.html'));
  if (startHidden && app.dock) app.dock.hide();
  mainWindow.on('close', (event) => {
    if (isQuitting) return;
    event.preventDefault();
    mainWindow.hide();
    if (app.dock) app.dock.hide();
  });
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    controllerLog(`Renderer stopped (${details.reason}, exit ${details.exitCode}); reloading UI.\n`);
    if (!isQuitting && mainWindow && !mainWindow.isDestroyed()) mainWindow.reload();
  });
  mainWindow.on('unresponsive', () => controllerLog('Controller window became unresponsive.\n'));
  mainWindow.on('responsive', () => controllerLog('Controller window recovered.\n'));
}
function showWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) createWindow();
  if (app.dock) app.dock.show();
  mainWindow.show();
  mainWindow.focus();
}
function createTray() {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18"><path fill="#000" d="M5.1 14.5a4.1 4.1 0 0 1-.6-8.15A5.35 5.35 0 0 1 14.7 7.8a3.35 3.35 0 0 1-.85 6.7H5.1Zm.1-2h8.55a1.35 1.35 0 1 0-.28-2.67l-1.12.23.08-1.14a3.35 3.35 0 0 0-6.56-1.2l-.24.75-.79-.06a2.1 2.1 0 1 0 .36 4.09Z"/></svg>';
  const icon = nativeImage.createFromDataURL(`data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`);
  const trayIcon = icon.resize({ width: 18, height: 18 });
  if (process.platform === 'darwin') trayIcon.setTemplateImage(true);
  tray = new Tray(trayIcon);
  if (process.platform === 'darwin') tray.setTitle('CF');
  tray.setToolTip('Cloudflare Tunnels');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Show Cloudflare Tunnels', click: showWindow },
    { type: 'separator' },
    { label: 'Tunnels continue while this window is hidden', enabled: false },
    { type: 'separator' },
    { label: 'Quit Cloudflare Tunnels', click: () => { isQuitting = true; app.quit(); } }
  ]));
  tray.on('click', showWindow);
}
process.on('uncaughtException', (error) => controllerLog(`Uncaught controller error: ${error.stack || error.message}\n`));
process.on('unhandledRejection', (error) => controllerLog(`Unhandled controller rejection: ${error?.stack || error}\n`));
app.on('child-process-gone', (_event, details) => controllerLog(`Electron child process stopped (${details.type}: ${details.reason}, exit ${details.exitCode}).\n`));
if (hasSingleInstanceLock) {
  app.on('second-instance', showWindow);
  app.whenReady().then(async () => {
    createWindow();
    createTray();
    try { await autostartConnectors(); } catch (error) { controllerLog(`Autostart initialization failed: ${error.message}\n`); }
  });
}
app.on('before-quit', () => { isQuitting = true; for (const state of connectors.values()) { state.stopping = true; if (state.restartTimer) clearTimeout(state.restartTimer); if (state.child.exitCode === null) state.child.kill('SIGTERM'); } });
app.on('window-all-closed', () => {});
app.on('activate', showWindow);
