import React, { useState, useEffect, useRef } from 'react'
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

interface Column {
  path: string
  entries: DirEntry[]
  selectedName: string | null
}

function formatDuration(seconds?: number): string {
  if (!seconds) return '--:--'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function Library({ audioEngine }: LibraryProps) {
  const { tracks, addTracks, removeTrack, selectedTrackId, setSelectedTrack } = useStore()

  const [columns, setColumns] = useState<Column[]>([])
  const [showQueue, setShowQueue] = useState(false)
  const [homePath, setHomePath] = useState('')
  const [browserLoading, setBrowserLoading] = useState(false)
  const columnsEndRef = useRef<HTMLDivElement>(null)

  // On mount: load Music path as first column
  useEffect(() => {
    const init = async () => {
      let hp = ''
      try {
        hp = await window.api.getHomePath()
        setHomePath(hp)
      } catch {
        // ignore
      }
      try {
        const musicPath = await window.api.getMusicPath()
        setBrowserLoading(true)
        try {
          const entries = await window.api.readDir(musicPath)
          setColumns([{ path: musicPath, entries, selectedName: null }])
        } finally {
          setBrowserLoading(false)
        }
      } catch {
        // fallback to home
        if (hp) {
          setBrowserLoading(true)
          try {
            const entries = await window.api.readDir(hp)
            setColumns([{ path: hp, entries, selectedName: null }])
          } catch {
            // ignore
          } finally {
            setBrowserLoading(false)
          }
        }
      }
    }
    init()
  }, [])

  // Scroll columns to the right when new column is added
  useEffect(() => {
    if (columnsEndRef.current) {
      columnsEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'end' })
    }
  }, [columns.length])

  const navigateToPath = async (path: string) => {
    setBrowserLoading(true)
    try {
      const entries = await window.api.readDir(path)
      setColumns([{ path, entries, selectedName: null }])
    } finally {
      setBrowserLoading(false)
    }
  }

  const addFileToLibrary = async (entry: DirEntry): Promise<Track> => {
    const nameNoExt = entry.name.replace(/\.[^/.]+$/, '')
    // Check if already in library
    const existing = useStore.getState().tracks.find(t => t.id === entry.path)
    if (existing) return existing

    // Try to read ID3 metadata
    let artist: string | undefined
    let title: string | undefined
    let duration: number | undefined
    try {
      const meta = await window.api.getMetadata(entry.path)
      artist = meta.artist ?? undefined
      title = meta.title ?? undefined
      duration = meta.duration ?? undefined
    } catch { /* ignore */ }

    const displayName = title ? (artist ? `${artist} - ${title}` : title) : nameNoExt
    const track: Track = {
      id: entry.path,
      name: displayName,
      filePath: entry.path,
      fileUrl: entry.path,
      artist,
      title,
      duration
    }
    addTracks([track])
    return track
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

  const handleColumnEntryClick = async (colIdx: number, entry: DirEntry) => {
    if (entry.isDirectory) {
      const newColumns = columns.slice(0, colIdx + 1).map((c, i) =>
        i === colIdx ? { ...c, selectedName: entry.name } : c
      )
      setBrowserLoading(true)
      try {
        const entries = await window.api.readDir(entry.path)
        newColumns.push({ path: entry.path, entries, selectedName: null })
      } finally {
        setBrowserLoading(false)
      }
      setColumns(newColumns)
    } else {
      setColumns(cols => cols.map((c, i) =>
        i === colIdx ? { ...c, selectedName: entry.name } : c
      ))
    }
  }

  const handleColumnEntryDoubleClick = async (entry: DirEntry) => {
    if (!entry.isDirectory) {
      const track = await addFileToLibrary(entry)
      audioEngine.initAudio()
      // Load to next available deck (A if no track, else B)
      const deckATrack = useStore.getState().deckA.track
      const targetDeck: 'A' | 'B' = deckATrack ? 'B' : 'A'
      await audioEngine.loadTrack(targetDeck, track.fileUrl, track.name)
    }
  }

  const handleDragStart = (e: React.DragEvent, entry: DirEntry) => {
    if (entry.isDirectory) return
    e.dataTransfer.setData('trackId', entry.path)
    e.dataTransfer.setData('trackName', entry.name.replace(/\.[^/.]+$/, ''))
  }

  const handleTrackDragStart = (e: React.DragEvent, track: Track) => {
    e.dataTransfer.setData('trackId', track.id)
    setSelectedTrack(track.id)
  }

  const shortcuts = [
    { label: '🏠', path: homePath, title: 'Home' },
    { label: '🎵', path: `${homePath}/Music`, title: 'Music' },
    { label: '☁️', path: `${homePath}/Library/Mobile Documents/com~apple~CloudDocs`, title: 'iCloud Drive' },
    { label: '⬇️', path: `${homePath}/Downloads`, title: 'Downloads' },
    { label: '🖥️', path: `${homePath}/Desktop`, title: 'Desktop' },
  ]

  return (
    <div
      style={{
        background: '#14141e',
        border: '1px solid #2a2a3a',
        borderRadius: 12,
        padding: '8px 10px',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
        gap: 6
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <div style={{ fontSize: 9, color: '#6666aa', letterSpacing: '0.1em', fontWeight: 700, flexShrink: 0 }}>FILES</div>
        {/* Location shortcuts */}
        <div style={{ display: 'flex', gap: 4 }}>
          {shortcuts.map(s => (
            <button
              key={s.title}
              title={s.title}
              onClick={() => { if (s.path) navigateToPath(s.path) }}
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
              {s.label}
            </button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        {/* Queue toggle */}
        <button
          onClick={() => setShowQueue(q => !q)}
          style={{
            background: showQueue ? '#22223a' : 'transparent',
            border: '1px solid #3a3a5a',
            color: showQueue ? '#00ff88' : '#6666aa',
            borderRadius: 4,
            padding: '3px 10px',
            fontSize: 11,
            cursor: 'pointer',
            fontWeight: showQueue ? 700 : 400
          }}
        >
          Queue
        </button>
      </div>

      {/* Content area: columns + optional queue pane */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden', gap: 0 }}>
        {/* Column browser */}
        <div style={{ display: 'flex', flex: 1, overflowX: 'auto', minHeight: 0 }}>
          {browserLoading && columns.length === 0 ? (
            <div style={{ color: '#444466', fontSize: 11, padding: 8, alignSelf: 'flex-start' }}>Loading...</div>
          ) : columns.length === 0 ? (
            <div style={{ color: '#333355', fontSize: 11, padding: 8, alignSelf: 'flex-start' }}>No files loaded</div>
          ) : (
            columns.map((col, colIdx) => (
              <div
                key={col.path}
                style={{
                  flex: 1,
                  minWidth: 180,
                  borderRight: '1px solid #2a2a3a',
                  overflowY: 'auto',
                  overflowX: 'hidden',
                  display: 'flex',
                  flexDirection: 'column'
                }}
              >
                {browserLoading && colIdx === columns.length - 1 ? (
                  <div style={{ color: '#444466', fontSize: 11, padding: 8 }}>Loading...</div>
                ) : col.entries.length === 0 ? (
                  <div style={{ color: '#333355', fontSize: 11, padding: 8 }}>Empty</div>
                ) : (
                  col.entries.map(entry => (
                    <div
                      key={entry.path}
                      onClick={() => handleColumnEntryClick(colIdx, entry)}
                      onDoubleClick={() => handleColumnEntryDoubleClick(entry)}
                      draggable={!entry.isDirectory}
                      onDragStart={(e) => handleDragStart(e, entry)}
                      style={{
                        padding: '10px 12px',
                        cursor: 'pointer',
                        background: col.selectedName === entry.name ? '#22223a' : 'transparent',
                        borderBottom: '1px solid #1a1a28',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        fontSize: 13,
                        color: entry.isDirectory ? '#aaaacc' : '#e0e0f0',
                        userSelect: 'none',
                        minHeight: 36
                      }}
                      onMouseEnter={(e) => {
                        if (col.selectedName !== entry.name) {
                          (e.currentTarget as HTMLDivElement).style.background = '#1a1a2a'
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (col.selectedName !== entry.name) {
                          (e.currentTarget as HTMLDivElement).style.background = 'transparent'
                        }
                      }}
                    >
                      <span style={{ fontSize: 11, flexShrink: 0 }}>
                        {entry.isDirectory ? '📁' : '🎵'}
                      </span>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                        {entry.name}
                      </span>
                      {entry.isDirectory && (
                        <span style={{ marginLeft: 'auto', color: '#444466', fontSize: 10, flexShrink: 0 }}>›</span>
                      )}
                    </div>
                  ))
                )}
              </div>
            ))
          )}
          <div ref={columnsEndRef} style={{ flexShrink: 0, width: 1 }} />
        </div>

        {/* Queue pane */}
        {showQueue && (
          <div
            style={{
              flex: '0 0 220px',
              borderLeft: '1px solid #2a2a3a',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}
          >
            <div style={{ padding: '6px 10px', fontSize: 9, color: '#6666aa', letterSpacing: '0.1em', fontWeight: 700, flexShrink: 0, borderBottom: '1px solid #1a1a28' }}>
              LIBRARY ({tracks.length})
            </div>
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
              {tracks.length === 0 ? (
                <div style={{ padding: 10, fontSize: 11, color: '#333355', textAlign: 'center' }}>
                  No tracks yet
                </div>
              ) : (
                tracks.map((track) => {
                  const isSelected = track.id === selectedTrackId
                  return (
                    <div
                      key={track.id}
                      draggable
                      onDragStart={(e) => handleTrackDragStart(e, track)}
                      onClick={() => setSelectedTrack(track.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '8px 10px',
                        borderBottom: '1px solid #1a1a28',
                        background: isSelected ? '#1e1e2e' : 'transparent',
                        cursor: 'grab',
                        minHeight: 36
                      }}
                    >
                      <div style={{ flex: 1, overflow: 'hidden' }}>
                        <div style={{ fontSize: 12, color: '#e0e0f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {track.title ?? track.name}
                        </div>
                        {track.artist && (
                          <div style={{ fontSize: 10, color: '#8888aa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>
                            {track.artist}
                          </div>
                        )}
                        <div style={{ fontSize: 9, color: '#555577', marginTop: 1 }}>
                          {formatDuration(track.duration)}
                        </div>
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
                            padding: '2px 5px',
                            fontSize: 9,
                            fontWeight: 700,
                            cursor: 'pointer'
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
                            padding: '2px 5px',
                            fontSize: 9,
                            fontWeight: 700,
                            cursor: 'pointer'
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
                            padding: '2px 5px',
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
        )}
      </div>
    </div>
  )
}
