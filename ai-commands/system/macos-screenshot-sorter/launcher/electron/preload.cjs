const { contextBridge, ipcRenderer } = require('electron');
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

// Forward ESC key events from main process to renderer
ipcRenderer.on('escape-key-pressed', () => {
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
});
