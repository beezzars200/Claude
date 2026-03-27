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
    const fileUrl = `file://${filePath.replace(/\\/g, '/')}`
    return fileUrl
  })

  // IPC: Read audio file as ArrayBuffer
  ipcMain.handle('audio:readFile', async (_event, filePath: string) => {
    const { readFile } = await import('fs/promises')
    const buffer = await readFile(filePath)
    return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
  })

  // IPC: Read audio file metadata (ID3 tags)
  ipcMain.handle('audio:getMetadata', async (_event, filePath: string) => {
    try {
      const mm = require('music-metadata')
      const metadata = await mm.parseFile(filePath, { skipCovers: false })

      let albumArt: string | null = null
      const pictures = metadata.common.picture
      if (pictures && pictures.length > 0) {
        const pic = pictures[0]
        const mimeType = pic.format.includes('/') ? pic.format : `image/${pic.format}`
        const base64 = Buffer.from(pic.data).toString('base64')
        albumArt = `data:${mimeType};base64,${base64}`
      }

      return {
        title: metadata.common.title ?? null,
        artist: metadata.common.artist ?? null,
        album: metadata.common.album ?? null,
        duration: metadata.format.duration ?? null,
        bpm: metadata.common.bpm ?? null,
        albumArt
      }
    } catch {
      return { title: null, artist: null, album: null, duration: null, bpm: null, albumArt: null }
    }
  })

  // IPC: Get home directory path
  ipcMain.handle('fs:getHomePath', () => app.getPath('home'))

  // IPC: Get Music directory path
  ipcMain.handle('fs:getMusicPath', () => app.getPath('music'))

  // IPC: Read directory contents
  ipcMain.handle('fs:readDir', async (_event, dirPath: string) => {
    const { readdir } = await import('fs/promises')
    const { join } = await import('path')
    try {
      const entries = await readdir(dirPath, { withFileTypes: true })
      const AUDIO_EXTS = new Set(['.mp3', '.wav', '.flac', '.ogg', '.aac', '.m4a', '.aiff'])
      return entries
        .filter(e => !e.name.startsWith('.') && (e.isDirectory() || AUDIO_EXTS.has(require('path').extname(e.name).toLowerCase())))
        .map(e => ({
          name: e.name,
          isDirectory: e.isDirectory(),
          path: join(dirPath, e.name)
        }))
        .sort((a, b) => {
          if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
          return a.name.localeCompare(b.name)
        })
    } catch {
      return []
    }
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
