const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { AwakeController } = require('./controller.cjs');
app.setName('Keep Awake');
// The preserved Electron executable name makes app.isPackaged false even in our
// standalone bundle. The packager writes this exact app-owned package marker.
const standalonePreview = require('../package.json').name === 'keep-awake';
app.setPath('userData', path.join(app.getPath('appData'), standalonePreview ? 'Keep Awake Preview' : 'AI Fleas Keep Awake'));
const rendererPath = path.join(__dirname, '../dist/index.html');
const rendererUrl = pathToFileURL(rendererPath).href;
let window, quitting = false, quitRequested = false;
const controller = new AwakeController({ confirmStart: async () => {
  const result = await dialog.showMessageBox(window, { type: 'warning', title: 'Keep this Mac awake?',
    message: 'An awake Mac may be accessible to people nearby.',
    detail: 'Supervise this Mac. This creates temporary power assertions, needs no password and changes no permanent settings. Stop or close this window to release them. Manual lock, lid closure, reboot and managed policy can still interrupt work. User activity is asserted briefly; system sleep prevention applies on AC power.',
    buttons: ['Cancel', 'Keep awake'], defaultId: 0, cancelId: 0, noLink: true });
  return result.response === 1 && !quitRequested;
} });
function trusted(event) {
  if (!window || window.isDestroyed() || event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame || event.senderFrame.url !== rendererUrl) throw new Error('UNTRUSTED_REQUEST');
}
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (window && !window.isDestroyed()) { if (window.isMinimized()) window.restore(); window.focus(); } });
  app.whenReady().then(() => {
    if (process.platform !== 'darwin') { dialog.showErrorBox('macOS required', 'Keep Awake runs only on macOS.'); quitting = true; app.quit(); return; }
    window = new BrowserWindow({ width: 560, height: 660, minWidth: 440, minHeight: 590, title: 'Keep Awake', backgroundColor: '#f5f4ef',
      webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, sandbox: true, nodeIntegration: false } });
    window.setMenuBarVisibility(false);
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    window.webContents.on('will-navigate', event => event.preventDefault());
    window.webContents.on('will-redirect', event => event.preventDefault());
    ipcMain.handle('awake:status', event => { trusted(event); return controller.status(); });
    ipcMain.handle('awake:start', event => { trusted(event); if (quitRequested) return controller.status(); return controller.start(); });
    ipcMain.handle('awake:stop', event => { trusted(event); return controller.stop(); });
    window.on('close', event => { if (!quitting) { event.preventDefault(); app.quit(); } });
    window.loadFile(rendererPath);
  });
  app.on('before-quit', event => {
    if (quitting) return;
    event.preventDefault(); if (quitRequested) return; quitRequested = true;
    controller.stop().then(status => {
      if (status.phase === 'inactive') { quitting = true; app.quit(); }
      else { quitRequested = false; dialog.showErrorBox('Stop not confirmed', 'Keep this window open and try Stop again before quitting.'); }
    });
  });
}
