import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { writeFile } from 'fs/promises'

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 800,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#0f0f14',
    titleBarStyle: 'default',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      webSecurity: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.radiostudio')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC: Open audio files dialog
  ipcMain.handle('dialog:openAudioFiles', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Select Audio Files',
      filters: [
        {
          name: 'Audio Files',
          extensions: ['mp3', 'wav', 'flac', 'ogg', 'aac', 'm4a']
        }
      ],
      properties: ['openFile', 'multiSelections']
    })
    if (result.canceled) return []
    return result.filePaths
  })

  // IPC: Save recording
  ipcMain.handle('dialog:saveRecording', async (_event, defaultName: string) => {
    const result = await dialog.showSaveDialog({
      title: 'Save Recording',
      defaultPath: defaultName,
      filters: [{ name: 'WAV Audio', extensions: ['wav'] }]
    })
    if (result.canceled || !result.filePath) return null
    return result.filePath
  })

  // IPC: Write file buffer
  ipcMain.handle('fs:writeFile', async (_event, filePath: string, buffer: ArrayBuffer) => {
    try {
      await writeFile(filePath, Buffer.from(buffer))
      return { success: true }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  // IPC: Get file URL for playback
  ipcMain.handle('audio:getFileUrl', (_event, filePath: string) => {
    // Convert file path to file:// URL
    const fileUrl = `file://${filePath.replace(/\\/g, '/')}`
    return fileUrl
  })

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
