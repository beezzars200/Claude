import React, { useEffect, useRef, useCallback } from 'react'
import { useStore } from '../store/useStore'

interface DeckProps {
  deck: 'A' | 'B'
  audioEngine: {
    playDeck: (deck: 'A' | 'B') => void
    pauseDeck: (deck: 'A' | 'B') => void
    cueDeck: (deck: 'A' | 'B') => void
    setDeckVolume: (deck: 'A' | 'B', volume: number) => void
    setEQ: (deck: 'A' | 'B', band: 'low' | 'mid' | 'high', value: number) => void
    seekDeck: (deck: 'A' | 'B', time: number) => void
    getWaveformData: (deck: 'A' | 'B') => Uint8Array | null
    getAnalyserData: (deck: 'A' | 'B') => Uint8Array | null
  }
}

const ACCENT = { A: '#00ff88', B: '#0088ff' }
const BG = { A: '#0a1a0f', B: '#0a0f1a' }

const DECK_VU_BARS = 8

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

// ----- Vertical Fader (premium custom drag-based) -----

interface VerticalFaderProps {
  value: number
  onChange: (v: number) => void
  accent: string
  height?: number
}

function VerticalFader({ value, onChange, accent, height = 90 }: VerticalFaderProps) {
  const startY = useRef<number | null>(null)
  const startVal = useRef(value)

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    startY.current = e.clientY
    startVal.current = value
    const onMove = (me: MouseEvent) => {
      if (startY.current === null) return
      const delta = (startY.current - me.clientY) / height
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

  const capHeight = 12
  const capWidth = 28
  const capTop = (1 - value) * (height - capHeight)

  return (
    // Outer container is cap-width wide so layout never shifts
    <div
      style={{
        position: 'relative',
        width: capWidth,
        height,
        cursor: 'ns-resize',
        userSelect: 'none',
        flexShrink: 0
      }}
      onMouseDown={onMouseDown}
    >
      {/* Track — 8px, centered inside the 28px container */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: 0,
          transform: 'translateX(-50%)',
          width: 8,
          height: '100%',
          borderRadius: 4,
          background: '#0d0d18',
          boxShadow: 'inset 0 1px 4px rgba(0,0,0,0.8)',
          pointerEvents: 'none'
        }}
      >
        {/* Fill from bottom */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            width: '100%',
            height: `${value * 100}%`,
            borderRadius: 4,
            background: `linear-gradient(to top, ${accent}cc, ${accent}44)`
          }}
        />
      </div>
      {/* Cap — exactly cap-width wide, no transform needed */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: capTop,
          width: capWidth,
          height: capHeight,
          borderRadius: 3,
          background: 'linear-gradient(to bottom, #3a3a4e, #22222e)',
          border: `1px solid ${accent}80`,
          boxShadow: '0 2px 6px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.07)',
          pointerEvents: 'none'
        }}
      >
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%,-50%)',
          width: 12,
          height: 2,
          background: `${accent}60`,
          borderRadius: 1
        }} />
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

export default function Deck({ deck, audioEngine }: DeckProps) {
  const { playDeck, pauseDeck, cueDeck, setDeckVolume, setEQ, seekDeck, getAnalyserData } = audioEngine
  const deckState = useStore((s) => (deck === 'A' ? s.deckA : s.deckB))
  const accent = ACCENT[deck]
  const bg = BG[deck]

  // Reference waveform (smaller, bottom)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)

  // Top large waveform
  const topCanvasRef = useRef<HTMLCanvasElement>(null)
  const topAnimRef = useRef<number>(0)

  // Deck VU meter bar refs
  const deckBarRefs = useRef<(HTMLDivElement | null)[]>(Array(DECK_VU_BARS).fill(null))
  const deckVUAnimRef = useRef<number>(0)
  const deckLevelRef = useRef(0)
  const isPlayingRef = useRef(deckState.isPlaying)
  isPlayingRef.current = deckState.isPlaying

  // Green(0,255,136) → Teal(0,204,187) → Blue(0,136,255) based on HF ratio
  const hfToRgba = (hf: number, alpha: number): string => {
    const t = Math.max(0, Math.min(1, hf))
    let g: number, b: number
    if (t < 0.5) {
      const u = t * 2
      g = Math.round(255 + u * (204 - 255))
      b = Math.round(136 + u * (187 - 136))
    } else {
      const u = (t - 0.5) * 2
      g = Math.round(204 + u * (136 - 204))
      b = Math.round(187 + u * (255 - 187))
    }
    return `rgba(0,${g},${b},${alpha})`
  }

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
      const progress = deckState.duration > 0 ? deckState.currentTime / deckState.duration : 0
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
  }, [deck, deckState.waveform, deckState.waveformHF, deckState.currentTime, deckState.duration, accent, bg])

  // Reference waveform animation
  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    drawWaveformOnCanvas(canvas)
    animRef.current = requestAnimationFrame(drawWaveform)
  }, [drawWaveformOnCanvas])

  useEffect(() => {
    animRef.current = requestAnimationFrame(drawWaveform)
    return () => cancelAnimationFrame(animRef.current)
  }, [drawWaveform])

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

  // Deck VU meter animation
  useEffect(() => {
    const animate = () => {
      const data = getAnalyserData(deck)
      if (data && data.length > 0 && isPlayingRef.current) {
        let sum = 0
        for (let i = 0; i < data.length; i++) sum += data[i]
        deckLevelRef.current = sum / (255 * data.length)
      } else {
        deckLevelRef.current = Math.max(0, deckLevelRef.current - 0.04)
      }

      const level = deckLevelRef.current
      const lit = Math.round(level * DECK_VU_BARS)
      for (let idx = 0; idx < DECK_VU_BARS; idx++) {
        const el = deckBarRefs.current[idx]
        if (!el) continue
        const isLit = idx < lit
        const isRed = idx >= DECK_VU_BARS - 1
        const isYellow = idx >= DECK_VU_BARS - 2 && idx < DECK_VU_BARS - 1
        if (isLit) {
          el.style.background = isRed ? '#ff3366' : isYellow ? '#ffcc00' : accent
          el.style.boxShadow = (!isRed && !isYellow) ? `0 0 4px ${accent}60` : 'none'
        } else {
          el.style.background = '#1e1e2a'
          el.style.boxShadow = 'none'
        }
      }

      deckVUAnimRef.current = requestAnimationFrame(animate)
    }

    deckVUAnimRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(deckVUAnimRef.current)
  }, [getAnalyserData, deck, accent])

  const handleSeek = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!deckState.isLoaded || deckState.duration === 0) return
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = (e.clientX - rect.left) / rect.width
    seekDeck(deck, ratio * deckState.duration)
  }

  return (
    <div
      style={{
        background: '#14141e',
        border: `1px solid ${deckState.isPlaying ? accent + '60' : '#2a2a3a'}`,
        borderRadius: 12,
        padding: 14,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        height: '100%',
        boxShadow: deckState.isPlaying ? `0 0 20px ${accent}18` : 'none',
        transition: 'border-color 0.3s, box-shadow 0.3s'
      }}
    >
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

      {/* Track name */}
      <div
        style={{
          background: '#0f0f18',
          border: '1px solid #2a2a3a',
          borderRadius: 6,
          padding: '6px 10px',
          fontSize: 12,
          color: deckState.track ? '#e0e0f0' : '#444460',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}
      >
        {deckState.track?.name ?? 'No track loaded — drag from library'}
      </div>

      {/* Reference Waveform (smaller) */}
      <canvas
        ref={canvasRef}
        width={600}
        height={80}
        style={{
          borderRadius: 6,
          cursor: deckState.isLoaded ? 'crosshair' : 'default',
          border: '1px solid #2a2a3a',
          width: '100%',
          height: 40
        }}
        onClick={handleSeek}
      />

      {/* Progress scrubber */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Scrubber
          value={deckState.currentTime}
          max={deckState.duration || 1}
          onChange={(v) => seekDeck(deck, v)}
          accent={accent}
        />
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

      {/* EQ + VU + Volume */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', paddingTop: 4 }}>
        {/* EQ knobs */}
        <div style={{ display: 'flex', gap: 10 }}>
          <Knob
            label="LOW"
            value={deckState.eqLow === 0 ? 0.5 : deckState.eqLow}
            onChange={(v) => setEQ(deck, 'low', v)}
            accent={accent}
          />
          <Knob
            label="MID"
            value={deckState.eqMid === 0 ? 0.5 : deckState.eqMid}
            onChange={(v) => setEQ(deck, 'mid', v)}
            accent={accent}
          />
          <Knob
            label="HIGH"
            value={deckState.eqHigh === 0 ? 0.5 : deckState.eqHigh}
            onChange={(v) => setEQ(deck, 'high', v)}
            accent={accent}
          />
        </div>

        {/* Deck VU Meter */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center', justifyContent: 'flex-end' }}>
          {Array.from({ length: DECK_VU_BARS }, (_, i) => {
            const idx = DECK_VU_BARS - 1 - i
            return (
              <div
                key={i}
                ref={(el) => { deckBarRefs.current[idx] = el }}
                style={{
                  width: 8,
                  height: 4,
                  borderRadius: 1,
                  background: '#1e1e2a',
                  transition: 'background 0.05s'
                }}
              />
            )
          })}
        </div>

        {/* Volume fader — premium custom vertical fader */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <div style={{ fontSize: 9, color: '#8888aa', letterSpacing: '0.06em' }}>VOL</div>
          <VerticalFader
            value={deckState.volume}
            onChange={(v) => setDeckVolume(deck, v)}
            accent={accent}
            height={90}
          />
          <div style={{ fontSize: 9, color: accent }}>
            {Math.round(deckState.volume * 100)}%
          </div>
        </div>
      </div>
    </div>
  )
}
