const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('lyricsTimestamp', {
  canBrowse: true,
  defaults: () => ipcRenderer.invoke('lyrics-timestamp:defaults'),
  pickLyrics: (currentPath) => ipcRenderer.invoke('lyrics-timestamp:pick-lyrics', currentPath),
  pickAudio: (currentPath) => ipcRenderer.invoke('lyrics-timestamp:pick-audio', currentPath),
  pickHints: (currentPath) => ipcRenderer.invoke('lyrics-timestamp:pick-hints', currentPath),
  pickDist: (currentPath) => ipcRenderer.invoke('lyrics-timestamp:pick-dist', currentPath),
  loadExisting: (input) => ipcRenderer.invoke('lyrics-timestamp:load-existing', input),
  map: (input) => ipcRenderer.invoke('lyrics-timestamp:map', input),
  save: (input, mapped) => ipcRenderer.invoke('lyrics-timestamp:save', input, mapped),
  audioData: (audioPath) => ipcRenderer.invoke('lyrics-timestamp:audio-data', audioPath),
  audioUrl: (audioPath) => {
    const normalized = String(audioPath || '').replace(/\\/g, '/');
    return `file://${normalized.split('/').map((part, index) => index === 0 ? part : encodeURIComponent(part)).join('/')}`;
  }
});
