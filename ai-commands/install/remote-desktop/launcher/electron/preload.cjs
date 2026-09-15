const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('remoteDesktop', {
  targets: () => ipcRenderer.invoke('rdp:targets'),
  connect: (request) => ipcRenderer.invoke('rdp:connect', request),
  openWindowsApp: () => ipcRenderer.invoke('rdp:windows-app')
});
