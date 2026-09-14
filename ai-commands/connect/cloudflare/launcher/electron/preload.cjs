const { contextBridge, ipcRenderer } = require('electron');
const configuredLogLimit = Number.parseInt(process.env.CLOUDFLARE_UI_LOG_LIMIT || '10000', 10);

contextBridge.exposeInMainWorld('cloudflareTunnel', {
  logLimit: Number.isFinite(configuredLogLimit) && configuredLogLimit > 0 ? Math.min(configuredLogLimit, 1000000) : 10000,
  targets: () => ipcRenderer.invoke('cloudflare:targets'),
  contexts: () => ipcRenderer.invoke('cloudflare:contexts'),
  selectContext: (selection) => ipcRenderer.invoke('cloudflare:select-context', selection),
  start: (providerId) => ipcRenderer.invoke('cloudflare:start', providerId),
  stop: (providerId) => ipcRenderer.invoke('cloudflare:stop', providerId),
  openPublicUrl: (providerId) => ipcRenderer.invoke('cloudflare:open-public-url', providerId),
  onLog: (listener) => ipcRenderer.on('cloudflare:log', (_event, line) => listener(line))
});
