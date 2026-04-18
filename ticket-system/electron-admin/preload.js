const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  openCsv: () => ipcRenderer.invoke('open-csv'),
  openImage: () => ipcRenderer.invoke('open-image'),
  generateTickets: (data) => ipcRenderer.invoke('generate-tickets', data)
});
