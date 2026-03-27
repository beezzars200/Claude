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

function hfToRgba(hf: number, alpha: number): string {
  const t = Math.max(0, Math.min(1, hf))
  let r: number, g: number, b: number
  if (t < 0.5) {
    // Red (255,50,50) → Green (0,255,136)
    const u = t * 2
    r = Math.round(255 + u * (0 - 255))
    g = Math.round(50 + u * (255 - 50))
    b = Math.round(50 + u * (136 - 50))
  } else {
    // Green (0,255,136) → Yellow (255,200,0)
    const u = (t - 0.5) * 2
    r = Math.round(0 + u * 255)
    g = Math.round(255 + u * (200 - 255))
    b = Math.round(136 + u * (0 - 136))
  }
  return `rgba(${r},${g},${b},${alpha})`
}

export default function Deck({ deck, audioEngine }: DeckProps) {
  const { playDeck, pauseDeck, cueDeck, seekDeck } = audioEngine
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
    const waveformHF = deckState.waveformHF
    if (waveform && waveform.length > 0) {
      const numPoints = waveform.length
      const progress = durationRef.current > 0 ? currentTimeRef.current / durationRef.current : 0
      const playedBars = Math.floor(progress * numPoints)
      const barWidth = W / numPoints

      for (let i = 0; i < numPoints; i++) {
        const barH = Math.max(2, waveform[i] * H * 0.9)
        const x = i * barWidth
        const y = (H - barH) / 2
        const hf = waveformHF ? waveformHF[i] : 0

        ctx.fillStyle = i < playedBars
          ? hfToRgba(hf, 0.9)   // played: full brightness frequency color
          : hfToRgba(hf, 0.22)  // unplayed: same hue, very dim
        ctx.fillRect(x, y, Math.max(1, barWidth - 0.5), barH)
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
  }, [deckState.waveform, deckState.waveformHF, accent, bg])

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
    // Look up track from store
    const track = useStore.getState().tracks.find(t => t.id === trackId)
    if (!track) return
    audioEngine.initAudio()
    await audioEngine.loadTrack(deck, track.fileUrl, track.name)
  }

  return (
    <div
      style={{
        background: '#14141e',
        border: `1px solid ${deckState.isPlaying ? accent + '60' : '#2a2a3a'}`,
        borderRadius: 12,
        padding: 14,
        display: 'flex',
        flexDirection: 'row',
        height: '100%',
        gap: 10,
        alignItems: 'center',
        boxShadow: deckState.isPlaying ? `0 0 20px ${accent}18` : 'none',
        transition: 'border-color 0.3s, box-shadow 0.3s'
      }}
    >
      {deck === 'A' && (
        <Platter isPlaying={deckState.isPlaying} accent={accent} size={150} />
      )}

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* Top large waveform */}
        <canvas
          ref={topCanvasRef}
          width={1200}
          height={176}
          style={{
            borderRadius: 6,
            cursor: deckState.isLoaded ? 'crosshair' : 'default',
            width: '100%',
            height: 88
          }}
          onClick={handleSeek}
        />

        {/* Deck label */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                background: accent,
                color: '#0a0a10',
                borderRadius: 4,
                padding: '2px 10px',
                fontSize: 13,
                fontWeight: 800,
                letterSpacing: '0.1em'
              }}
            >
              DECK {deck}
            </div>
            {deckState.bpm > 0 && (
              <div style={{ fontSize: 12, color: '#8888aa' }}>
                <span style={{ color: accent, fontWeight: 700 }}>{deckState.bpm}</span>
                <span style={{ marginLeft: 2 }}>BPM</span>
              </div>
            )}
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'monospace', color: accent, letterSpacing: 1 }}>
            {formatTime(deckState.currentTime)}
            <span style={{ color: '#3a3a5a', fontSize: 13, margin: '0 3px' }}>/</span>
            <span style={{ color: '#6666aa', fontSize: 13 }}>{formatTime(deckState.duration)}</span>
          </div>
        </div>

        {/* Drop zone (replaces old track name display + small waveform + scrubber) */}
        <div
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
          onDragLeave={() => setIsDragOver(false)}
          style={{
            border: `1px dashed ${isDragOver ? accent : '#3a3a5a'}`,
            borderRadius: 6,
            padding: '6px 10px',
            background: isDragOver ? `${accent}12` : '#0f0f18',
            transition: 'all 0.15s',
            minHeight: 36,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11,
            color: deckState.track ? '#e0e0f0' : (isDragOver ? accent : '#444460'),
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}
        >
          {deckState.track?.name ?? `Drop track → Deck ${deck}`}
        </div>

        {/* Controls row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          {/* CUE */}
          <button
            onClick={() => cueDeck(deck)}
            disabled={!deckState.isLoaded}
            style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              border: '2px solid #ccaa00',
              background: '#1a1500',
              color: '#ffcc00',
              cursor: deckState.isLoaded ? 'pointer' : 'not-allowed',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.05em',
              opacity: deckState.isLoaded ? 1 : 0.4,
              transition: 'all 0.15s'
            }}
          >
            CUE
          </button>

          {/* Play / Pause */}
          <button
            onClick={() => deckState.isPlaying ? pauseDeck(deck) : playDeck(deck)}
            disabled={!deckState.isLoaded}
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              border: `2px solid ${accent}`,
              background: deckState.isPlaying ? accent : bg,
              color: deckState.isPlaying ? '#0a0a10' : accent,
              cursor: deckState.isLoaded ? 'pointer' : 'not-allowed',
              fontSize: 22,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: deckState.isLoaded ? 1 : 0.4,
              boxShadow: deckState.isPlaying ? `0 0 16px ${accent}60` : 'none',
              transition: 'all 0.15s'
            }}
          >
            {deckState.isPlaying ? '⏸' : '▶'}
          </button>

          {/* Stop */}
          <button
            onClick={() => { pauseDeck(deck); seekDeck(deck, 0) }}
            disabled={!deckState.isLoaded}
            style={{
              width: 36,
              height: 36,
              borderRadius: 6,
              border: '1px solid #3a3a5a',
              background: '#1a1a24',
              color: '#8888aa',
              cursor: deckState.isLoaded ? 'pointer' : 'not-allowed',
              fontSize: 14,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: deckState.isLoaded ? 1 : 0.4,
              transition: 'all 0.15s'
            }}
          >
            ⏹
          </button>
        </div>
      </div>

      {deck === 'B' && (
        <Platter isPlaying={deckState.isPlaying} accent={accent} size={150} />
      )}

    </div>
  )
}
