import React, { useEffect, useRef } from 'react'
import { useStore } from '../store/useStore'

interface RecorderProps {
  audioEngine: {
    startRecording: () => void
    stopRecording: () => Promise<Blob | null>
    initAudio: () => void
  }
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

export default function Recorder({ audioEngine }: RecorderProps) {
  const { recorder, setRecorder } = useStore()
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (recorder.isRecording) {
      timerRef.current = setInterval(() => {
        setRecorder({ recordingTime: recorder.recordingTime + 1 })
      }, 1000)
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [recorder.isRecording, recorder.recordingTime, setRecorder])

  const handleRecord = () => {
    audioEngine.initAudio()
    audioEngine.startRecording()
  }

  const handleStop = async () => {
    const blob = await audioEngine.stopRecording()
    if (blob) {
      setRecorder({ hasRecording: true, recordingBlob: blob, isRecording: false })
    }
  }

  const handleExport = async () => {
    if (!recorder.recordingBlob) return

    // Try Electron file dialog first
    if (window.api) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
      const defaultName = `recording-${timestamp}.webm`
      const savePath = await window.api.saveRecording(defaultName)
      if (savePath) {
        const arrayBuffer = await recorder.recordingBlob.arrayBuffer()
        const result = await window.api.writeFile(savePath, arrayBuffer)
        if (result.success) {
          alert(`Saved to: ${savePath}`)
          return
        }
      }
    }

    // Fallback: browser download
    const url = URL.createObjectURL(recorder.recordingBlob)
    const a = document.createElement('a')
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    a.href = url
    a.download = `recording-${timestamp}.webm`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleDiscard = () => {
    setRecorder({ hasRecording: false, recordingBlob: null, recordingTime: 0 })
  }

  const fileSizeMB = recorder.recordingBlob
    ? (recorder.recordingBlob.size / (1024 * 1024)).toFixed(2)
    : null

  return (
    <div
      style={{
        background: '#14141e',
        border: '1px solid #2a2a3a',
        borderRadius: 12,
        padding: 14,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        height: '100%'
      }}
    >
      <div style={{ fontSize: 10, color: '#6666aa', letterSpacing: '0.1em' }}>RECORDER</div>

      {/* Timer display */}
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            fontSize: 40,
            fontFamily: 'monospace',
            fontWeight: 700,
            color: recorder.isRecording ? '#ff3366' : '#e0e0f0',
            letterSpacing: 2,
            lineHeight: 1,
            textShadow: recorder.isRecording ? '0 0 20px #ff336660' : 'none',
            transition: 'all 0.3s'
          }}
        >
          {formatTime(recorder.recordingTime)}
        </div>
        {recorder.isRecording && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              marginTop: 8
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#ff3366',
                animation: 'pulse 1s ease-in-out infinite',
                boxShadow: '0 0 8px #ff3366'
              }}
            />
            <span style={{ fontSize: 11, color: '#ff3366', letterSpacing: '0.1em', fontWeight: 700 }}>
              REC
            </span>
          </div>
        )}
      </div>

      {/* Record / Stop buttons */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
        {!recorder.isRecording ? (
          <button
            onClick={handleRecord}
            style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              border: '3px solid #ff3366',
              background: '#1a0a0a',
              color: '#ff3366',
              fontSize: 24,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s'
            }}
            title="Start recording"
          >
            ⏺
          </button>
        ) : (
          <button
            onClick={handleStop}
            style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              border: '3px solid #ff3366',
              background: '#ff3366',
              color: 'white',
              fontSize: 24,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              animation: 'pulse 1s ease-in-out infinite',
              boxShadow: '0 0 20px #ff336680'
            }}
            title="Stop recording"
          >
            ⏹
          </button>
        )}
      </div>

      {/* Recording result */}
      {recorder.hasRecording && recorder.recordingBlob && !recorder.isRecording && (
        <div
          style={{
            background: '#0f0f18',
            border: '1px solid #2a2a3a',
            borderRadius: 8,
            padding: 12,
            display: 'flex',
            flexDirection: 'column',
            gap: 10
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 12, color: '#e0e0f0', fontWeight: 600 }}>Recording ready</div>
              <div style={{ fontSize: 10, color: '#6666aa', marginTop: 2 }}>
                {formatTime(recorder.recordingTime)} · {fileSizeMB} MB · WebM/Opus
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleExport}
              style={{
                flex: 1,
                background: '#0a1a0a',
                border: '1px solid #00ff88',
                color: '#00ff88',
                borderRadius: 6,
                padding: '8px',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                letterSpacing: '0.05em'
              }}
            >
              💾 Export
            </button>
            <button
              onClick={handleDiscard}
              style={{
                background: '#1a0a0a',
                border: '1px solid #ff3366',
                color: '#ff3366',
                borderRadius: 6,
                padding: '8px 12px',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              🗑
            </button>
          </div>
        </div>
      )}

      {/* Info */}
      <div style={{ fontSize: 10, color: '#444460', lineHeight: 1.5, marginTop: 'auto' }}>
        Records the mixed output from both decks. Press record, mix your tracks, then stop and export.
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  )
}
