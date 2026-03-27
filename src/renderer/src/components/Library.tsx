import React, { useState, useEffect } from 'react'
import { useStore, Track } from '../store/useStore'

interface LibraryProps {
  audioEngine: {
    loadTrack: (deck: 'A' | 'B', fileUrl: string, trackName: string) => Promise<void>
    initAudio: () => void
  }
}

interface DirEntry {
  name: string
  isDirectory: boolean
  path: string
}

function formatDuration(seconds?: number): string {
  if (!seconds) return '--:--'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function Library({ audioEngine }: LibraryProps) {
  const { tracks, addTracks, removeTrack, selectedTrackId, setSelectedTrack, deckA, deckB } = useStore()
  const [dragOverDeck, setDragOverDeck] = useState<'A' | 'B' | null>(null)

  // File browser state
  const [currentPath, setCurrentPath] = useState<string>('')
  const [entries, setEntries] = useState<DirEntry[]>([])
  const [history, setHistory] = useState<string[]>([])
  const [browserLoading, setBrowserLoading] = useState(false)
  const [homePath, setHomePath] = useState('')

  // Navigate to a directory
  const navigateTo = async (path: string) => {
    setBrowserLoading(true)
    try {
      const result = await window.api.readDir(path)
      setEntries(result)
      setCurrentPath(path)
    } finally {
      setBrowserLoading(false)
    }
  }

  // On mount: navigate to Music directory and fetch home path
  useEffect(() => {
    const init = async () => {
      try {
        const hp = await window.api.getHomePath()
        setHomePath(hp)
      } catch {
        // ignore
      }
      try {
        const musicPath = await window.api.getMusicPath()
        await navigateTo(musicPath)
      } catch {
        // fallback to home
        try {
          const hp = await window.api.getHomePath()
          await navigateTo(hp)
        } catch {
          // ignore
        }
      }
    }
    init()
  }, [])

  const handleEntryClick = async (entry: DirEntry) => {
    if (entry.isDirectory) {
      setHistory((h) => [...h, currentPath])
      await navigateTo(entry.path)
    } else {
      // Add audio file to library track list
      addFileToLibrary(entry)
    }
  }

  const handleEntryDoubleClick = async (entry: DirEntry) => {
    if (!entry.isDirectory) {
      addFileToLibrary(entry)
      // Load to Deck A (or next available deck)
      const name = entry.name.replace(/\.[^/.]+$/, '')
      const track: Track = {
        id: entry.path,
        name,
        filePath: entry.path,
        fileUrl: entry.path
      }
      audioEngine.initAudio()
      await audioEngine.loadTrack('A', track.fileUrl, track.name)
    }
  }

  const addFileToLibrary = (entry: DirEntry) => {
    const name = entry.name.replace(/\.[^/.]+$/, '')
    const track: Track = {
      id: entry.path,
      name,
      filePath: entry.path,
      fileUrl: entry.path
    }
    addTracks([track])
  }

  const handleBack = async () => {
    if (history.length === 0) return
    const prev = history[history.length - 1]
    setHistory((h) => h.slice(0, -1))
    await navigateTo(prev)
  }

  // Breadcrumb segments
  const pathSegments = currentPath ? currentPath.split('/').filter(Boolean) : []

  const handleBreadcrumbClick = async (index: number) => {
    const targetPath = '/' + pathSegments.slice(0, index + 1).join('/')
    if (targetPath === currentPath) return
    setHistory((h) => [...h, currentPath])
    await navigateTo(targetPath)
  }

  // Track list logic
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
        padding: 10,
        display: 'flex',
        height: '100%',
        gap: 8,
        overflow: 'hidden'
      }}
    >
      {/* Left pane: File browser */}
      <div
        style={{
          flex: '0 0 300px',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          borderRight: '1px solid #2a2a3a',
          paddingRight: 8,
          minHeight: 0,
          overflow: 'hidden'
        }}
      >
        {/* Browser header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <button
            onClick={handleBack}
            disabled={history.length === 0}
            style={{
              background: '#1a1a28',
              border: '1px solid #3a3a5a',
              color: history.length === 0 ? '#333355' : '#8888cc',
              borderRadius: 4,
              padding: '2px 8px',
              fontSize: 12,
              cursor: history.length === 0 ? 'not-allowed' : 'pointer',
              flexShrink: 0
            }}
          >
            ←
          </button>
          <div style={{ fontSize: 9, color: '#6666aa', letterSpacing: '0.1em', flexShrink: 0 }}>FILES</div>
        </div>

        {/* Location shortcuts */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', flexShrink: 0 }}>
          {[
            { label: '🏠', path: homePath, title: 'Home' },
            { label: '🎵', path: `${homePath}/Music`, title: 'Music' },
            { label: '☁️', path: `${homePath}/Library/Mobile Documents/com~apple~CloudDocs`, title: 'iCloud Drive' },
            { label: '⬇️', path: `${homePath}/Downloads`, title: 'Downloads' },
            { label: '🖥️', path: `${homePath}/Desktop`, title: 'Desktop' },
          ].map(({ label, path, title }) => (
            <button
              key={title}
              title={title}
              onClick={() => { if (path) { setHistory(h => [...h, currentPath]); navigateTo(path) } }}
              style={{
                background: '#1a1a28',
                border: '1px solid #3a3a5a',
                color: '#8888cc',
                borderRadius: 4,
                padding: '2px 6px',
                fontSize: 12,
                cursor: 'pointer'
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Breadcrumb */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, flexShrink: 0, overflow: 'hidden' }}>
          {pathSegments.map((seg, i) => (
            <React.Fragment key={i}>
              {i > 0 && <span style={{ color: '#444466', fontSize: 9 }}>/</span>}
              <button
                onClick={() => handleBreadcrumbClick(i)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: i === pathSegments.length - 1 ? '#e0e0f0' : '#7777aa',
                  fontSize: 9,
                  cursor: 'pointer',
                  padding: '1px 2px',
                  borderRadius: 3,
                  maxWidth: 80,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}
              >
                {seg}
              </button>
            </React.Fragment>
          ))}
        </div>

        {/* Directory listing */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 1 }}>
          {browserLoading ? (
            <div style={{ color: '#444466', fontSize: 11, padding: 8 }}>Loading...</div>
          ) : entries.length === 0 ? (
            <div style={{ color: '#333355', fontSize: 11, padding: 8 }}>Empty directory</div>
          ) : (
            entries.map((entry) => (
              <div
                key={entry.path}
                onClick={() => handleEntryClick(entry)}
                onDoubleClick={() => handleEntryDoubleClick(entry)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 6px',
                  borderRadius: 4,
                  cursor: 'pointer',
                  background: 'transparent',
                  transition: 'background 0.1s',
                  userSelect: 'none'
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = '#1e1e2e' }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
              >
                <span style={{ fontSize: 12, flexShrink: 0 }}>
                  {entry.isDirectory ? '📁' : '🎵'}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    color: entry.isDirectory ? '#aaaacc' : '#c0c0e0',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    flex: 1
                  }}
                >
                  {entry.name}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right pane: Track list */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, minHeight: 0, overflow: 'hidden' }}>
        {/* Track list header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ fontSize: 9, color: '#6666aa', letterSpacing: '0.1em' }}>
            LIBRARY ({tracks.length} tracks)
          </div>
        </div>

        {/* Drop targets */}
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
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
                  padding: '4px 6px',
                  background: isDragOver ? `${accent}10` : '#0f0f18',
                  transition: 'all 0.15s',
                  minHeight: 36
                }}
              >
                <div style={{ fontSize: 9, color: accent, fontWeight: 700, letterSpacing: '0.08em', marginBottom: 1 }}>
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
                fontSize: 11,
                textAlign: 'center',
                flexDirection: 'column',
                gap: 4
              }}
            >
              <div style={{ fontSize: 22 }}>🎵</div>
              <div>Browse files on the left or click files to add</div>
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
                    gap: 6,
                    padding: '5px 6px',
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
                        fontSize: 11,
                        color: '#e0e0f0',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {track.name}
                    </div>
                    <div style={{ fontSize: 9, color: '#555577', marginTop: 1 }}>
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
    </div>
  )
}
