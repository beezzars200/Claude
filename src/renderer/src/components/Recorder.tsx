import React, { useEffect, useRef, useState } from 'react'
import { useStore } from '../store/useStore'

interface RecorderProps {
  audioEngine: {
    startRecording: () => void
    stopRecording: () => Promise<Blob | null>
    initAudio: () => void
  }
}

function formatRecordingTime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function Recorder({ audioEngine }: RecorderProps) {
  const { recorder, setRecorder } = useStore()
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [exportStatus, setExportStatus] = useState<'idle' | 'exporting' | 'done' | 'error'>('idle')

  // Timer tick
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
    if (recorder.isRecording) return
    audioEngine.initAudio()
    setRecorder({ recordingTime: 0, hasRecording: false, recordingBlob: null })
    setExportStatus('idle')
    audioEngine.startRecording()
  }

  const handleStop = async () => {
    if (!recorder.isRecording) return
    await audioEngine.stopRecording()
  }

  const handleExport = async () => {
    if (!recorder.recordingBlob) return
    setExportStatus('exporting')

    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
      const defaultName = `radio-recording-${timestamp}.wav`

      if (window.api) {
        // Convert webm blob to arraybuffer and save via Electron
        const arrayBuffer = await recorder.recordingBlob.arrayBuffer()
        const filePath = await window.api.saveRecording(defaultName)

        if (filePath) {
          const result = await window.api.writeFile(filePath, arrayBuffer)
          if (result.success) {
            setExportStatus('done')
            setTimeout(() => setExportStatus('idle'), 3000)
          } else {
            throw new Error(result.error || 'Write failed')
          }
        } else {
          setExportStatus('idle') // User cancelled
        }
      } else {
        // Fallback: browser download
        const url = URL.createObjectURL(recorder.recordingBlob)
        const a = document.createElement('a')
        a.href = url
        a.download = defaultName
        a.click()
        URL.revokeObjectURL(url)
        setExportStatus('done')
        setTimeout(() => setExportStatus('idle'), 3000)
      }
    } catch (err) {
      console.error('Export failed:', err)
      setExportStatus('error')
      setTimeout(() => setExportStatus('idle'), 3000)
    }
  }

  const blobSizeMB = recorder.recordingBlob
    ? (recorder.recordingBlob.size / (1024 * 1024)).toFixed(1)
    : '0'

  return (
    <div
      style={{
        background: '#14141e',
        border: '1px solid #2a2a3a',
        borderRadius: 12,
        padding: 14,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        height: '100%',
        overflow: 'hidden'
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 10, color: '#6666aa', letterSpacing: '0.1em' }}>
          RECORDER
        </div>
        {recorder.isRecording && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#ff4444',
                boxShadow: '0 0 8px #ff4444',
                animation: 'pulse 1s ease-in-out infinite'
              }}
            />
            <span style={{ fontSize: 10, color: '#ff4444', fontWeight: 700, letterSpacing: '0.08em' }}>
              REC
            </span>
          </div>
        )}
      </div>

      {/* Timer display */}
      <div
        style={{
          background: '#0a0a12',
          border: `1px solid ${recorder.isRecording ? '#ff444440' : '#1e1e2e'}`,
          borderRadius: 10,
          padding: '16px 12px',
          textAlign: 'center',
          boxShadow: recorder.isRecording ? '0 0 20px #ff444420' : 'none',
          transition: 'all 0.3s'
        }}
      >
        <div
          style={{
            fontSize: 36,
            fontFamily: 'monospace',
            fontWeight: 700,
            color: recorder.isRecording ? '#ff4444' : '#6666aa',
            letterSpacing: '0.05em',
            transition: 'color 0.3s'
          }}
        >
          {formatRecordingTime(recorder.recordingTime)}
        </div>
        <div style={{ fontSize: 10, color: '#444466', marginTop: 4, letterSpacing: '0.1em' }}>
          {recorder.isRecording ? 'RECORDING IN PROGRESS' : recorder.hasRecording ? 'RECORDING COMPLETE' : 'READY TO RECORD'}
        </div>
      </div>

      {/* Level indicator (visual feedback) */}
      <div style={{ display: 'flex', gap: 2, height: 24, alignItems: 'flex-end' }}>
        {Array.from({ length: 20 }, (_, i) => {
          const isLit = recorder.isRecording && Math.random() > (i / 20) * 0.7
          const isRed = i >= 17
          const isYellow = i >= 14 && i < 17
          return (
            <div
              key={i}
              style={{
                flex: 1,
                height: `${30 + i * 3.5}%`,
                borderRadius: 1,
                background: isLit
                  ? isRed ? '#ff3366' : isYellow ? '#ffcc00' : '#ff4444'
                  : '#1e1e2a',
                transition: 'background 0.05s'
              }}
            />
          )
        })}
      </div>

      {/* Transport controls */}
      <div style={{ display: 'flex', gap: 8 }}>
        {/* Record button */}
        <button
          onClick={handleRecord}
          disabled={recorder.isRecording}
          style={{
            flex: 1,
            padding: '12px 0',
            borderRadius: 8,
            border: `2px solid ${recorder.isRecording ? '#ff444460' : '#ff4444'}`,
            background: recorder.isRecording ? '#ff444410' : '#ff444420',
            color: '#ff4444',
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: '0.08em',
            cursor: recorder.isRecording ? 'not-allowed' : 'pointer',
            opacity: recorder.isRecording ? 0.5 : 1,
            transition: 'all 0.15s'
          }}
        >
          ⏺ RECORD
        </button>

        {/* Stop button */}
        <button
          onClick={handleStop}
          disabled={!recorder.isRecording}
          style={{
            flex: 1,
            padding: '12px 0',
            borderRadius: 8,
            border: `2px solid ${recorder.isRecording ? '#e0e0f0' : '#3a3a5a'}`,
            background: recorder.isRecording ? '#e0e0f020' : 'transparent',
            color: recorder.isRecording ? '#e0e0f0' : '#5a5a7a',
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: '0.08em',
            cursor: recorder.isRecording ? 'pointer' : 'not-allowed',
            transition: 'all 0.15s'
          }}
        >
          ⏹ STOP
        </button>
      </div>

      {/* Recording info */}
      {recorder.hasRecording && (
        <div
          style={{
            background: '#0f1a0f',
            border: '1px solid #1a3a1a',
            borderRadius: 8,
            padding: '8px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: 6
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: '#00ff88', fontWeight: 600 }}>
              Recording Ready
            </span>
            <span style={{ fontSize: 10, color: '#8888aa', fontFamily: 'monospace' }}>
              {blobSizeMB} MB
            </span>
          </div>
          <div style={{ fontSize: 10, color: '#6666aa' }}>
            Duration: {formatRecordingTime(recorder.recordingTime)}
          </div>
        </div>
      )}

      {/* Export button */}
      <button
        onClick={handleExport}
        disabled={!recorder.hasRecording || exportStatus === 'exporting' || recorder.isRecording}
        style={{
          padding: '10px 0',
          borderRadius: 8,
          border: `1px solid ${
            exportStatus === 'done' ? '#00ff88' :
            exportStatus === 'error' ? '#ff4444' :
            recorder.hasRecording && !recorder.isRecording ? '#0088ff' : '#2a2a3a'
          }`,
          background:
            exportStatus === 'done' ? '#00ff8810' :
            exportStatus === 'error' ? '#ff444410' :
            recorder.hasRecording && !recorder.isRecording ? '#0088ff15' : 'transparent',
          color:
            exportStatus === 'done' ? '#00ff88' :
            exportStatus === 'error' ? '#ff4444' :
            recorder.hasRecording && !recorder.isRecording ? '#0088ff' : '#3a3a5a',
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: '0.08em',
          cursor: (recorder.hasRecording && !recorder.isRecording && exportStatus !== 'exporting') ? 'pointer' : 'not-allowed',
          transition: 'all 0.2s'
        }}
      >
        {exportStatus === 'exporting' ? '⟳ SAVING...' :
         exportStatus === 'done' ? '✓ SAVED!' :
         exportStatus === 'error' ? '✗ EXPORT FAILED' :
         '⬇ EXPORT AS WAV'}
      </button>

      {/* Info */}
      <div
        style={{
          fontSize: 10,
          color: '#333355',
          textAlign: 'center',
          lineHeight: 1.5,
          paddingTop: 4,
          borderTop: '1px solid #1e1e2e'
        }}
      >
        Records the mixed audio output.
        <br />
        Press Record, mix your tracks, then Stop and Export.
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  )
}
