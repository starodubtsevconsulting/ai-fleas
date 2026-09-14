const { app, BrowserWindow, ipcMain, shell, Tray, Menu, nativeImage } = require('electron');
const { spawn } = require('node:child_process');
const path = require('node:path');
const actions = require('./cloudflare-ui-actions.cjs');
const profiles = require('./profile-contexts.cjs');

const commandDir = process.env.CLOUDFLARE_COMMAND_DIR || path.resolve(__dirname, '../..');
const commandPath = path.join(commandDir, 'cloudflare.command.sh');
const profileRoot = path.resolve(commandDir, '../../../ai-profile');
let mainWindow;
let tray;
let isQuitting = false;
let availableContexts = profiles.discoverContexts(profileRoot);
let selectedContext = availableContexts.find((item) => item.profileId === (process.env.AI_WORK_PROFILE_ID || process.env.WORK_PROFILE_ID) && item.workflow === process.env.AI_FLOW_WORKFLOW) || availableContexts[0];
const connectors = new Map();

function spawnOptions(providerId) {
  const env = profiles.contextEnv(process.env, selectedContext);
  if (providerId) env.CLOUDFLARE_PROVIDER_ID = providerId; else delete env.CLOUDFLARE_PROVIDER_ID;
  return { cwd: commandDir, env };
}
function connectorFor(providerId) { return connectors.get(providerId); }
function emitLog(providerId, chunk) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('cloudflare:log', `[${providerId}] ${actions.safeLog(chunk)}`);
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
async function requireTarget(providerId) { if (!(await targetIds()).includes(providerId)) throw new Error('Provider target is not configured in the selected profile.'); }

ipcMain.handle('cloudflare:contexts', () => ({ contexts: availableContexts, selected: selectedContext }));
ipcMain.handle('cloudflare:targets', allStatuses);
ipcMain.handle('cloudflare:select-context', async (_event, requested) => {
  if ([...connectors.values()].some((child) => child.exitCode === null)) throw new Error('Stop UI-managed connectors before switching profile.');
  availableContexts = profiles.discoverContexts(profileRoot);
  const match = availableContexts.find((item) => item.profileId === requested?.profileId && item.workflow === requested?.workflow);
  if (!match) throw new Error('That profile and workflow do not allow the Cloudflare command.');
  selectedContext = match;
  return { selected: selectedContext, targets: await allStatuses() };
});
ipcMain.handle('cloudflare:start', async (_event, providerId) => {
  await requireTarget(providerId);
  const existing = connectorFor(providerId);
  if (existing && existing.exitCode === null) return targetStatus(providerId);
  const child = spawn(commandPath, ['run-tunnel'], { ...spawnOptions(providerId), stdio: ['ignore', 'pipe', 'pipe'] });
  connectors.set(providerId, child);
  child.stdout.on('data', (chunk) => emitLog(providerId, chunk)); child.stderr.on('data', (chunk) => emitLog(providerId, chunk));
  child.once('error', (error) => emitLog(providerId, error.message)); child.once('exit', (code, signal) => emitLog(providerId, `Connector stopped (${signal || code}).\n`));
  await new Promise((resolve) => setTimeout(resolve, 900));
  return targetStatus(providerId);
});
ipcMain.handle('cloudflare:stop', async (_event, providerId) => {
  const child = connectorFor(providerId);
  if (child && child.exitCode === null) { child.kill('SIGTERM'); await new Promise((resolve) => child.once('exit', resolve)); }
  connectors.delete(providerId); return targetStatus(providerId);
});
ipcMain.handle('cloudflare:open-public-url', async (_event, providerId) => {
  const state = await targetStatus(providerId); if (!state.publicUrl) throw new Error('Public URL unavailable.');
  await shell.openExternal(state.publicUrl); return state.publicUrl;
});

function createWindow() {
  mainWindow = new BrowserWindow({ width: 1080, height: 760, minWidth: 820, minHeight: 600, title: 'Cloudflare Tunnels', backgroundColor: '#0d1117', webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  mainWindow.setMenuBarVisibility(false); mainWindow.setAutoHideMenuBar(true); mainWindow.loadFile(path.join(__dirname, '../panel/index.html'));
  mainWindow.on('close', (event) => {
    if (isQuitting) return;
    event.preventDefault();
    mainWindow.hide();
    if (app.dock) app.dock.hide();
  });
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
app.whenReady().then(() => { createWindow(); createTray(); });
app.on('before-quit', () => { isQuitting = true; for (const child of connectors.values()) if (child.exitCode === null) child.kill('SIGTERM'); });
app.on('window-all-closed', () => {});
app.on('activate', showWindow);
