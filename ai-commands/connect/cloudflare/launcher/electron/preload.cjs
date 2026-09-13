const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('cloudflareTunnel', {
  status: () => ipcRenderer.invoke('cloudflare:status'),
  contexts: () => ipcRenderer.invoke('cloudflare:contexts'),
  selectContext: (selection) => ipcRenderer.invoke('cloudflare:select-context', selection),
  start: () => ipcRenderer.invoke('cloudflare:start'),
  stop: () => ipcRenderer.invoke('cloudflare:stop'),
  openPublicUrl: () => ipcRenderer.invoke('cloudflare:open-public-url'),
  onLog: (listener) => ipcRenderer.on('cloudflare:log', (_event, line) => listener(line))
});
