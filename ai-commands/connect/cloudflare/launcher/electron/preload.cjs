const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('cloudflareTunnel', {
  targets: () => ipcRenderer.invoke('cloudflare:targets'),
  contexts: () => ipcRenderer.invoke('cloudflare:contexts'),
  selectContext: (selection) => ipcRenderer.invoke('cloudflare:select-context', selection),
  start: (providerId) => ipcRenderer.invoke('cloudflare:start', providerId),
  stop: (providerId) => ipcRenderer.invoke('cloudflare:stop', providerId),
  openPublicUrl: (providerId) => ipcRenderer.invoke('cloudflare:open-public-url', providerId),
  onLog: (listener) => ipcRenderer.on('cloudflare:log', (_event, line) => listener(line))
});
