const { app, BrowserWindow, ipcMain } = require('electron');
const { spawn } = require('node:child_process');
const path = require('node:path');
const { isSafeHost, isSafeUsername, targetsFromConfig } = require('./targets.cjs');

const configPath = process.env.AI_COMMAND_CONFIG_PATH;
const configuredTargets = configPath ? targetsFromConfig(configPath) : [];
const targets = [...configuredTargets, { id: 'direct', label: 'Direct server', host: '', username: process.env.USER || '', preferredClient: 'freerdp', windowsAppCompatible: true, note: 'Enter any reachable RDP server.' }];
let mainWindow;

function findTarget(id) {
  const target = targets.find((item) => item.id === id);
  if (!target) throw new Error('Remote desktop target is not configured in the selected profile.');
  return target;
}

ipcMain.handle('rdp:targets', () => targets);
ipcMain.handle('rdp:windows-app', async () => {
  if (process.platform !== 'darwin') throw new Error('Windows App launching is available on macOS only.');
  const child = spawn('/usr/bin/open', ['-a', 'Windows App'], { detached: true, stdio: 'ignore' });
  child.unref();
  return true;
});
ipcMain.handle('rdp:connect', async (_event, request) => {
  const target = findTarget(request?.targetId);
  if (request?.client === 'windows-app') {
    if (!target.windowsAppCompatible) throw new Error('Windows App is marked incompatible with this target; use FreeRDP.');
    const child = spawn('/usr/bin/open', ['-a', 'Windows App'], { detached: true, stdio: 'ignore' });
    child.unref();
    return true;
  }
  const password = String(request?.password || '');
  const host = String(request?.host || target.host);
  const username = String(request?.username || target.username);
  if (!isSafeHost(host)) throw new Error('Enter a valid hostname or IP address.');
  if (!isSafeUsername(username)) throw new Error('Enter a valid Linux username.');
  if (!password) throw new Error('RDP password is required.');
  const executable = '/opt/homebrew/opt/freerdp/bin/sdl-freerdp';
  const args = [`/v:${host}`, `/u:${username}`, '/cert:tofu', '/from-stdin:force', '/dynamic-resolution'];
  if (request?.display === 'fullscreen') args.push('/f');
  else args.push(`/size:${request?.size === 'large' ? '1920x1200' : '1440x900'}`);
  const child = spawn(executable, args, { detached: true, stdio: ['pipe', 'ignore', 'ignore'] });
  child.stdin.end(`${password}\n`);
  child.unref();
  return true;
});

function createWindow() {
  mainWindow = new BrowserWindow({ width: 880, height: 660, minWidth: 720, minHeight: 560, title: 'Remote Desktop Launcher', backgroundColor: '#0b1020', webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
