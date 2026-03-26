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

function Knob({ label, value, onChange, accent }: KnobProps) {
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

export default function Deck({ deck, audioEngine }: DeckProps) {
  const { playDeck, pauseDeck, cueDeck, setDeckVolume, setEQ, seekDeck, getWaveformData } = audioEngine
  const deckState = useStore((s) => (deck === 'A' ? s.deckA : s.deckB))
  const accent = ACCENT[deck]
  const bg = BG[deck]

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)

  // Waveform animation
  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = canvas.width
    const H = canvas.height
    ctx.clearRect(0, 0, W, H)
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, W, H)

    const data = getWaveformData(deck)
    if (data && deckState.isPlaying) {
      ctx.beginPath()
      ctx.strokeStyle = accent
      ctx.lineWidth = 1.5
      ctx.globalAlpha = 0.8
      const sliceWidth = W / data.length
      let x = 0
      for (let i = 0; i < data.length; i++) {
        const v = data[i] / 128.0
        const y = (v * H) / 2
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
        x += sliceWidth
      }
      ctx.stroke()
      ctx.globalAlpha = 1
    } else {
      // Draw flat line
      ctx.beginPath()
      ctx.strokeStyle = '#2a2a3a'
      ctx.lineWidth = 1
      ctx.moveTo(0, H / 2)
      ctx.lineTo(W, H / 2)
      ctx.stroke()
    }

    // Progress overlay
    if (deckState.duration > 0) {
      const progress = deckState.currentTime / deckState.duration
      ctx.fillStyle = `${accent}18`
      ctx.fillRect(0, 0, W * progress, H)
      // Playhead
      ctx.fillStyle = accent
      ctx.fillRect(W * progress - 1, 0, 2, H)
    }

    animRef.current = requestAnimationFrame(drawWaveform)
  }, [deck, deckState.isPlaying, deckState.currentTime, deckState.duration, accent, bg, getWaveformData])

  useEffect(() => {
    animRef.current = requestAnimationFrame(drawWaveform)
    return () => cancelAnimationFrame(animRef.current)
  }, [drawWaveform])

  const handleSeek = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!deckState.isLoaded || deckState.duration === 0) return
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = (e.clientX - rect.left) / rect.width
    seekDeck(deck, ratio * deckState.duration)
  }

  const progress = deckState.duration > 0 ? deckState.currentTime / deckState.duration : 0

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

      {/* Waveform */}
      <canvas
        ref={canvasRef}
        width={312}
        height={64}
        style={{
          borderRadius: 6,
          cursor: deckState.isLoaded ? 'crosshair' : 'default',
          border: '1px solid #2a2a3a',
          width: '100%',
          height: 64
        }}
        onClick={handleSeek}
      />

      {/* Progress bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <input
          type="range"
          min={0}
          max={deckState.duration || 1}
          step={0.1}
          value={deckState.currentTime}
          onChange={(e) => seekDeck(deck, parseFloat(e.target.value))}
          style={{
            flex: 1,
            height: 4,
            accentColor: accent,
            cursor: 'pointer'
          }}
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

      {/* EQ + Volume */}
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

        {/* Volume fader */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <div style={{ fontSize: 9, color: '#8888aa', letterSpacing: '0.06em' }}>VOL</div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={deckState.volume}
            onChange={(e) => setDeckVolume(deck, parseFloat(e.target.value))}
            style={{
              writingMode: 'vertical-lr' as const,
              direction: 'rtl' as const,
              height: 80,
              width: 20,
              accentColor: accent,
              cursor: 'pointer'
            } as React.CSSProperties}
          />
          <div style={{ fontSize: 9, color: accent }}>
            {Math.round(deckState.volume * 100)}%
          </div>
        </div>
      </div>
    </div>
  )
}
