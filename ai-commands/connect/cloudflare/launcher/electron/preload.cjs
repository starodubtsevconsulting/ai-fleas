const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('cloudflareTunnel', {
  status: () => ipcRenderer.invoke('cloudflare:status'),
  start: () => ipcRenderer.invoke('cloudflare:start'),
  stop: () => ipcRenderer.invoke('cloudflare:stop'),
  openPublicUrl: () => ipcRenderer.invoke('cloudflare:open-public-url'),
  onLog: (listener) => ipcRenderer.on('cloudflare:log', (_event, line) => listener(line))
});
