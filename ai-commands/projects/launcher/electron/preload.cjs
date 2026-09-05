const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('projectCreator', {
  defaults: () => ipcRenderer.invoke('project-creator:defaults'),
  specTemplate: (input) => ipcRenderer.invoke('project-creator:spec-template', input),
  create: (input) => ipcRenderer.invoke('project-creator:create', input)
});
