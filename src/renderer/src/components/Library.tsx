import React, { useState } from 'react'
import { useStore, Track } from '../store/useStore'

interface LibraryProps {
  audioEngine: {
    loadTrack: (deck: 'A' | 'B', fileUrl: string, trackName: string) => Promise<void>
    initAudio: () => void
  }
}

function formatDuration(seconds?: number): string {
  if (!seconds) return '--:--'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function Library({ audioEngine }: LibraryProps) {
  const { tracks, addTracks, removeTrack, selectedTrackId, setSelectedTrack, deckA, deckB } = useStore()
  const [loading, setLoading] = useState(false)
  const [dragOverDeck, setDragOverDeck] = useState<'A' | 'B' | null>(null)

  const openFiles = async () => {
    if (!window.api) return
    setLoading(true)
    try {
      const filePaths = await window.api.openAudioFiles()
      if (filePaths.length === 0) return

      const newTracks: Track[] = filePaths.map((fp) => {
        const name = fp.split('/').pop()?.split('\\').pop() ?? fp
        const nameNoExt = name.replace(/\.[^/.]+$/, '')
        return {
          id: fp,
          name: nameNoExt,
          filePath: fp,
          fileUrl: fp  // pass raw path; audio engine reads via IPC
        }
      })

      addTracks(newTracks)
    } finally {
      setLoading(false)
    }
  }

  const loadToDeck = async (track: Track, deck: 'A' | 'B') => {
    audioEngine.initAudio()
    const setter = deck === 'A'
      ? useStore.getState().setDeckA
      : useStore.getState().setDeckB

    setter({ track, isLoaded: false })
    await audioEngine.loadTrack(deck, track.fileUrl, track.name)
    setter({ track })
  }

  const handleDragStart = (e: React.DragEvent, track: Track) => {
    e.dataTransfer.setData('trackId', track.id)
    setSelectedTrack(track.id)
  }

  const handleDrop = async (e: React.DragEvent, deck: 'A' | 'B') => {
    e.preventDefault()
    setDragOverDeck(null)
    const trackId = e.dataTransfer.getData('trackId')
    const track = tracks.find((t) => t.id === trackId)
    if (track) await loadToDeck(track, deck)
  }

  const handleDragOver = (e: React.DragEvent, deck: 'A' | 'B') => {
    e.preventDefault()
    setDragOverDeck(deck)
  }

  return (
    <div
      style={{
        background: '#14141e',
        border: '1px solid #2a2a3a',
        borderRadius: 12,
        padding: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        height: '100%',
        overflow: 'hidden'
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 10, color: '#6666aa', letterSpacing: '0.1em' }}>
          LIBRARY ({tracks.length} tracks)
        </div>
        <button
          onClick={openFiles}
          disabled={loading}
          style={{
            background: '#1a2a1a',
            border: '1px solid #00ff88',
            color: '#00ff88',
            borderRadius: 6,
            padding: '4px 10px',
            fontSize: 11,
            fontWeight: 600,
            cursor: loading ? 'wait' : 'pointer',
            letterSpacing: '0.05em',
            opacity: loading ? 0.6 : 1
          }}
        >
          {loading ? 'Loading...' : '+ Add Files'}
        </button>
      </div>

      {/* Drop targets */}
      <div style={{ display: 'flex', gap: 6 }}>
        {(['A', 'B'] as const).map((deck) => {
          const deckState = deck === 'A' ? deckA : deckB
          const accent = deck === 'A' ? '#00ff88' : '#0088ff'
          const isDragOver = dragOverDeck === deck
          return (
            <div
              key={deck}
              onDrop={(e) => handleDrop(e, deck)}
              onDragOver={(e) => handleDragOver(e, deck)}
              onDragLeave={() => setDragOverDeck(null)}
              style={{
                flex: 1,
                border: `1px dashed ${isDragOver ? accent : '#3a3a5a'}`,
                borderRadius: 6,
                padding: '6px 8px',
                background: isDragOver ? `${accent}10` : '#0f0f18',
                transition: 'all 0.15s',
                minHeight: 44
              }}
            >
              <div style={{ fontSize: 9, color: accent, fontWeight: 700, letterSpacing: '0.08em', marginBottom: 2 }}>
                DECK {deck}
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: deckState.track ? '#e0e0f0' : '#444460',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}
              >
                {deckState.track?.name ?? 'Drop track here'}
              </div>
            </div>
          )
        })}
      </div>

      {/* Track list */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {tracks.length === 0 ? (
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#333355',
              fontSize: 12,
              textAlign: 'center',
              flexDirection: 'column',
              gap: 6
            }}
          >
            <div style={{ fontSize: 28 }}>🎵</div>
            <div>Click "+ Add Files" to load audio</div>
          </div>
        ) : (
          tracks.map((track) => {
            const isSelected = track.id === selectedTrackId
            const isOnDeckA = deckA.track?.id === track.id
            const isOnDeckB = deckB.track?.id === track.id

            return (
              <div
                key={track.id}
                draggable
                onDragStart={(e) => handleDragStart(e, track)}
                onClick={() => setSelectedTrack(track.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 8px',
                  borderRadius: 6,
                  background: isSelected ? '#1e1e2e' : 'transparent',
                  border: `1px solid ${isSelected ? '#3a3a5a' : 'transparent'}`,
                  cursor: 'grab',
                  transition: 'all 0.1s'
                }}
              >
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div
                    style={{
                      fontSize: 12,
                      color: '#e0e0f0',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {track.name}
                  </div>
                  <div style={{ fontSize: 10, color: '#555577', marginTop: 2 }}>
                    {formatDuration(track.duration)}
                  </div>
                </div>

                {/* Deck indicators */}
                <div style={{ display: 'flex', gap: 3 }}>
                  {isOnDeckA && (
                    <div style={{ fontSize: 9, color: '#00ff88', background: '#00ff8820', borderRadius: 3, padding: '1px 4px', fontWeight: 700 }}>
                      A
                    </div>
                  )}
                  {isOnDeckB && (
                    <div style={{ fontSize: 9, color: '#0088ff', background: '#0088ff20', borderRadius: 3, padding: '1px 4px', fontWeight: 700 }}>
                      B
                    </div>
                  )}
                </div>

                {/* Load buttons */}
                <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); loadToDeck(track, 'A') }}
                    style={{
                      background: '#0a1a0f',
                      border: '1px solid #00ff88',
                      color: '#00ff88',
                      borderRadius: 4,
                      padding: '2px 6px',
                      fontSize: 9,
                      fontWeight: 700,
                      cursor: 'pointer',
                      letterSpacing: '0.05em'
                    }}
                  >
                    A
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); loadToDeck(track, 'B') }}
                    style={{
                      background: '#0a0f1a',
                      border: '1px solid #0088ff',
                      color: '#0088ff',
                      borderRadius: 4,
                      padding: '2px 6px',
                      fontSize: 9,
                      fontWeight: 700,
                      cursor: 'pointer',
                      letterSpacing: '0.05em'
                    }}
                  >
                    B
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeTrack(track.id) }}
                    style={{
                      background: 'transparent',
                      border: '1px solid #3a3a5a',
                      color: '#6666aa',
                      borderRadius: 4,
                      padding: '2px 6px',
                      fontSize: 11,
                      cursor: 'pointer'
                    }}
                  >
                    ×
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
