/// <reference types="vite/client" />

interface Window {
  api: {
    openFolder: () => Promise<string | null>
    openAudioFiles: () => Promise<string[]>
    saveRecording: (defaultName: string) => Promise<string | null>
    writeFile: (filePath: string, buffer: ArrayBuffer) => Promise<{ success: boolean; error?: string }>
    getFileUrl: (filePath: string) => Promise<string>
    readAudioFile: (filePath: string) => Promise<ArrayBuffer>
    getHomePath: () => Promise<string>
    getMusicPath: () => Promise<string>
    readDir: (dirPath: string) => Promise<Array<{ name: string; isDirectory: boolean; path: string }>>
    getMetadata: (filePath: string) => Promise<{ title: string | null; artist: string | null; album: string | null; duration: number | null; bpm: number | null; albumArt: string | null }>
  }
}
