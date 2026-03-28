import React, { useState, useEffect, useCallback } from 'react'
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

const LINKED_FOLDERS_KEY = 'radio-studio-linked-folders'

function formatDuration(seconds?: number): string {
  if (!seconds) return ''
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

// ----- Audio file row -----

function AudioRow({ entry, onDragStart, onLoadDeck }: {
  entry: DirEntry
  onDragStart: (e: React.DragEvent, entry: DirEntry) => void
  onLoadDeck: (entry: DirEntry, deck: 'A' | 'B') => void
}) {
  const nameNoExt = entry.name.replace(/\.[^/.]+$/, '')
  const [hover, setHover] = useState(false)

  return (
    <div
      draggable
      onDragStart={e => onDragStart(e, entry)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '7px 12px',
        borderBottom: '1px solid #1a1a28',
        cursor: 'grab', userSelect: 'none',
        background: hover ? '#1a1a2a' : 'transparent'
      }}
    >
      <span style={{ fontSize: 10, color: '#444466', flexShrink: 0 }}>♪</span>
      <div style={{ flex: 1, overflow: 'hidden', minWidth: 0 }}>
        <div style={{ fontSize: 13, color: '#e0e0f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {nameNoExt}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 3, flexShrink: 0, opacity: hover ? 1 : 0.6, transition: 'opacity 0.1s' }}>
        <button
          onClick={e => { e.stopPropagation(); onLoadDeck(entry, 'A') }}
          style={{ background: '#0a1a0f', border: '1px solid #00ff88', color: '#00ff88', borderRadius: 4, padding: '2px 6px', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}
        >A</button>
        <button
          onClick={e => { e.stopPropagation(); onLoadDeck(entry, 'B') }}
          style={{ background: '#0a0f1a', border: '1px solid #0088ff', color: '#0088ff', borderRadius: 4, padding: '2px 6px', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}
        >B</button>
      </div>
    </div>
  )
}

// ----- Main Library component -----

export default function Library({ audioEngine }: LibraryProps) {
  const { addTracks } = useStore()

  // Linked folders — persisted to localStorage
  const [linkedFolders, setLinkedFolders] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(LINKED_FOLDERS_KEY) ?? '[]') } catch { return [] }
  })

  const [selectedFolder, setSelectedFolder] = useState<string | null>(null)
  const [currentPath, setCurrentPath] = useState<string | null>(null)
  const [entries, setEntries] = useState<DirEntry[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    localStorage.setItem(LINKED_FOLDERS_KEY, JSON.stringify(linkedFolders))
  }, [linkedFolders])

  useEffect(() => {
    if (!currentPath) { setEntries([]); return }
    setLoading(true)
    window.api.readDir(currentPath)
      .then(setEntries)
      .catch(() => setEntries([]))
      .finally(() => setLoading(false))
  }, [currentPath])

  const linkFolder = async () => {
    const folderPath = await window.api.openFolder()
    if (!folderPath) return
    if (!linkedFolders.includes(folderPath)) {
      setLinkedFolders(prev => [...prev, folderPath])
    }
    setSelectedFolder(folderPath)
    setCurrentPath(folderPath)
  }

  const selectFolder = (folderPath: string) => {
    setSelectedFolder(folderPath)
    setCurrentPath(folderPath)
  }

  const unlinkFolder = (folderPath: string) => {
    setLinkedFolders(prev => prev.filter(f => f !== folderPath))
    if (selectedFolder === folderPath) {
      setSelectedFolder(null)
      setCurrentPath(null)
    }
  }

  const loadToDeck = useCallback(async (entry: DirEntry, deck: 'A' | 'B') => {
    const nameNoExt = entry.name.replace(/\.[^/.]+$/, '')
    let track: Track | undefined = useStore.getState().tracks.find(t => t.id === entry.path)
    if (!track) {
      let artist: string | undefined, title: string | undefined, duration: number | undefined
      try {
        const meta = await window.api.getMetadata(entry.path)
        artist = meta.artist ?? undefined
        title = meta.title ?? undefined
        duration = meta.duration ?? undefined
      } catch {}
      const displayName = title ? (artist ? `${artist} - ${title}` : title) : nameNoExt
      track = { id: entry.path, name: displayName, filePath: entry.path, fileUrl: entry.path, artist, title, duration }
      addTracks([track])
    }
    audioEngine.initAudio()
    const setter = deck === 'A' ? useStore.getState().setDeckA : useStore.getState().setDeckB
    setter({ track, isLoaded: false })
    await audioEngine.loadTrack(deck, track.fileUrl, track.name)
  }, [audioEngine, addTracks])

  const handleDragStart = useCallback((e: React.DragEvent, entry: DirEntry) => {
    e.dataTransfer.setData('trackId', entry.path)
    e.dataTransfer.setData('trackName', entry.name.replace(/\.[^/.]+$/, ''))
  }, [])

  // Build breadcrumb segments
  const breadcrumbs: { label: string; path: string }[] = []
  if (selectedFolder && currentPath) {
    const rootName = selectedFolder.split('/').pop() ?? selectedFolder
    breadcrumbs.push({ label: rootName, path: selectedFolder })
    if (currentPath !== selectedFolder) {
      const relative = currentPath.slice(selectedFolder.length)
      let accumulated = selectedFolder
      for (const seg of relative.split('/').filter(Boolean)) {
        accumulated += '/' + seg
        breadcrumbs.push({ label: seg, path: accumulated })
      }
    }
  }

  const dirEntries = entries.filter(e => e.isDirectory)
  const audioEntries = entries.filter(e => !e.isDirectory)

  return (
    <div style={{
      background: '#14141e',
      border: '1px solid #2a2a3a',
      borderRadius: 12,
      display: 'flex',
      flexDirection: 'row',
      height: '100%',
      overflow: 'hidden'
    }}>

      {/* ── Left: Linked folders sidebar ── */}
      <div style={{
        width: 172,
        borderRight: '1px solid #2a2a3a',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        overflow: 'hidden'
      }}>
        {/* Sidebar header */}
        <div style={{
          display: 'flex', alignItems: 'center',
          padding: '7px 10px',
          borderBottom: '1px solid #1a1a28',
          gap: 6, flexShrink: 0
        }}>
          <div style={{ fontSize: 9, color: '#6666aa', letterSpacing: '0.1em', fontWeight: 700, flex: 1 }}>FOLDERS</div>
          <button
            onClick={linkFolder}
            title="Link a folder"
            style={{
              background: '#161628',
              border: '1px solid #00ff8866',
              color: '#00ff88',
              borderRadius: 4,
              width: 22, height: 22,
              fontSize: 16, fontWeight: 700,
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              lineHeight: 1, padding: 0, flexShrink: 0
            }}
          >+</button>
        </div>

        {/* Folder list */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {linkedFolders.length === 0 ? (
            <div style={{ padding: '16px 10px', fontSize: 11, color: '#333355', textAlign: 'center', lineHeight: 1.8 }}>
              Click + to link<br />a music folder
            </div>
          ) : (
            linkedFolders.map(folderPath => {
              const name = folderPath.split('/').pop() ?? folderPath
              const isActive = selectedFolder === folderPath
              return (
                <div
                  key={folderPath}
                  onClick={() => selectFolder(folderPath)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '8px 10px',
                    cursor: 'pointer',
                    background: isActive ? '#1a1a2e' : 'transparent',
                    borderBottom: '1px solid #1a1a28',
                    borderLeft: `2px solid ${isActive ? '#00ff88' : 'transparent'}`,
                    transition: 'background 0.1s'
                  }}
                  onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLDivElement).style.background = '#171726' }}
                  onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
                >
                  <span style={{ fontSize: 13, flexShrink: 0 }}>📁</span>
                  <span style={{
                    fontSize: 12, flex: 1, overflow: 'hidden',
                    textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    color: isActive ? '#e0e0f0' : '#aaaacc'
                  }}>{name}</span>
                  <button
                    onClick={e => { e.stopPropagation(); unlinkFolder(folderPath) }}
                    title="Unlink"
                    style={{
                      background: 'transparent', border: 'none',
                      color: '#444466', cursor: 'pointer',
                      fontSize: 14, padding: 0, flexShrink: 0,
                      lineHeight: 1
                    }}
                  >×</button>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* ── Right: File list ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

        {/* Breadcrumb bar */}
        {breadcrumbs.length > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '5px 12px',
            borderBottom: '1px solid #1a1a28',
            flexShrink: 0, flexWrap: 'wrap'
          }}>
            {breadcrumbs.map((bc, i) => (
              <React.Fragment key={bc.path}>
                {i > 0 && <span style={{ color: '#444466', fontSize: 10 }}>›</span>}
                <span
                  onClick={() => setCurrentPath(bc.path)}
                  style={{
                    fontSize: 11,
                    color: i === breadcrumbs.length - 1 ? '#c0c0d8' : '#6666aa',
                    cursor: i < breadcrumbs.length - 1 ? 'pointer' : 'default',
                    whiteSpace: 'nowrap'
                  }}
                >{bc.label}</span>
              </React.Fragment>
            ))}
          </div>
        )}

        {/* Entries */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {!selectedFolder ? (
            <div style={{ padding: 24, fontSize: 12, color: '#333355', textAlign: 'center', lineHeight: 2 }}>
              Link a folder to browse your tracks
            </div>
          ) : loading ? (
            <div style={{ padding: 12, fontSize: 11, color: '#444466' }}>Loading...</div>
          ) : entries.length === 0 ? (
            <div style={{ padding: 12, fontSize: 11, color: '#333355' }}>No audio files found</div>
          ) : (
            <>
              {dirEntries.map(entry => (
                <DirRow key={entry.path} entry={entry} onClick={() => setCurrentPath(entry.path)} />
              ))}
              {audioEntries.map(entry => (
                <AudioRow key={entry.path} entry={entry} onDragStart={handleDragStart} onLoadDeck={loadToDeck} />
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function DirRow({ entry, onClick }: { entry: DirEntry; onClick: () => void }) {
  const [hover, setHover] = useState(false)
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 12px',
        cursor: 'pointer',
        borderBottom: '1px solid #1a1a28',
        background: hover ? '#1a1a2a' : 'transparent',
        color: '#aaaacc'
      }}
    >
      <span style={{ fontSize: 13, flexShrink: 0 }}>📁</span>
      <span style={{ fontSize: 13, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.name}</span>
      <span style={{ color: '#444466', fontSize: 11, flexShrink: 0 }}>›</span>
    </div>
  )
}
