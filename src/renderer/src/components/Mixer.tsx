import React, { useRef, useEffect, useCallback } from 'react'
import { useStore } from '../store/useStore'
import { Knob } from './Deck'

interface MixerProps {
  audioEngine: {
    updateCrossfader: (value: number) => void
    updateMasterVolume: (value: number) => void
    setDeckVolume: (deck: 'A' | 'B', volume: number) => void
  }
  getAnalyserData: (deck: 'A' | 'B') => Uint8Array | null
  setEQ: (deck: 'A' | 'B', band: 'low' | 'mid' | 'high', value: number) => void
  deckAEQ: { low: number; mid: number; high: number }
  deckBEQ: { low: number; mid: number; high: number }
  deckAVolume: number
  deckBVolume: number
  deckAWave: { waveform: Float32Array | null; waveformLF: Float32Array | null; waveformMF: Float32Array | null; waveformHF: Float32Array | null; currentTime: number; duration: number }
  deckBWave: { waveform: Float32Array | null; waveformLF: Float32Array | null; waveformMF: Float32Array | null; waveformHF: Float32Array | null; currentTime: number; duration: number }
}

// ----- Vertical Waveform -----

interface VerticalWaveformProps {
  deck: 'A' | 'B'
  waveform: Float32Array | null
  waveformLF: Float32Array | null
  waveformMF: Float32Array | null
  waveformHF: Float32Array | null
  currentTime: number
  duration: number
  accent: string
}

function VerticalWaveform({ waveform, waveformLF, waveformMF, waveformHF, currentTime, duration, accent }: VerticalWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)

  // Refs to avoid stale closures in the rAF loop
  const currentTimeRef = useRef(currentTime)
  const durationRef = useRef(duration)
  currentTimeRef.current = currentTime
  durationRef.current = duration

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = canvas.width
    const H = canvas.height

    ctx.fillStyle = '#0a0a14'
    ctx.fillRect(0, 0, W, H)

    if (waveform && waveform.length > 0) {
      const numVisible = 120
      const barH = H / numVisible
      const progress = durationRef.current > 0 ? currentTimeRef.current / durationRef.current : 0
      const centerIdx = Math.floor(progress * waveform.length)

      for (let i = 0; i < numVisible; i++) {
        // i=0 is top (past), i=numVisible-1 is bottom (future)
        // center is at numVisible/2
        const offset = i - numVisible / 2
        const srcIdx = centerIdx + Math.round(offset)
        if (srcIdx < 0 || srcIdx >= waveform.length) continue

        const amp = waveform[srcIdx]
        const lf = waveformLF ? waveformLF[srcIdx] : 0.33
        const mf = waveformMF ? waveformMF[srcIdx] : 0.33
        const hf = waveformHF ? waveformHF[srcIdx] : 0.33
        const totalW = Math.max(1, amp * W * 0.9)
        const total = lf + mf + hf + 0.001
        const lfW = (lf / total) * totalW
        const mfW = (mf / total) * totalW
        const hfW = (hf / total) * totalW
        const barLeft = (W - totalW) / 2
        const bH = Math.max(1, barH - 0.5)
        const y = i * barH
        const isPast = offset < 0
        const alpha = isPast ? 0.8 : 0.3
        // Low: red
        ctx.fillStyle = `rgba(220,50,50,${alpha})`
        ctx.fillRect(barLeft, y, Math.max(1, lfW), bH)
        // Mid: green
        ctx.fillStyle = `rgba(0,200,80,${alpha})`
        ctx.fillRect(barLeft + lfW, y, Math.max(1, mfW), bH)
        // High: blue
        ctx.fillStyle = `rgba(0,160,255,${alpha})`
        ctx.fillRect(barLeft + lfW + mfW, y, Math.max(1, hfW), bH)
      }

      // Playhead: white 1px horizontal line at H/2
      ctx.fillStyle = accent
      ctx.fillRect(0, H / 2 - 1, W, 1)
    } else {
      // No waveform — draw vertical centre line
      ctx.strokeStyle = '#2a2a3a'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(W / 2, 0)
      ctx.lineTo(W / 2, H)
      ctx.stroke()
      // Playhead
      ctx.fillStyle = accent + '40'
      ctx.fillRect(0, H / 2 - 1, W, 1)
    }

    rafRef.current = requestAnimationFrame(draw)
  }, [waveform, waveformLF, waveformMF, waveformHF, accent])

  useEffect(() => {
    rafRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(rafRef.current)
  }, [draw])

  return (
    <canvas
      ref={canvasRef}
      width={56}
      height={200}
      style={{ width: 56, height: '100%', display: 'block', borderRadius: 4 }}
    />
  )
}

// ----- EQ Strip (with VU beside it) -----

interface EQStripProps {
  deck: 'A' | 'B'
  eq: { low: number; mid: number; high: number }
  setEQ: (deck: 'A' | 'B', band: 'low' | 'mid' | 'high', value: number) => void
  accent: string
  vuBarRefs: React.MutableRefObject<(HTMLDivElement | null)[]>
}

const EQ_BARS = 8

function EQStrip({ deck, eq, setEQ, accent, vuBarRefs }: EQStripProps) {
  const knobs = (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <div style={{ fontSize: 9, color: accent, letterSpacing: '0.1em', fontWeight: 700 }}>{deck}</div>
      <Knob label="HI" value={eq.high === 0 ? 0.5 : eq.high} onChange={(v) => setEQ(deck, 'high', v)} accent={accent} />
      <Knob label="MID" value={eq.mid === 0 ? 0.5 : eq.mid} onChange={(v) => setEQ(deck, 'mid', v)} accent={accent} />
      <Knob label="LOW" value={eq.low === 0 ? 0.5 : eq.low} onChange={(v) => setEQ(deck, 'low', v)} accent={accent} />
    </div>
  )

  const vu = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center', justifyContent: 'center' }}>
      {Array.from({ length: EQ_BARS }, (_, i) => {
        const idx = EQ_BARS - 1 - i
        return (
          <div
            key={i}
            ref={(el) => { vuBarRefs.current[idx] = el }}
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
  )

  if (deck === 'A') {
    return (
      <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {knobs}
        {vu}
      </div>
    )
  } else {
    return (
      <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {vu}
        {knobs}
      </div>
    )
  }
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

export default function Mixer({
  audioEngine,
  getAnalyserData,
  setEQ,
  deckAEQ,
  deckBEQ,
  deckAVolume,
  deckBVolume,
  deckAWave,
  deckBWave
}: MixerProps) {
  const { updateCrossfader, updateMasterVolume, setDeckVolume } = audioEngine
  const { crossfader, masterVolume } = useStore()

  // Master stereo VU bar refs (L = Deck A, R = Deck B)
  const masterLBarRefs = useRef<(HTMLDivElement | null)[]>(Array(MASTER_BARS).fill(null))
  const masterRBarRefs = useRef<(HTMLDivElement | null)[]>(Array(MASTER_BARS).fill(null))

  // Deck A and B EQ strip VU bar refs
  const vuABarRefs = useRef<(HTMLDivElement | null)[]>(Array(EQ_BARS).fill(null))
  const vuBBarRefs = useRef<(HTMLDivElement | null)[]>(Array(EQ_BARS).fill(null))

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

      const isA = isPlayingARef.current
      const isB = isPlayingBRef.current
      let masterLevel = 0
      if (isA && isB) {
        masterLevel = Math.min(1, (levelARef.current + levelBRef.current) * 0.6)
      } else if (isA) {
        masterLevel = levelARef.current
      } else if (isB) {
        masterLevel = levelBRef.current
      }
      updateVUBars(masterLBarRefs, masterLevel, '#ffffff', MASTER_BARS)
      updateVUBars(masterRBarRefs, masterLevel, '#ffffff', MASTER_BARS)
      updateVUBars(vuABarRefs, levelARef.current, '#00ff88', EQ_BARS)
      updateVUBars(vuBBarRefs, levelBRef.current, '#0088ff', EQ_BARS)

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
        padding: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        flexShrink: 0,
        height: '100%'
      }}
    >
      {/* Row 1: Vol Knob A | spacer | Vol Knob B */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <div style={{ fontSize: 9, color: '#00ff88', letterSpacing: '0.08em', fontWeight: 700 }}>VOL A</div>
          <Knob
            label="VOL"
            value={deckAVolume}
            onChange={(v) => setDeckVolume('A', v)}
            accent="#00ff88"
          />
        </div>
<div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <div style={{ fontSize: 9, color: '#0088ff', letterSpacing: '0.08em', fontWeight: 700 }}>VOL B</div>
          <Knob
            label="VOL"
            value={deckBVolume}
            onChange={(v) => setDeckVolume('B', v)}
            accent="#0088ff"
          />
        </div>
      </div>

      {/* Row 2: EQ A + VU A | Vert Wave A | Master VU + Knob | Vert Wave B | VU B + EQ B */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0, gap: 6, alignItems: 'stretch' }}>
        {/* EQ A strip (knobs left, VU right) */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <EQStrip deck="A" eq={deckAEQ} setEQ={setEQ} accent="#00ff88" vuBarRefs={vuABarRefs} />
        </div>

        {/* Vertical waveform A */}
        <div style={{ flex: '0 0 56px', display: 'flex', alignItems: 'stretch' }}>
          <VerticalWaveform
            deck="A"
            waveform={deckAWave.waveform}
            waveformHF={deckAWave.waveformHF}
            currentTime={deckAWave.currentTime}
            duration={deckAWave.duration}
            accent="#00ff88"
          />
        </div>

        {/* Master VU + Knob */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
          <div style={{ fontSize: 9, color: '#8888aa', letterSpacing: '0.1em' }}>MASTER</div>
          <div style={{ display: 'flex', gap: 3 }}>
            <VUMeter color="#ffffff" barRefs={masterLBarRefs} bars={16} barWidth={12} barHeight={5} />
            <VUMeter color="#ffffff" barRefs={masterRBarRefs} bars={16} barWidth={12} barHeight={5} />
          </div>
          <Knob label="VOL" value={masterVolume} onChange={updateMasterVolume} accent="#ffffff" />
          <div style={{ fontSize: 9, color: '#e0e0f0' }}>{Math.round(masterVolume * 100)}%</div>
        </div>

        {/* Vertical waveform B */}
        <div style={{ flex: '0 0 56px', display: 'flex', alignItems: 'stretch' }}>
          <VerticalWaveform
            deck="B"
            waveform={deckBWave.waveform}
            waveformHF={deckBWave.waveformHF}
            currentTime={deckBWave.currentTime}
            duration={deckBWave.duration}
            accent="#0088ff"
          />
        </div>

        {/* EQ B strip (VU left, knobs right) */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <EQStrip deck="B" eq={deckBEQ} setEQ={setEQ} accent="#0088ff" vuBarRefs={vuBBarRefs} />
        </div>
      </div>

      {/* Row 3: Crossfader — centre third only */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#8888aa' }}>
          <span style={{ color: '#00ff88', fontWeight: 700 }}>A</span>
          <span style={{ letterSpacing: '0.06em' }}>CROSSFADER</span>
          <span style={{ color: '#0088ff', fontWeight: 700 }}>B</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div style={{ width: '60%' }}>
            <HorizontalFader value={crossfader} onChange={updateCrossfader} />
          </div>
        </div>
      </div>

      {/* Row 4: Status text */}
      <div style={{ textAlign: 'center', fontSize: 10, color: '#6666aa' }}>
        {crossPercent < 50 ? `A ${100 - crossPercent * 2}%` : crossPercent > 50 ? `B ${(crossPercent - 50) * 2}%` : 'CENTER'}
      </div>
    </div>
  )
}
