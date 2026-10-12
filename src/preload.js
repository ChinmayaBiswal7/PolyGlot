const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('polyglot', {
  runCode: (code) => ipcRenderer.invoke('run-code', code),
  detectLanguages: (code) => ipcRenderer.invoke('detect-languages', code)
});
