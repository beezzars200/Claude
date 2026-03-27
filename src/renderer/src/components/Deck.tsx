import React, { useEffect, useRef, useCallback, useState } from 'react'
import { useStore } from '../store/useStore'

interface DeckProps {
  deck: 'A' | 'B'
  audioEngine: {
    playDeck: (deck: 'A' | 'B') => void
    pauseDeck: (deck: 'A' | 'B') => void
    cueDeck: (deck: 'A' | 'B') => void
    seekDeck: (deck: 'A' | 'B', time: number) => void
    getWaveformData: (deck: 'A' | 'B') => Uint8Array | null
    initAudio: () => void
    loadTrack: (deck: 'A' | 'B', fileUrl: string, trackName: string) => Promise<void>
    setPitch: (deck: 'A' | 'B', value: number) => void
  }
}

const ACCENT = { A: '#00ff88', B: '#0088ff' }
const BG = { A: '#0a1a0f', B: '#0a0f1a' }

function formatTime(seconds: number): string {
  if (!seconds || isNaN(seconds)) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

interface KnobProps {
  label: string
  value: number
  onChange: (v: number) => void
  accent: string
}

export function Knob({ label, value, onChange, accent }: KnobProps) {
  const startY = useRef<number | null>(null)
  const startVal = useRef(value)

  const onMouseDown = (e: React.MouseEvent) => {
    startY.current = e.clientY
    startVal.current = value
    const onMove = (me: MouseEvent) => {
      if (startY.current === null) return
      const delta = (startY.current - me.clientY) / 120
      const next = Math.max(0, Math.min(1, startVal.current + delta))
      onChange(next)
    }
    const onUp = () => {
      startY.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  // Rotation: -135deg (min) to +135deg (max)
  const rotation = -135 + value * 270
  const displayDb = Math.round((value - 0.5) * 24)
  const dbStr = displayDb >= 0 ? `+${displayDb}` : `${displayDb}`

  return (
    <div className="knob-container" style={{ gap: 4 }}>
      <div
        className="knob"
        style={{
          width: 42,
          height: 42,
          borderRadius: '50%',
          background: 'radial-gradient(circle at 35% 35%, #2a2a3e, #12121a)',
          border: `2px solid ${value === 0.5 ? '#3a3a5a' : accent}`,
          position: 'relative',
          cursor: 'ns-resize',
          boxShadow: `0 2px 8px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.04)`,
          userSelect: 'none'
        }}
        onMouseDown={onMouseDown}
      >
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: 2,
            height: 14,
            background: value === 0.5 ? '#5a5a7a' : accent,
            borderRadius: 1,
            transformOrigin: '50% 100%',
            transform: `translate(-50%, -100%) rotate(${rotation}deg)`,
          }}
        />
      </div>
      <div style={{ fontSize: 9, color: '#8888aa', textAlign: 'center', letterSpacing: '0.06em' }}>
        {label}
      </div>
      <div style={{ fontSize: 9, color: value === 0.5 ? '#5a5a7a' : accent, textAlign: 'center' }}>
        {dbStr}dB
      </div>
    </div>
  )
}

// ----- Styled progress scrubber -----

interface ScrubberProps {
  value: number
  max: number
  onChange: (v: number) => void
  accent: string
}

function Scrubber({ value, max, onChange, accent }: ScrubberProps) {
  const trackRef = useRef<HTMLDivElement>(null)

  const getPositionFromEvent = (e: MouseEvent | React.MouseEvent): number => {
    const el = trackRef.current
    if (!el || max === 0) return 0
    const rect = el.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    return ratio * max
  }

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    onChange(getPositionFromEvent(e))
    const onMove = (me: MouseEvent) => {
      onChange(getPositionFromEvent(me))
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const progress = max > 0 ? value / max : 0

  return (
    <div
      ref={trackRef}
      onMouseDown={onMouseDown}
      style={{
        flex: 1,
        height: 6,
        borderRadius: 3,
        background: '#0d0d18',
        boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.8)',
        cursor: 'pointer',
        position: 'relative',
        userSelect: 'none'
      }}
    >
      {/* Fill */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: `${progress * 100}%`,
          height: '100%',
          borderRadius: 3,
          background: `linear-gradient(to right, ${accent}99, ${accent}cc)`,
          pointerEvents: 'none'
        }}
      />
      {/* Thumb */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: `${progress * 100}%`,
          transform: 'translate(-50%, -50%)',
          width: 10,
          height: 10,
          borderRadius: '50%',
          background: accent,
          boxShadow: `0 0 6px ${accent}80`,
          pointerEvents: 'none'
        }}
      />
    </div>
  )
}

// ----- Vinyl Platter -----

interface PlatterProps {
  isPlaying: boolean
  accent: string
  size?: number
}

function Platter({ isPlaying, accent, size = 160 }: PlatterProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const angleRef = useRef(0)
  const rafRef = useRef<number>(0)
  const lastTimeRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const draw = (timestamp: number) => {
      if (isPlaying) {
        const delta = lastTimeRef.current ? timestamp - lastTimeRef.current : 0
        angleRef.current = (angleRef.current + delta * 0.1) % 360 // ~0.1 deg/ms ≈ 33.3rpm
      }
      lastTimeRef.current = timestamp

      const W = canvas.width
      const H = canvas.height
      const cx = W / 2
      const cy = H / 2
      const r = W / 2 - 2

      ctx.clearRect(0, 0, W, H)

      // Save context for rotation
      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate((angleRef.current * Math.PI) / 180)
      ctx.translate(-cx, -cy)

      // Outer vinyl disc
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.fillStyle = '#111118'
      ctx.fill()

      // Vinyl grooves (concentric rings)
      for (let ri = 10; ri < r - 20; ri += 6) {
        ctx.beginPath()
        ctx.arc(cx, cy, ri, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(255,255,255,${ri % 12 === 0 ? 0.06 : 0.02})`
        ctx.lineWidth = 1
        ctx.stroke()
      }

      // Label circle (inner 35% radius)
      const labelR = r * 0.35
      const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, labelR)
      gradient.addColorStop(0, accent + 'aa')
      gradient.addColorStop(0.6, accent + '44')
      gradient.addColorStop(1, accent + '22')
      ctx.beginPath()
      ctx.arc(cx, cy, labelR, 0, Math.PI * 2)
      ctx.fillStyle = gradient
      ctx.fill()
      ctx.strokeStyle = accent + '60'
      ctx.lineWidth = 1.5
      ctx.stroke()

      // Centre spindle hole
      ctx.beginPath()
      ctx.arc(cx, cy, 4, 0, Math.PI * 2)
      ctx.fillStyle = '#0a0a14'
      ctx.fill()

      ctx.restore()

      // Outer rim glow (non-rotating)
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.strokeStyle = isPlaying ? accent + '40' : '#2a2a3a'
      ctx.lineWidth = 2
      ctx.stroke()

      rafRef.current = requestAnimationFrame(draw)
    }

    rafRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(rafRef.current)
  }, [isPlaying, accent])

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        flexShrink: 0,
        boxShadow: isPlaying
          ? `0 0 24px ${accent}40, 0 4px 16px rgba(0,0,0,0.6)`
          : '0 4px 16px rgba(0,0,0,0.6)',
        transition: 'box-shadow 0.3s'
      }}
    />
  )
}

interface PremiumBtnProps {
  onClick: () => void
  disabled?: boolean
  active?: boolean
  color: string
  size?: number
  children: React.ReactNode
  label?: string
}

function PremiumBtn({ onClick, disabled = false, active = false, color, size = 48, children, label }: PremiumBtnProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      style={{
        width: size,
        height: size,
        borderRadius: 8,
        border: `1px solid ${active ? color : color + '55'}`,
        background: active
          ? `linear-gradient(145deg, ${color}dd, ${color}88)`
          : 'linear-gradient(145deg, #1e1e2a, #12121a)',
        color: active ? '#08080e' : color,
        fontSize: typeof children === 'string' && children.length > 2 ? 11 : 16,
        fontWeight: 700,
        letterSpacing: '0.04em',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.3 : 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        transition: 'all 0.12s',
        boxShadow: active
          ? `0 0 14px ${color}55, inset 0 1px 0 rgba(255,255,255,0.18), 0 3px 6px rgba(0,0,0,0.7)`
          : `inset 0 1px 0 rgba(255,255,255,0.06), inset 0 -1px 0 rgba(0,0,0,0.5), 0 3px 8px rgba(0,0,0,0.7), 0 1px 0 rgba(255,255,255,0.03)`,
      }}
    >
      {children}
    </button>
  )
}

interface TransportColumnProps {
  deck: 'A' | 'B'
  isPlaying: boolean
  isLoaded: boolean
  accent: string
  onPlay: () => void
  onPause: () => void
  onCue: () => void
  onStop: () => void
}

function TransportColumn({ isPlaying, isLoaded, accent, onPlay, onPause, onCue, onStop }: TransportColumnProps) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      alignSelf: 'center',
      flexShrink: 0,
      padding: '0 4px'
    }}>
      <PremiumBtn onClick={onCue} disabled={!isLoaded} color="#ccaa00" size={48} label="CUE">
        CUE
      </PremiumBtn>
      <PremiumBtn
        onClick={isPlaying ? onPause : onPlay}
        disabled={!isLoaded}
        active={isPlaying}
        color={accent}
        size={48}
        label={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? '⏸' : '▶'}
      </PremiumBtn>
      <PremiumBtn onClick={onStop} disabled={!isLoaded} color="#556688" size={48} label="Stop">
        ■
      </PremiumBtn>
    </div>
  )
}

// ----- Vertical Pitch/Tempo Slider -----

interface VerticalSliderProps {
  value: number        // 0–1, 0.5 = centre (0%)
  onChange: (v: number) => void
  accent: string
  label?: string
  height?: number
}

function VerticalSlider({ value, onChange, accent, label = 'TEMPO', height = 110 }: VerticalSliderProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const startY = useRef<number | null>(null)
  const startVal = useRef(value)

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    startY.current = e.clientY
    startVal.current = value
    const trackH = containerRef.current?.offsetHeight ?? height
    const onMove = (me: MouseEvent) => {
      if (startY.current === null) return
      const delta = (startY.current - me.clientY) / trackH
      onChange(Math.max(0, Math.min(1, startVal.current + delta)))
    }
    const onUp = () => {
      startY.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const onDoubleClick = () => onChange(0.5)   // double-click to reset to centre

  const capW = 38
  const capH = 20
  const trackW = 8
  const pct = Math.round((value - 0.5) * 20)
  const atCenter = Math.abs(value - 0.5) < 0.012

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
      <div style={{ fontSize: 9, color: '#6666aa', letterSpacing: '0.08em', fontWeight: 700 }}>{label}</div>
      <div
        ref={containerRef}
        onMouseDown={onMouseDown}
        onDoubleClick={onDoubleClick}
        style={{ position: 'relative', height, width: capW, cursor: 'ns-resize', userSelect: 'none' }}
      >
        {/* Track groove */}
        <div style={{
          position: 'absolute',
          left: '50%',
          top: 0,
          bottom: 0,
          width: trackW,
          transform: 'translateX(-50%)',
          borderRadius: 4,
          background: '#0a0a14',
          boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.9)'
        }}>
          {/* Fill from centre to cap */}
          {!atCenter && (
            <div style={{
              position: 'absolute',
              left: 0,
              right: 0,
              borderRadius: 4,
              background: value > 0.5
                ? `linear-gradient(to top, ${accent}55, ${accent}99)`
                : `linear-gradient(to bottom, ${accent}55, ${accent}99)`,
              top: value > 0.5 ? `${(1 - value) * 100}%` : '50%',
              height: `${Math.abs(value - 0.5) * 100}%`
            }} />
          )}
          {/* Centre notch */}
          <div style={{
            position: 'absolute',
            left: 0, right: 0,
            top: '50%',
            height: 1,
            background: accent + '66',
            transform: 'translateY(-50%)'
          }} />
        </div>
        {/* Cap */}
        <div style={{
          position: 'absolute',
          left: '50%',
          top: `${(1 - value) * 100}%`,
          transform: 'translate(-50%, -50%)',
          width: capW,
          height: capH,
          borderRadius: 4,
          background: 'linear-gradient(to bottom, #3a3a4e, #28283a, #3a3a4e)',
          border: `1px solid ${atCenter ? '#4a4a6a' : accent}`,
          boxShadow: '0 2px 8px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.07)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2,
          pointerEvents: 'none'
        }}>
          <div style={{ width: 16, height: 2, background: atCenter ? '#5a5a7a' : accent, borderRadius: 1 }} />
        </div>
      </div>
      <div style={{ fontSize: 10, color: atCenter ? '#5a5a7a' : accent, fontFamily: 'monospace' }}>
        {pct >= 0 ? '+' : ''}{pct}%
      </div>
    </div>
  )
}

export default function Deck({ deck, audioEngine }: DeckProps) {
  const { playDeck, pauseDeck, cueDeck, seekDeck, initAudio, loadTrack } = audioEngine
  const deckState = useStore((s) => (deck === 'A' ? s.deckA : s.deckB))
  const accent = ACCENT[deck]
  const bg = BG[deck]

  const [isDragOver, setIsDragOver] = useState(false)

  // Refs for stale-closure-free playhead drawing
  const currentTimeRef = useRef(deckState.currentTime)
  const durationRef = useRef(deckState.duration)
  currentTimeRef.current = deckState.currentTime
  durationRef.current = deckState.duration

  // Top large waveform
  const topCanvasRef = useRef<HTMLCanvasElement>(null)
  const topAnimRef = useRef<number>(0)

  // Shared waveform drawing logic — draws onto the given canvas
  const drawWaveformOnCanvas = useCallback((canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = canvas.width
    const H = canvas.height

    ctx.clearRect(0, 0, W, H)
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, W, H)

    const waveform = deckState.waveform
    const waveformLF = deckState.waveformLF
    const waveformMF = deckState.waveformMF
    const waveformHF = deckState.waveformHF
    if (waveform && waveform.length > 0) {
      const numPoints = waveform.length
      const progress = durationRef.current > 0 ? currentTimeRef.current / durationRef.current : 0
      const playedBars = Math.floor(progress * numPoints)
      const barWidth = W / numPoints

      const drawBar = (i: number, bW: number, x: number, alpha: number) => {
        const amp = waveform[i]
        const lf = waveformLF ? waveformLF[i] : 0.33
        const mf = waveformMF ? waveformMF[i] : 0.33
        const hf = waveformHF ? waveformHF[i] : 0.33
        const totalH = Math.max(2, amp * H * 0.85)
        const total = lf + mf + hf + 0.001
        const lfH = (lf / total) * totalH
        const mfH = (mf / total) * totalH
        const hfH = (hf / total) * totalH
        const barBottom = H / 2 + totalH / 2
        // Low: red
        ctx.fillStyle = `rgba(220,50,50,${alpha})`
        ctx.fillRect(x, barBottom - lfH, bW, Math.max(1, lfH))
        // Mid: green
        ctx.fillStyle = `rgba(0,200,80,${alpha})`
        ctx.fillRect(x, barBottom - lfH - mfH, bW, Math.max(1, mfH))
        // High: blue
        ctx.fillStyle = `rgba(0,160,255,${alpha})`
        ctx.fillRect(x, barBottom - lfH - mfH - hfH, bW, Math.max(1, hfH))
      }

      for (let i = 0; i < numPoints; i++) {
        const bW = Math.max(1, barWidth - 0.5)
        drawBar(i, bW, i * barWidth, i < playedBars ? 0.9 : 0.22)
      }

      // Playhead line
      const playheadX = Math.floor(progress * W)
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(playheadX - 1, 0, 2, H)

      // Glow around playhead
      const gradient = ctx.createLinearGradient(playheadX - 14, 0, playheadX + 14, 0)
      gradient.addColorStop(0, 'transparent')
      gradient.addColorStop(0.5, accent + '40')
      gradient.addColorStop(1, 'transparent')
      ctx.fillStyle = gradient
      ctx.fillRect(playheadX - 14, 0, 28, H)
    } else {
      // No waveform loaded — draw flat line
      ctx.beginPath()
      ctx.strokeStyle = '#2a2a3a'
      ctx.lineWidth = 1
      ctx.moveTo(0, H / 2)
      ctx.lineTo(W, H / 2)
      ctx.stroke()
    }
  }, [deckState.waveform, deckState.waveformLF, deckState.waveformMF, deckState.waveformHF, accent, bg])

  // Top large waveform animation
  const drawTopWaveform = useCallback(() => {
    const canvas = topCanvasRef.current
    if (!canvas) return
    drawWaveformOnCanvas(canvas)
    topAnimRef.current = requestAnimationFrame(drawTopWaveform)
  }, [drawWaveformOnCanvas])

  useEffect(() => {
    topAnimRef.current = requestAnimationFrame(drawTopWaveform)
    return () => cancelAnimationFrame(topAnimRef.current)
  }, [drawTopWaveform])

  const handleSeek = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!deckState.isLoaded || deckState.duration === 0) return
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = (e.clientX - rect.left) / rect.width
    seekDeck(deck, ratio * deckState.duration)
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const trackId = e.dataTransfer.getData('trackId')
    if (!trackId) return

    // Find existing track from library/queue, or build a minimal one from drag data.
    // Do NOT call addTracks — dropping onto a deck must not add to the queue.
    let track = useStore.getState().tracks.find(t => t.id === trackId)
    if (!track) {
      const rawName = e.dataTransfer.getData('trackName')
      const trackName = rawName || trackId.split('/').pop()?.replace(/\.[^/.]+$/, '') || 'Unknown'
      track = { id: trackId, name: trackName, filePath: trackId, fileUrl: trackId }
    }

    // Show track name on deck immediately (loadTrack will enrich it with ID3 metadata)
    const deckSetter = deck === 'A' ? useStore.getState().setDeckA : useStore.getState().setDeckB
    deckSetter({ track, isLoaded: false })

    audioEngine.initAudio()
    await audioEngine.loadTrack(deck, track.fileUrl, track.name)
  }

  // Side panel: DECK label + BPM, album art, tempo slider
  const sidePanel = (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 6,
      flexShrink: 0,
      width: 96,
      alignSelf: 'flex-start',
      paddingTop: 2
    }}>
      {/* DECK label + BPM */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
        <div style={{
          background: accent,
          color: '#0a0a10',
          borderRadius: 4,
          padding: '2px 10px',
          fontSize: 12,
          fontWeight: 800,
          letterSpacing: '0.1em'
        }}>
          DECK {deck}
        </div>
        {deckState.bpm > 0 && (
          <div style={{ fontSize: 11, color: '#8888aa' }}>
            <span style={{ color: accent, fontWeight: 700 }}>{deckState.bpm}</span>
            <span style={{ marginLeft: 2 }}>BPM</span>
          </div>
        )}
      </div>

      {/* Album art */}
      <div style={{
        width: 80,
        height: 80,
        borderRadius: 6,
        overflow: 'hidden',
        border: `1px solid ${accent}40`,
        flexShrink: 0,
        background: '#0a0a14',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        {deckState.albumArt ? (
          <img
            src={deckState.albumArt}
            alt="Album art"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <span style={{
            fontSize: 36,
            fontWeight: 900,
            color: accent + '33',
            fontFamily: 'Georgia, serif',
            userSelect: 'none',
            lineHeight: 1
          }}>K</span>
        )}
      </div>

      {/* Tempo slider */}
      <VerticalSlider
        value={deckState.pitch}
        onChange={(v) => audioEngine.setPitch(deck, v)}
        accent={accent}
        label="TEMPO"
        height={100}
      />
    </div>
  )

  return (
    <div
      style={{
        background: '#14141e',
        border: `1px solid ${deckState.isPlaying ? accent + '40' : '#2a2a3a'}`,
        borderRadius: 12,
        padding: 14,
        display: 'flex',
        flexDirection: 'row',
        height: '100%',
        gap: 8,
        alignItems: 'flex-start',
        boxShadow: 'none',
        transition: 'border-color 0.3s'
      }}
    >
      {/* Deck A: Transport + Platter on left */}
      {deck === 'A' && (
        <TransportColumn
          deck={deck}
          isPlaying={deckState.isPlaying}
          isLoaded={deckState.isLoaded}
          accent={accent}
          onPlay={() => playDeck(deck)}
          onPause={() => pauseDeck(deck)}
          onCue={() => cueDeck(deck)}
          onStop={() => { pauseDeck(deck); seekDeck(deck, 0) }}
        />
      )}
      {deck === 'A' && (
        <Platter isPlaying={deckState.isPlaying} accent={accent} size={150} />
      )}

      {/* Main content column */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>

        {/* Track name / drop zone */}
        <div
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
          onDragLeave={() => setIsDragOver(false)}
          style={{
            border: `1px dashed ${isDragOver ? accent : (deckState.track ? accent + '22' : '#3a3a5a')}`,
            borderRadius: 6,
            padding: '5px 10px',
            background: isDragOver ? `${accent}12` : (deckState.track ? `${accent}08` : '#0f0f18'),
            transition: 'all 0.15s',
            minHeight: 40,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            overflow: 'hidden'
          }}
        >
          {deckState.track ? (
            <>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#e0e0f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {deckState.track.title ?? deckState.track.name}
              </div>
              {deckState.track.artist && (
                <div style={{ fontSize: 11, color: '#8888aa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>
                  {deckState.track.artist}
                </div>
              )}
            </>
          ) : (
            <div style={{ fontSize: 11, color: isDragOver ? accent : '#444460', textAlign: 'center' }}>
              Drop track → Deck {deck}
            </div>
          )}
        </div>

        {/* Waveform — full width of content column */}
        <canvas
          ref={topCanvasRef}
          width={1200}
          height={176}
          style={{
            width: '100%',
            height: 88,
            borderRadius: 6,
            cursor: deckState.isLoaded ? 'crosshair' : 'default',
            display: 'block'
          }}
          onClick={handleSeek}
        />

        {/* Time display + scrubber */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'monospace', color: accent, letterSpacing: 1, flexShrink: 0 }}>
            {formatTime(deckState.currentTime)}
          </div>
          <Scrubber
            value={deckState.currentTime}
            max={deckState.duration}
            onChange={(v) => seekDeck(deck, v)}
            accent={accent}
          />
          <div style={{ fontSize: 12, color: '#5a5a7a', fontFamily: 'monospace', flexShrink: 0 }}>
            {formatTime(deckState.duration)}
          </div>
        </div>
      </div>

      {/* Side panel always on the right of main content */}
      {sidePanel}

      {/* Deck B: Platter + Transport on right */}
      {deck === 'B' && (
        <Platter isPlaying={deckState.isPlaying} accent={accent} size={150} />
      )}
      {deck === 'B' && (
        <TransportColumn
          deck={deck}
          isPlaying={deckState.isPlaying}
          isLoaded={deckState.isLoaded}
          accent={accent}
          onPlay={() => playDeck(deck)}
          onPause={() => pauseDeck(deck)}
          onCue={() => cueDeck(deck)}
          onStop={() => { pauseDeck(deck); seekDeck(deck, 0) }}
        />
      )}
    </div>
  )
}
