const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('keepAwake', Object.freeze({
  status: () => ipcRenderer.invoke('awake:status'),
  start: () => ipcRenderer.invoke('awake:start'),
  stop: () => ipcRenderer.invoke('awake:stop'),
}));
