import React, { useRef, useEffect, useCallback } from 'react'
import { useStore } from '../store/useStore'

interface MixerProps {
  audioEngine: {
    updateCrossfader: (value: number) => void
    updateMasterVolume: (value: number) => void
  }
  getAnalyserData: (deck: 'A' | 'B') => Uint8Array | null
}

// ----- Custom Fader components -----

interface VerticalFaderProps {
  value: number
  onChange: (v: number) => void
  accent: string
  height?: number
}

function VerticalFader({ value, onChange, accent, height = 90 }: VerticalFaderProps) {
  const startY = useRef<number | null>(null)
  const startVal = useRef(value)
  const trackRef = useRef<HTMLDivElement>(null)

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
    <div
      ref={trackRef}
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
      {/* Track — 8px, centered inside 28px container */}
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
      {/* Cap — full container width, no transform */}
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
}

const VU_BARS = 12

function VUMeter({ color, barRefs }: VUMeterProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
      {Array.from({ length: VU_BARS }, (_, i) => {
        const idx = VU_BARS - 1 - i
        return (
          <div
            key={i}
            ref={(el) => { barRefs.current[idx] = el }}
            style={{
              width: 10,
              height: 4,
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

export default function Mixer({ audioEngine, getAnalyserData }: MixerProps) {
  const { updateCrossfader, updateMasterVolume } = audioEngine
  const { crossfader, masterVolume, deckA, deckB } = useStore()

  // DOM refs for VU bar elements
  const barsARef = useRef<(HTMLDivElement | null)[]>(Array(VU_BARS).fill(null))
  const barsBRef = useRef<(HTMLDivElement | null)[]>(Array(VU_BARS).fill(null))

  // Level refs (no re-render)
  const levelARef = useRef(0)
  const levelBRef = useRef(0)
  const rafRef = useRef<number>(0)

  const isPlayingARef = useRef(deckA.isPlaying)
  const isPlayingBRef = useRef(deckB.isPlaying)
  isPlayingARef.current = deckA.isPlaying
  isPlayingBRef.current = deckB.isPlaying

  const updateVUBars = useCallback((barRefs: React.MutableRefObject<(HTMLDivElement | null)[]>, level: number, color: string) => {
    const lit = Math.round(level * VU_BARS)
    for (let idx = 0; idx < VU_BARS; idx++) {
      const el = barRefs.current[idx]
      if (!el) continue
      const isLit = idx < lit
      const isRed = idx >= VU_BARS - 2
      const isYellow = idx >= VU_BARS - 4 && idx < VU_BARS - 2
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
      // Deck A
      const dataA = getAnalyserData('A')
      if (dataA && dataA.length > 0 && isPlayingARef.current) {
        let sumA = 0
        for (let i = 0; i < dataA.length; i++) sumA += dataA[i]
        levelARef.current = sumA / (255 * dataA.length)
      } else {
        levelARef.current = Math.max(0, levelARef.current - 0.04)
      }

      // Deck B
      const dataB = getAnalyserData('B')
      if (dataB && dataB.length > 0 && isPlayingBRef.current) {
        let sumB = 0
        for (let i = 0; i < dataB.length; i++) sumB += dataB[i]
        levelBRef.current = sumB / (255 * dataB.length)
      } else {
        levelBRef.current = Math.max(0, levelBRef.current - 0.04)
      }

      updateVUBars(barsARef, levelARef.current, '#00ff88')
      updateVUBars(barsBRef, levelBRef.current, '#0088ff')

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
      <div style={{ fontSize: 10, color: '#6666aa', letterSpacing: '0.1em', textAlign: 'center' }}>
        MIXER
      </div>

      {/* VU Meters + Master Volume */}
      <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'flex-end', gap: 6 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <VUMeter color="#00ff88" barRefs={barsARef} />
          <div style={{ fontSize: 9, color: '#00ff88', letterSpacing: '0.06em' }}>A</div>
        </div>

        {/* Master Volume (custom vertical fader) */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <div style={{ fontSize: 9, color: '#8888aa', letterSpacing: '0.06em' }}>MST</div>
          <VerticalFader
            value={masterVolume}
            onChange={updateMasterVolume}
            accent="#ffffff"
            height={100}
          />
          <div style={{ fontSize: 9, color: '#e0e0f0' }}>{Math.round(masterVolume * 100)}%</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <VUMeter color="#0088ff" barRefs={barsBRef} />
          <div style={{ fontSize: 9, color: '#0088ff', letterSpacing: '0.06em' }}>B</div>
        </div>
      </div>

      {/* Crossfader */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#8888aa' }}>
          <span style={{ color: '#00ff88', fontWeight: 700 }}>A</span>
          <span style={{ letterSpacing: '0.06em' }}>CROSSFADER</span>
          <span style={{ color: '#0088ff', fontWeight: 700 }}>B</span>
        </div>
        <HorizontalFader value={crossfader} onChange={updateCrossfader} />
        <div style={{ textAlign: 'center', fontSize: 10, color: '#6666aa' }}>
          {crossPercent < 50 ? `A ${100 - crossPercent * 2}%` : crossPercent > 50 ? `B ${(crossPercent - 50) * 2}%` : 'CENTER'}
        </div>
      </div>
    </div>
  )
}
