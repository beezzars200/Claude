/// <reference types="vite/client" />

interface Window {
  api: {
    openAudioFiles: () => Promise<string[]>
    saveRecording: (defaultName: string) => Promise<string | null>
    writeFile: (filePath: string, buffer: ArrayBuffer) => Promise<{ success: boolean; error?: string }>
    getFileUrl: (filePath: string) => Promise<string>
  }
}
