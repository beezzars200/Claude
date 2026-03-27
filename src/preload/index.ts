import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs exposed to renderer
const api = {
  openAudioFiles: (): Promise<string[]> => ipcRenderer.invoke('dialog:openAudioFiles'),

  saveRecording: (defaultName: string): Promise<string | null> =>
    ipcRenderer.invoke('dialog:saveRecording', defaultName),

  writeFile: (filePath: string, buffer: ArrayBuffer): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('fs:writeFile', filePath, buffer),

  getFileUrl: (filePath: string): Promise<string> =>
    ipcRenderer.invoke('audio:getFileUrl', filePath),

  readAudioFile: (filePath: string): Promise<ArrayBuffer> =>
    ipcRenderer.invoke('audio:readFile', filePath),

  getHomePath: (): Promise<string> => ipcRenderer.invoke('fs:getHomePath'),
  getMusicPath: (): Promise<string> => ipcRenderer.invoke('fs:getMusicPath'),
  readDir: (dirPath: string): Promise<Array<{ name: string; isDirectory: boolean; path: string }>> =>
    ipcRenderer.invoke('fs:readDir', dirPath)
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore
  window.electron = electronAPI
  // @ts-ignore
  window.api = api
}
