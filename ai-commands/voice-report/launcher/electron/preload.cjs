const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('voiceReportLauncher', {
  initialState: () => ipcRenderer.invoke('voice-report:initial-state'),
  audioStatus: () => ipcRenderer.invoke('voice-report:audio-status'),
  ready: (payload) => ipcRenderer.invoke('voice-report:ready', payload)
});
