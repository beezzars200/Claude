import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useStore, Track, HistoryEntry } from '../store/useStore'

interface LibraryProps {
  audioEngine: {
    loadTrack: (deck: 'A' | 'B', fileUrl: string, trackName: string) => Promise<void>
    initAudio: () => void
    analyzeTrackBPM: (filePath: string) => Promise<number>
  }
}

interface DirEntry {
  name: string
  isDirectory: boolean
  path: string
}

const LINKED_FOLDERS_KEY = 'radio-studio-linked-folders'
const BPM_CACHE_KEY = 'radio-studio-bpm-cache'

function timeAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  const d = new Date(ts)
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
}

// ----- Audio file row -----

function AudioRow({ entry, bpm, onDragStart, onLoadDeck }: {
  entry: DirEntry
  bpm?: number
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
        padding: '6px 12px',
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
      {bpm ? (
        <div style={{ fontSize: 10, color: '#6666aa', fontFamily: 'monospace', flexShrink: 0, minWidth: 32, textAlign: 'right' }}>
          {bpm}
        </div>
      ) : (
        <div style={{ fontSize: 9, color: '#333344', flexShrink: 0, minWidth: 32, textAlign: 'right' }}>·</div>
      )}
      <div style={{ display: 'flex', gap: 3, flexShrink: 0, opacity: hover ? 1 : 0.55, transition: 'opacity 0.1s' }}>
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

function DirRow({ entry, onClick }: { entry: DirEntry; onClick: () => void }) {
  const [hover, setHover] = useState(false)
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 12px', cursor: 'pointer',
        borderBottom: '1px solid #1a1a28',
        background: hover ? '#1a1a2a' : 'transparent', color: '#aaaacc'
      }}
    >
      <span style={{ fontSize: 13, flexShrink: 0 }}>📁</span>
      <span style={{ fontSize: 13, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.name}</span>
      <span style={{ color: '#444466', fontSize: 11, flexShrink: 0 }}>›</span>
    </div>
  )
}

// ----- History row -----

function HistoryRow({ entry, onLoadDeck }: { entry: HistoryEntry; onLoadDeck: (entry: HistoryEntry, deck: 'A' | 'B') => void }) {
  const [hover, setHover] = useState(false)
  const deckColor = entry.deck === 'A' ? '#00ff88' : '#0088ff'
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '7px 12px', borderBottom: '1px solid #1a1a28',
        background: hover ? '#1a1a2a' : 'transparent', userSelect: 'none'
      }}
    >
      <div style={{
        fontSize: 9, fontWeight: 700, color: deckColor,
        background: deckColor + '22', borderRadius: 3,
        padding: '1px 4px', flexShrink: 0
      }}>{entry.deck}</div>
      <div style={{ flex: 1, overflow: 'hidden', minWidth: 0 }}>
        <div style={{ fontSize: 12, color: '#e0e0f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {entry.name}
        </div>
        {entry.artist && (
          <div style={{ fontSize: 10, color: '#8888aa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {entry.artist}
          </div>
        )}
      </div>
      <div style={{ fontSize: 9, color: '#444466', flexShrink: 0 }}>{timeAgo(entry.loadedAt)}</div>
      <div style={{ display: 'flex', gap: 3, flexShrink: 0, opacity: hover ? 1 : 0.4, transition: 'opacity 0.1s' }}>
        <button
          onClick={() => onLoadDeck(entry, 'A')}
          style={{ background: '#0a1a0f', border: '1px solid #00ff88', color: '#00ff88', borderRadius: 4, padding: '2px 6px', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}
        >A</button>
        <button
          onClick={() => onLoadDeck(entry, 'B')}
          style={{ background: '#0a0f1a', border: '1px solid #0088ff', color: '#0088ff', borderRadius: 4, padding: '2px 6px', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}
        >B</button>
      </div>
    </div>
  )
}

// ----- Main Library -----

export default function Library({ audioEngine }: LibraryProps) {
  const { addTracks, sessionHistory } = useStore()

  const [linkedFolders, setLinkedFolders] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(LINKED_FOLDERS_KEY) ?? '[]') } catch { return [] }
  })
  const [bpmCache, setBpmCache] = useState<Record<string, number>>(() => {
    try { return JSON.parse(localStorage.getItem(BPM_CACHE_KEY) ?? '{}') } catch { return {} }
  })

  const [selectedFolder, setSelectedFolder] = useState<string | null>(null)
  const [currentPath, setCurrentPath] = useState<string | null>(null)
  const [entries, setEntries] = useState<DirEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<'files' | 'history'>('files')

  // Cancel token for background analysis
  const analysisCancelRef = useRef(false)

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

  // Background BPM analysis for uncached audio files
  useEffect(() => {
    analysisCancelRef.current = false
    const audioEntries = entries.filter(e => !e.isDirectory && !bpmCache[e.path])
    if (audioEntries.length === 0) return

    const run = async () => {
      for (const entry of audioEntries) {
        if (analysisCancelRef.current) break
        const bpm = await audioEngine.analyzeTrackBPM(entry.path)
        if (analysisCancelRef.current || bpm === 0) continue
        setBpmCache(prev => {
          const updated = { ...prev, [entry.path]: bpm }
          localStorage.setItem(BPM_CACHE_KEY, JSON.stringify(updated))
          return updated
        })
      }
    }
    run()
    return () => { analysisCancelRef.current = true }
  }, [entries])  // eslint-disable-line react-hooks/exhaustive-deps

  const linkFolder = async () => {
    const folderPath = await window.api.openFolder()
    if (!folderPath) return
    if (!linkedFolders.includes(folderPath)) setLinkedFolders(prev => [...prev, folderPath])
    setSelectedFolder(folderPath)
    setCurrentPath(folderPath)
    setActiveTab('files')
  }

  const selectFolder = (folderPath: string) => {
    setSelectedFolder(folderPath)
    setCurrentPath(folderPath)
    setSearch('')
    setActiveTab('files')
  }

  const unlinkFolder = (folderPath: string) => {
    setLinkedFolders(prev => prev.filter(f => f !== folderPath))
    if (selectedFolder === folderPath) { setSelectedFolder(null); setCurrentPath(null) }
  }

  const loadToDeck = useCallback(async (filePath: string, name: string, deck: 'A' | 'B') => {
    let track: Track | undefined = useStore.getState().tracks.find(t => t.id === filePath)
    if (!track) {
      let artist: string | undefined, title: string | undefined, duration: number | undefined
      try {
        const meta = await window.api.getMetadata(filePath)
        artist = meta.artist ?? undefined; title = meta.title ?? undefined; duration = meta.duration ?? undefined
      } catch {}
      const displayName = title ? (artist ? `${artist} - ${title}` : title) : name
      track = { id: filePath, name: displayName, filePath, fileUrl: filePath, artist, title, duration }
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

  // Breadcrumbs
  const breadcrumbs: { label: string; path: string }[] = []
  if (selectedFolder && currentPath) {
    breadcrumbs.push({ label: selectedFolder.split('/').pop() ?? selectedFolder, path: selectedFolder })
    if (currentPath !== selectedFolder) {
      let acc = selectedFolder
      for (const seg of currentPath.slice(selectedFolder.length).split('/').filter(Boolean)) {
        acc += '/' + seg
        breadcrumbs.push({ label: seg, path: acc })
      }
    }
  }

  const dirEntries = entries.filter(e => e.isDirectory)
  const audioEntries = entries.filter(e => !e.isDirectory)

  // Apply search filter
  const searchLower = search.trim().toLowerCase()
  const filteredAudio = searchLower
    ? audioEntries.filter(e => {
        const nameLower = e.name.replace(/\.[^/.]+$/, '').toLowerCase()
        if (nameLower.includes(searchLower)) return true
        // BPM search: e.g. "128" matches BPMs 125-131 roughly
        const bpmQuery = parseInt(searchLower)
        if (!isNaN(bpmQuery) && bpmCache[e.path]) return Math.abs(bpmCache[e.path] - bpmQuery) <= 3
        return false
      })
    : audioEntries

  const analyzedCount = audioEntries.filter(e => bpmCache[e.path]).length

  return (
    <div style={{
      background: '#14141e', border: '1px solid #2a2a3a', borderRadius: 12,
      display: 'flex', flexDirection: 'row', height: '100%', overflow: 'hidden'
    }}>

      {/* ── Left: Linked folders sidebar ── */}
      <div style={{ width: 172, borderRight: '1px solid #2a2a3a', display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '7px 10px', borderBottom: '1px solid #1a1a28', gap: 6, flexShrink: 0 }}>
          <div style={{ fontSize: 9, color: '#6666aa', letterSpacing: '0.1em', fontWeight: 700, flex: 1 }}>FOLDERS</div>
          <button
            onClick={linkFolder}
            title="Link a folder"
            style={{
              background: '#161628', border: '1px solid #00ff8866', color: '#00ff88',
              borderRadius: 4, width: 22, height: 22, fontSize: 16, fontWeight: 700,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              lineHeight: 1, padding: 0, flexShrink: 0
            }}
          >+</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {linkedFolders.length === 0 ? (
            <div style={{ padding: '16px 10px', fontSize: 11, color: '#333355', textAlign: 'center', lineHeight: 1.8 }}>
              Click + to link<br />a music folder
            </div>
          ) : linkedFolders.map(folderPath => {
            const name = folderPath.split('/').pop() ?? folderPath
            const isActive = selectedFolder === folderPath
            return (
              <div
                key={folderPath}
                onClick={() => selectFolder(folderPath)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px',
                  cursor: 'pointer', background: isActive ? '#1a1a2e' : 'transparent',
                  borderBottom: '1px solid #1a1a28',
                  borderLeft: `2px solid ${isActive ? '#00ff88' : 'transparent'}`,
                  transition: 'background 0.1s'
                }}
                onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLDivElement).style.background = '#171726' }}
                onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
              >
                <span style={{ fontSize: 13, flexShrink: 0 }}>📁</span>
                <span style={{ fontSize: 12, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: isActive ? '#e0e0f0' : '#aaaacc' }}>{name}</span>
                <button
                  onClick={e => { e.stopPropagation(); unlinkFolder(folderPath) }}
                  title="Unlink" style={{ background: 'transparent', border: 'none', color: '#444466', cursor: 'pointer', fontSize: 14, padding: 0, flexShrink: 0, lineHeight: 1 }}
                >×</button>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Right: Files / History ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

        {/* Tab bar + search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 0, borderBottom: '1px solid #1a1a28', flexShrink: 0 }}>
          {(['files', 'history'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                background: 'transparent', border: 'none', borderBottom: `2px solid ${activeTab === tab ? '#00ff88' : 'transparent'}`,
                color: activeTab === tab ? '#e0e0f0' : '#555577',
                padding: '6px 14px', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
                cursor: 'pointer', textTransform: 'uppercase', transition: 'color 0.15s'
              }}
            >{tab === 'files' ? 'FILES' : `HISTORY ${sessionHistory.length > 0 ? `(${sessionHistory.length})` : ''}`}</button>
          ))}
          {activeTab === 'files' && (
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search name or BPM…"
              style={{
                flex: 1, background: 'transparent', border: 'none',
                borderLeft: '1px solid #1a1a28',
                color: '#c0c0d8', fontSize: 11, padding: '0 10px',
                outline: 'none', height: '100%', minWidth: 0
              }}
            />
          )}
          {activeTab === 'files' && audioEntries.length > 0 && (
            <div style={{ fontSize: 9, color: '#444466', padding: '0 8px', flexShrink: 0, whiteSpace: 'nowrap' }}>
              {analyzedCount}/{audioEntries.length} BPM
            </div>
          )}
        </div>

        {/* Breadcrumb (files tab only) */}
        {activeTab === 'files' && breadcrumbs.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 12px', borderBottom: '1px solid #1a1a28', flexShrink: 0, flexWrap: 'wrap' }}>
            {breadcrumbs.map((bc, i) => (
              <React.Fragment key={bc.path}>
                {i > 0 && <span style={{ color: '#444466', fontSize: 10 }}>›</span>}
                <span
                  onClick={() => setCurrentPath(bc.path)}
                  style={{ fontSize: 11, color: i === breadcrumbs.length - 1 ? '#c0c0d8' : '#6666aa', cursor: i < breadcrumbs.length - 1 ? 'pointer' : 'default', whiteSpace: 'nowrap' }}
                >{bc.label}</span>
              </React.Fragment>
            ))}
          </div>
        )}

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {activeTab === 'history' ? (
            sessionHistory.length === 0 ? (
              <div style={{ padding: 24, fontSize: 12, color: '#333355', textAlign: 'center', lineHeight: 2 }}>
                Nothing played yet this session
              </div>
            ) : sessionHistory.map((entry, i) => (
              <HistoryRow
                key={`${entry.filePath}-${entry.loadedAt}`}
                entry={entry}
                onLoadDeck={(e, deck) => loadToDeck(e.filePath, e.name, deck)}
              />
            ))
          ) : !selectedFolder ? (
            <div style={{ padding: 24, fontSize: 12, color: '#333355', textAlign: 'center', lineHeight: 2 }}>
              Link a folder to browse your tracks
            </div>
          ) : loading ? (
            <div style={{ padding: 12, fontSize: 11, color: '#444466' }}>Loading...</div>
          ) : entries.length === 0 ? (
            <div style={{ padding: 12, fontSize: 11, color: '#333355' }}>No audio files found</div>
          ) : (
            <>
              {!searchLower && dirEntries.map(entry => (
                <DirRow key={entry.path} entry={entry} onClick={() => setCurrentPath(entry.path)} />
              ))}
              {filteredAudio.length === 0 && searchLower ? (
                <div style={{ padding: 12, fontSize: 11, color: '#444466' }}>No matches for "{search}"</div>
              ) : filteredAudio.map(entry => (
                <AudioRow
                  key={entry.path}
                  entry={entry}
                  bpm={bpmCache[entry.path]}
                  onDragStart={handleDragStart}
                  onLoadDeck={(e, deck) => loadToDeck(e.path, e.name.replace(/\.[^/.]+$/, ''), deck)}
                />
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
