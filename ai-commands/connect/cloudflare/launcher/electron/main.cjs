const { app, BrowserWindow, ipcMain, shell } = require('electron');
const { spawn } = require('node:child_process');
const path = require('node:path');
const actions = require('./cloudflare-ui-actions.cjs');
const profiles = require('./profile-contexts.cjs');

const commandDir = process.env.CLOUDFLARE_COMMAND_DIR || path.resolve(__dirname, '../..');
const commandPath = path.join(commandDir, 'cloudflare.command.sh');
const profileRoot = path.resolve(commandDir, '../../../ai-profile');
let mainWindow;
let connector;
let publicUrl = '';
let availableContexts = profiles.discoverContexts(profileRoot);
let selectedContext = availableContexts.find((item) => item.profileId === (process.env.AI_WORK_PROFILE_ID || process.env.WORK_PROFILE_ID) && item.workflow === process.env.AI_FLOW_WORKFLOW) || availableContexts[0];

const context = {
  commandPath,
  get connector() { return connector; },
  spawnOptions: () => ({ cwd: commandDir, env: profiles.contextEnv(process.env, selectedContext) })
};

function emitLog(chunk) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('cloudflare:log', actions.safeLog(chunk));
  }
}

async function getStatus() {
  if (!selectedContext) return { configured: false, connectorInstalled: false, connectorManaged: false, connectorDetected: false, connectorCount: 0, connectorConflict: false, accessHealthy: false, publicUrl: '', message: 'No profile workflow allows the Cloudflare command.' };
  const result = await actions.status(context);
  if (result.publicUrl) publicUrl = result.publicUrl;
  return result;
}

ipcMain.handle('cloudflare:status', getStatus);
ipcMain.handle('cloudflare:contexts', () => ({ contexts: availableContexts, selected: selectedContext }));
ipcMain.handle('cloudflare:select-context', async (_event, requested) => {
  if (connector && connector.exitCode === null) throw new Error('Stop the managed connector before switching profile.');
  availableContexts = profiles.discoverContexts(profileRoot);
  const match = availableContexts.find((item) => item.profileId === requested?.profileId && item.workflow === requested?.workflow);
  if (!match) throw new Error('That profile and workflow do not allow the Cloudflare command.');
  selectedContext = match;
  publicUrl = '';
  return { selected: selectedContext, status: await getStatus() };
});
ipcMain.handle('cloudflare:start', async () => {
  if (!selectedContext) throw new Error('Select a profile and workflow first.');
  if (connector && connector.exitCode === null) return getStatus();
  connector = spawn(commandPath, ['run-tunnel'], {
    ...context.spawnOptions(),
    stdio: ['ignore', 'pipe', 'pipe']
  });
  connector.stdout.on('data', emitLog);
  connector.stderr.on('data', emitLog);
  connector.once('error', (error) => emitLog(error.message));
  connector.once('exit', (code, signal) => emitLog(`Connector stopped (${signal || code}).\n`));
  await new Promise((resolve) => setTimeout(resolve, 900));
  return getStatus();
});
ipcMain.handle('cloudflare:stop', async () => {
  if (connector && connector.exitCode === null) {
    connector.kill('SIGTERM');
    await new Promise((resolve) => connector.once('exit', resolve));
  }
  connector = undefined;
  return getStatus();
});
ipcMain.handle('cloudflare:open-public-url', async () => {
  if (!publicUrl) await getStatus();
  if (!publicUrl) throw new Error('Public URL is unavailable until configuration validates.');
  await shell.openExternal(publicUrl);
  return publicUrl;
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 960,
    height: 720,
    minWidth: 760,
    minHeight: 580,
    title: 'Cloudflare Tunnel',
    backgroundColor: '#0d1117',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  mainWindow.setMenuBarVisibility(false);
  mainWindow.setAutoHideMenuBar(true);
  mainWindow.loadFile(path.join(__dirname, '../panel/index.html'));
}

app.whenReady().then(createWindow);
app.on('before-quit', () => {
  if (connector && connector.exitCode === null) connector.kill('SIGTERM');
});
app.on('window-all-closed', () => app.quit());
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
