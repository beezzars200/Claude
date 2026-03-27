import React, { useRef, useEffect, useCallback } from 'react'
import { useStore } from '../store/useStore'

interface MixerProps {
  audioEngine: {
    updateCrossfader: (value: number) => void
    updateMasterVolume: (value: number) => void
  }
  getAnalyserData: (deck: 'A' | 'B') => Uint8Array | null
  setEQ: (deck: 'A' | 'B', band: 'low' | 'mid' | 'high', value: number) => void
  deckAEQ: { low: number; mid: number; high: number }
  deckBEQ: { low: number; mid: number; high: number }
}

// ----- Knob (copied from Deck.tsx for use in Mixer) -----

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

// ----- EQ Strip -----

interface EQStripProps {
  deck: 'A' | 'B'
  eq: { low: number; mid: number; high: number }
  setEQ: (deck: 'A' | 'B', band: 'low' | 'mid' | 'high', value: number) => void
  accent: string
}

function EQStrip({ deck, eq, setEQ, accent }: EQStripProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <div style={{ fontSize: 9, color: accent, letterSpacing: '0.1em', fontWeight: 700 }}>{deck}</div>
      <Knob label="HI" value={eq.high === 0 ? 0.5 : eq.high} onChange={(v) => setEQ(deck, 'high', v)} accent={accent} />
      <Knob label="MID" value={eq.mid === 0 ? 0.5 : eq.mid} onChange={(v) => setEQ(deck, 'mid', v)} accent={accent} />
      <Knob label="LOW" value={eq.low === 0 ? 0.5 : eq.low} onChange={(v) => setEQ(deck, 'low', v)} accent={accent} />
    </div>
  )
}

// ----- Custom Fader components -----

interface HorizontalFaderProps {
  value: number
  onChange: (v: number) => void
}

function HorizontalFader({ value, onChange }: HorizontalFaderProps) {
  const startX = useRef<number | null>(null)
  const startVal = useRef(value)
  const containerRef = useRef<HTMLDivElement>(null)

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    const trackWidth = containerRef.current?.offsetWidth ?? 180
    startX.current = e.clientX
    startVal.current = value
    const onMove = (me: MouseEvent) => {
      if (startX.current === null) return
      const delta = (me.clientX - startX.current) / trackWidth
      const next = Math.max(0, Math.min(1, startVal.current + delta))
      onChange(next)
    }
    const onUp = () => {
      startX.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const capWidth = 14
  const capHeight = 38
  const trackH = 12
  const atCenter = Math.abs(value - 0.5) < 0.008

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        height: capHeight,
        cursor: 'ew-resize',
        userSelect: 'none',
        flexShrink: 0
      }}
      onMouseDown={onMouseDown}
    >
      {/* Track — centered vertically */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: 0,
        right: 0,
        transform: 'translateY(-50%)',
        height: trackH,
        borderRadius: 6,
        background: '#0a0a14',
        boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.9)'
      }}>
        {/* Green fill: fader to center (only when left of center) */}
        {!atCenter && value < 0.5 && (
          <div style={{
            position: 'absolute',
            top: 0, bottom: 0,
            left: `${value * 100}%`,
            width: `${(0.5 - value) * 100}%`,
            background: 'linear-gradient(to right, #00ff8844, #00ff88bb)',
            borderRadius: 6
          }} />
        )}
        {/* Blue fill: center to fader (only when right of center) */}
        {!atCenter && value > 0.5 && (
          <div style={{
            position: 'absolute',
            top: 0, bottom: 0,
            left: '50%',
            width: `${(value - 0.5) * 100}%`,
            background: 'linear-gradient(to right, #0088ff44, #0088ffbb)',
            borderRadius: 6
          }} />
        )}
      </div>

      {/* Left end marker */}
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 2, background: '#4a4a6a', borderRadius: 1, pointerEvents: 'none' }} />
      {/* Centre marker — subtle green */}
      <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, transform: 'translateX(-50%)', width: 1, background: '#00ff8855', pointerEvents: 'none' }} />
      {/* Right end marker */}
      <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 2, background: '#4a4a6a', borderRadius: 1, pointerEvents: 'none' }} />

      {/* Cap — percentage positioned, no layout jitter */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: `calc(${value * 100}% - ${capWidth / 2}px)`,
        transform: 'translateY(-50%)',
        width: capWidth,
        height: capHeight,
        borderRadius: 4,
        background: 'linear-gradient(to right, #3a3a4e, #28283a, #3a3a4e)',
        border: '1px solid #7777aa',
        boxShadow: '0 2px 10px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.07)',
        pointerEvents: 'none',
        zIndex: 2
      }}>
        {/* Grip line */}
        <div style={{
          position: 'absolute',
          top: '50%', left: '50%',
          transform: 'translate(-50%,-50%)',
          width: 2, height: 18,
          background: '#7777aa',
          borderRadius: 1
        }} />
      </div>
    </div>
  )
}

// ----- VU Meter (updated via DOM refs) -----

interface VUMeterProps {
  color: string
  barRefs: React.MutableRefObject<(HTMLDivElement | null)[]>
  bars?: number
  barWidth?: number
  barHeight?: number
}

function VUMeter({ color, barRefs, bars = 12, barWidth = 10, barHeight = 4 }: VUMeterProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
      {Array.from({ length: bars }, (_, i) => {
        const idx = bars - 1 - i
        return (
          <div
            key={i}
            ref={(el) => { barRefs.current[idx] = el }}
            style={{
              width: barWidth,
              height: barHeight,
              borderRadius: 1,
              background: '#1e1e2a',
              transition: 'background 0.05s'
            }}
          />
        )
      })}
    </div>
  )
}

// ----- Mixer -----

const MASTER_BARS = 16

export default function Mixer({ audioEngine, getAnalyserData, setEQ, deckAEQ, deckBEQ }: MixerProps) {
  const { updateCrossfader, updateMasterVolume } = audioEngine
  const { crossfader, masterVolume } = useStore()

  // Master stereo VU bar refs (L = Deck A, R = Deck B)
  const masterLBarRefs = useRef<(HTMLDivElement | null)[]>(Array(MASTER_BARS).fill(null))
  const masterRBarRefs = useRef<(HTMLDivElement | null)[]>(Array(MASTER_BARS).fill(null))

  // Level refs (no re-render)
  const levelARef = useRef(0)
  const levelBRef = useRef(0)
  const rafRef = useRef<number>(0)

  const { deckA, deckB } = useStore()
  const isPlayingARef = useRef(deckA.isPlaying)
  const isPlayingBRef = useRef(deckB.isPlaying)
  isPlayingARef.current = deckA.isPlaying
  isPlayingBRef.current = deckB.isPlaying

  const updateVUBars = useCallback((barRefs: React.MutableRefObject<(HTMLDivElement | null)[]>, level: number, color: string, barCount: number) => {
    const lit = Math.round(level * barCount)
    for (let idx = 0; idx < barCount; idx++) {
      const el = barRefs.current[idx]
      if (!el) continue
      const isLit = idx < lit
      const isRed = idx >= barCount - 2
      const isYellow = idx >= barCount - 4 && idx < barCount - 2
      if (isLit) {
        el.style.background = isRed ? '#ff3366' : isYellow ? '#ffcc00' : color
        el.style.boxShadow = (!isRed && !isYellow) ? `0 0 4px ${color}60` : 'none'
      } else {
        el.style.background = '#1e1e2a'
        el.style.boxShadow = 'none'
      }
    }
  }, [])

  useEffect(() => {
    const animate = () => {
      // Deck A (left channel)
      const dataA = getAnalyserData('A')
      if (dataA && dataA.length > 0 && isPlayingARef.current) {
        let sumA = 0
        for (let i = 0; i < dataA.length; i++) sumA += dataA[i]
        levelARef.current = sumA / (255 * dataA.length)
      } else {
        levelARef.current = Math.max(0, levelARef.current - 0.04)
      }

      // Deck B (right channel)
      const dataB = getAnalyserData('B')
      if (dataB && dataB.length > 0 && isPlayingBRef.current) {
        let sumB = 0
        for (let i = 0; i < dataB.length; i++) sumB += dataB[i]
        levelBRef.current = sumB / (255 * dataB.length)
      } else {
        levelBRef.current = Math.max(0, levelBRef.current - 0.04)
      }

      updateVUBars(masterLBarRefs, levelARef.current, '#ffffff', MASTER_BARS)
      updateVUBars(masterRBarRefs, levelBRef.current, '#ffffff', MASTER_BARS)

      rafRef.current = requestAnimationFrame(animate)
    }

    rafRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(rafRef.current)
  }, [getAnalyserData, updateVUBars])

  const crossPercent = Math.round(crossfader * 100)

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
        flexShrink: 0
      }}
    >
      {/* Top row: A EQ | Master VU+Knob | B EQ */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, justifyContent: 'space-between' }}>
        {/* Deck A EQ strip */}
        <EQStrip deck="A" eq={deckAEQ} setEQ={setEQ} accent="#00ff88" />

        {/* Master VU + Knob */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <div style={{ fontSize: 9, color: '#8888aa', letterSpacing: '0.1em' }}>MASTER</div>
          {/* Stereo VU: two columns side by side */}
          <div style={{ display: 'flex', gap: 3 }}>
            <VUMeter color="#ffffff" barRefs={masterLBarRefs} bars={16} barWidth={12} barHeight={5} />
            <VUMeter color="#ffffff" barRefs={masterRBarRefs} bars={16} barWidth={12} barHeight={5} />
          </div>
          {/* Master knob */}
          <Knob label="VOL" value={masterVolume} onChange={updateMasterVolume} accent="#ffffff" />
          <div style={{ fontSize: 9, color: '#e0e0f0' }}>{Math.round(masterVolume * 100)}%</div>
        </div>

        {/* Deck B EQ strip */}
        <EQStrip deck="B" eq={deckBEQ} setEQ={setEQ} accent="#0088ff" />
      </div>

      {/* Crossfader */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#8888aa' }}>
          <span style={{ color: '#00ff88', fontWeight: 700 }}>A</span>
          <span style={{ letterSpacing: '0.06em' }}>CROSSFADER</span>
          <span style={{ color: '#0088ff', fontWeight: 700 }}>B</span>
        </div>
        <HorizontalFader value={crossfader} onChange={updateCrossfader} />
      </div>

      {/* Status */}
      <div style={{ textAlign: 'center', fontSize: 10, color: '#6666aa' }}>
        {crossPercent < 50 ? `A ${100 - crossPercent * 2}%` : crossPercent > 50 ? `B ${(crossPercent - 50) * 2}%` : 'CENTER'}
      </div>
    </div>
  )
}
