const { contextBridge, ipcRenderer } = require('electron');
const fs = require('node:fs');

console.error('[PRELOAD] Exposing screenshotSorter API');

contextBridge.exposeInMainWorld('screenshotSorter', {
  settings: () => ipcRenderer.invoke('sorter:settings'),
  chooseFolder: (current) => ipcRenderer.invoke('sorter:choose-folder', current),
  save: (settings) => ipcRenderer.invoke('sorter:save', settings),
  status: () => ipcRenderer.invoke('sorter:status'),
  library: () => ipcRenderer.invoke('sorter:library'),
  thumbnail: (id) => ipcRenderer.invoke('sorter:thumbnail', id),
  fullImage: (id) => ipcRenderer.invoke('sorter:full-image', id),
  openFolder: (folderPath) => ipcRenderer.invoke('sorter:open-folder', folderPath)
});

console.error('[PRELOAD] Setting up ESC key listener');

// Forward ESC key events from main process to renderer
ipcRenderer.on('escape-key-pressed', () => {
  const now = new Date().toISOString();
  console.error('[PRELOAD] Received escape-key-pressed event at ' + now);
  fs.appendFileSync('/tmp/screenshot-sorter-esc.log', `[PRELOAD] Received escape-key-pressed event at ${now}\n`);
  // Dispatch a proper KeyboardEvent that Angular can catch
  const event = new KeyboardEvent('keydown', { 
    key: 'Escape',
    code: 'Escape',
    which: 27,
    keyCode: 27
  });
  window.dispatchEvent(event);
});
