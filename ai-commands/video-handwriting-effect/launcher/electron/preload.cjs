const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('handwritingLauncher', {
  initialState: () => ipcRenderer.invoke('launcher:initial-state'),
  chooseTextFile: () => ipcRenderer.invoke('launcher:choose-text-file'),
  chooseOutputPath: (options) => ipcRenderer.invoke('launcher:choose-output-path', options),
  readTextPreview: (targetPath) => ipcRenderer.invoke('launcher:text-preview', targetPath),
  run: (options) => ipcRenderer.invoke('launcher:run', options),
  stop: () => ipcRenderer.invoke('launcher:stop'),
  openPath: (targetPath) => ipcRenderer.invoke('launcher:open-path', targetPath),
  onLog: (callback) => {
    const listener = (_event, entry) => callback(entry);
    ipcRenderer.on('launcher:log', listener);
    return () => ipcRenderer.off('launcher:log', listener);
  },
  onRunning: (callback) => {
    const listener = (_event, running) => callback(Boolean(running));
    ipcRenderer.on('launcher:running', listener);
    return () => ipcRenderer.off('launcher:running', listener);
  },
  onLaunchContext: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('launcher:launch-context', listener);
    return () => ipcRenderer.off('launcher:launch-context', listener);
  }
});
