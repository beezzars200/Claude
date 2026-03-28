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

// ----- Knob -----

interface KnobProps { label: string; value: number; onChange: (v: number) => void; accent: string }

export function Knob({ label, value, onChange, accent }: KnobProps) {
  const startY = useRef<number | null>(null)
  const startVal = useRef(value)

  const onMouseDown = (e: React.MouseEvent) => {
    startY.current = e.clientY
    startVal.current = value
    const onMove = (me: MouseEvent) => {
      if (startY.current === null) return
      onChange(Math.max(0, Math.min(1, startVal.current + (startY.current - me.clientY) / 120)))
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
          width: 42, height: 42, borderRadius: '50%',
          background: 'radial-gradient(circle at 35% 35%, #2a2a3e, #12121a)',
          border: `2px solid ${value === 0.5 ? '#3a3a5a' : accent}`,
          position: 'relative', cursor: 'ns-resize',
          boxShadow: '0 2px 8px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.04)',
          userSelect: 'none'
        }}
        onMouseDown={onMouseDown}
      >
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          width: 2, height: 14,
          background: value === 0.5 ? '#5a5a7a' : accent,
          borderRadius: 1,
          transformOrigin: '50% 100%',
          transform: `translate(-50%, -100%) rotate(${rotation}deg)`
        }} />
      </div>
      <div style={{ fontSize: 9, color: '#8888aa', textAlign: 'center', letterSpacing: '0.06em' }}>{label}</div>
      <div style={{ fontSize: 9, color: value === 0.5 ? '#5a5a7a' : accent, textAlign: 'center' }}>{dbStr}dB</div>
    </div>
  )
}

// ----- Scrubber -----

function Scrubber({ value, max, onChange, accent }: { value: number; max: number; onChange: (v: number) => void; accent: string }) {
  const trackRef = useRef<HTMLDivElement>(null)

  const getPos = (e: MouseEvent | React.MouseEvent): number => {
    const el = trackRef.current
    if (!el || max === 0) return 0
    const rect = el.getBoundingClientRect()
    return Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)) * max
  }

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    onChange(getPos(e))
    const onMove = (me: MouseEvent) => onChange(getPos(me))
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const progress = max > 0 ? value / max : 0

  return (
    <div ref={trackRef} onMouseDown={onMouseDown} style={{
      flex: 1, height: 6, borderRadius: 3,
      background: '#0d0d18', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.8)',
      cursor: 'pointer', position: 'relative', userSelect: 'none'
    }}>
      <div style={{
        position: 'absolute', top: 0, left: 0,
        width: `${progress * 100}%`, height: '100%', borderRadius: 3,
        background: `linear-gradient(to right, ${accent}99, ${accent}cc)`,
        pointerEvents: 'none'
      }} />
      <div style={{
        position: 'absolute', top: '50%', left: `${progress * 100}%`,
        transform: 'translate(-50%, -50%)',
        width: 10, height: 10, borderRadius: '50%',
        background: accent, boxShadow: `0 0 6px ${accent}80`,
        pointerEvents: 'none'
      }} />
    </div>
  )
}

// ----- Vinyl Platter -----

function Platter({ isPlaying, accent, size = 120 }: { isPlaying: boolean; accent: string; size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const angleRef = useRef(0)
  const rafRef = useRef<number>(0)
  const lastTimeRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const draw = (ts: number) => {
      if (isPlaying) {
        const delta = lastTimeRef.current ? ts - lastTimeRef.current : 0
        angleRef.current = (angleRef.current + delta * 0.1) % 360
      }
      lastTimeRef.current = ts

      const W = canvas.width, H = canvas.height, cx = W / 2, cy = H / 2, r = W / 2 - 2
      ctx.clearRect(0, 0, W, H)
      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate((angleRef.current * Math.PI) / 180)
      ctx.translate(-cx, -cy)

      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fillStyle = '#111118'; ctx.fill()

      for (let ri = 10; ri < r - 20; ri += 6) {
        ctx.beginPath(); ctx.arc(cx, cy, ri, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(255,255,255,${ri % 12 === 0 ? 0.06 : 0.02})`
        ctx.lineWidth = 1; ctx.stroke()
      }

      const labelR = r * 0.35
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, labelR)
      g.addColorStop(0, accent + 'aa'); g.addColorStop(0.6, accent + '44'); g.addColorStop(1, accent + '22')
      ctx.beginPath(); ctx.arc(cx, cy, labelR, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill()
      ctx.strokeStyle = accent + '60'; ctx.lineWidth = 1.5; ctx.stroke()

      ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI * 2); ctx.fillStyle = '#0a0a14'; ctx.fill()
      ctx.restore()

      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.strokeStyle = isPlaying ? accent + '40' : '#2a2a3a'; ctx.lineWidth = 2; ctx.stroke()

      rafRef.current = requestAnimationFrame(draw)
    }

    rafRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(rafRef.current)
  }, [isPlaying, accent])

  return (
    <canvas ref={canvasRef} width={size} height={size} style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      boxShadow: isPlaying ? `0 0 28px ${accent}50, 0 4px 16px rgba(0,0,0,0.7)` : '0 4px 16px rgba(0,0,0,0.6)',
      transition: 'box-shadow 0.3s'
    }} />
  )
}

// ----- Premium Button -----

function PremiumBtn({ onClick, disabled = false, active = false, color, size = 48, children, label }: {
  onClick: () => void; disabled?: boolean; active?: boolean; color: string; size?: number; children: React.ReactNode; label?: string
}) {
  return (
    <button onClick={onClick} disabled={disabled} title={label} style={{
      width: size, height: size, borderRadius: 8,
      border: `1px solid ${active ? color : color + '55'}`,
      background: active
        ? `linear-gradient(145deg, ${color}dd, ${color}88)`
        : 'linear-gradient(145deg, #1e1e2a, #12121a)',
      color: active ? '#08080e' : color,
      fontSize: typeof children === 'string' && children.length > 2 ? 11 : 16,
      fontWeight: 700, letterSpacing: '0.04em',
      cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.3 : 1,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0, transition: 'all 0.12s',
      boxShadow: active
        ? `0 0 14px ${color}55, inset 0 1px 0 rgba(255,255,255,0.18), 0 3px 6px rgba(0,0,0,0.7)`
        : 'inset 0 1px 0 rgba(255,255,255,0.06), inset 0 -1px 0 rgba(0,0,0,0.5), 0 3px 8px rgba(0,0,0,0.7)'
    }}>
      {children}
    </button>
  )
}

// ----- Vertical Tempo Slider (±6%, 0.1% display resolution) -----

function VerticalTempoSlider({ value, onChange, accent, height = 160 }: {
  value: number; onChange: (v: number) => void; accent: string; height?: number
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const startY = useRef<number | null>(null)
  const startVal = useRef(value)

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    startY.current = e.clientY
    startVal.current = value
    const onMove = (me: MouseEvent) => {
      if (startY.current === null) return
      const trackH = containerRef.current?.offsetHeight ?? height
      onChange(Math.max(0, Math.min(1, startVal.current + (startY.current - me.clientY) / trackH)))
    }
    const onUp = () => {
      startY.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  // ±6% range, 0.12 coefficient matches audio engine setPitch
  const pct = (value - 0.5) * 12
  const atCenter = Math.abs(pct) < 0.05
  const displayStr = atCenter ? '±0.0%' : `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`
  const capW = 48, capH = 24, trackW = 10

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flexShrink: 0 }}>
      <div style={{ fontSize: 9, color: '#6666aa', letterSpacing: '0.08em', fontWeight: 700 }}>TEMPO</div>

      <div
        ref={containerRef}
        onMouseDown={onMouseDown}
        onDoubleClick={() => onChange(0.5)}
        style={{ position: 'relative', height, width: capW, cursor: 'ns-resize', userSelect: 'none' }}
        title="Double-click to reset"
      >
        {/* Track groove */}
        <div style={{
          position: 'absolute', left: '50%', top: 0, bottom: 0,
          width: trackW, transform: 'translateX(-50%)', borderRadius: 5,
          background: '#080812', boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.95), inset 0 0 1px rgba(255,255,255,0.03)'
        }}>
          {/* Active fill from centre */}
          {!atCenter && (
            <div style={{
              position: 'absolute', left: 0, right: 0, borderRadius: 5,
              background: value > 0.5
                ? `linear-gradient(to top, ${accent}33, ${accent}aa)`
                : `linear-gradient(to bottom, ${accent}33, ${accent}66)`,
              top: value > 0.5 ? `${(1 - value) * 100}%` : '50%',
              height: `${Math.abs(value - 0.5) * 100}%`
            }} />
          )}
          {/* Centre detent mark */}
          <div style={{
            position: 'absolute', left: -5, right: -5, top: '50%',
            height: 2, borderRadius: 1,
            background: atCenter ? accent + '99' : '#3a3a5a',
            transform: 'translateY(-50%)',
            boxShadow: atCenter ? `0 0 6px ${accent}66` : 'none',
            transition: 'background 0.2s'
          }} />
        </div>

        {/* Tick marks at ±2%, ±4% */}
        {[-4, -2, 2, 4].map(t => {
          const pos = (1 - (t / 12 + 0.5)) * 100
          return (
            <div key={t} style={{
              position: 'absolute', right: 2,
              top: `${pos}%`, transform: 'translateY(-50%)',
              width: 5, height: 1, background: '#3a3a5a'
            }} />
          )
        })}

        {/* Fader cap */}
        <div style={{
          position: 'absolute',
          left: '50%', top: `${(1 - value) * 100}%`,
          transform: 'translate(-50%, -50%)',
          width: capW, height: capH, borderRadius: 6,
          background: 'linear-gradient(180deg, #3e3e56 0%, #26263a 40%, #26263a 60%, #3e3e56 100%)',
          border: `1.5px solid ${atCenter ? '#4a4a6a' : accent + 'cc'}`,
          boxShadow: atCenter
            ? '0 3px 10px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.06)'
            : `0 3px 10px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.08), 0 0 10px ${accent}25`,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 4, zIndex: 2, pointerEvents: 'none'
        }}>
          <div style={{ width: 22, height: 1.5, background: atCenter ? '#5a5a7a' : accent + 'cc', borderRadius: 1 }} />
          <div style={{ width: 16, height: 1, background: atCenter ? '#4a4a6a' : accent + '66', borderRadius: 1 }} />
          <div style={{ width: 22, height: 1.5, background: atCenter ? '#5a5a7a' : accent + 'cc', borderRadius: 1 }} />
        </div>
      </div>

      <div style={{
        fontSize: 11, fontFamily: 'monospace', fontWeight: 700,
        color: atCenter ? '#4a4a6a' : (value > 0.5 ? accent : '#ff6688'),
        minWidth: 52, textAlign: 'center'
      }}>
        {displayStr}
      </div>
    </div>
  )
}

// ----- Main Deck Component -----

export default function Deck({ deck, audioEngine }: DeckProps) {
  const { playDeck, pauseDeck, cueDeck, seekDeck } = audioEngine
  const deckState = useStore((s) => (deck === 'A' ? s.deckA : s.deckB))
  const accent = ACCENT[deck]
  const bg = BG[deck]

  const [isDragOver, setIsDragOver] = useState(false)

  const currentTimeRef = useRef(deckState.currentTime)
  const durationRef = useRef(deckState.duration)
  currentTimeRef.current = deckState.currentTime
  durationRef.current = deckState.duration

  const topCanvasRef = useRef<HTMLCanvasElement>(null)
  const topAnimRef = useRef<number>(0)

  const drawWaveformOnCanvas = useCallback((canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const W = canvas.width, H = canvas.height
    ctx.clearRect(0, 0, W, H)
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, W, H)

    const { waveform, waveformLF, waveformMF, waveformHF } = deckState
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
        ctx.fillStyle = `rgba(220,50,50,${alpha})`
        ctx.fillRect(x, barBottom - lfH, bW, Math.max(1, lfH))
        ctx.fillStyle = `rgba(0,200,80,${alpha})`
        ctx.fillRect(x, barBottom - lfH - mfH, bW, Math.max(1, mfH))
        ctx.fillStyle = `rgba(0,160,255,${alpha})`
        ctx.fillRect(x, barBottom - lfH - mfH - hfH, bW, Math.max(1, hfH))
      }

      for (let i = 0; i < numPoints; i++) {
        drawBar(i, Math.max(1, barWidth - 0.5), i * barWidth, i < playedBars ? 0.9 : 0.22)
      }

      const playheadX = Math.floor(progress * W)
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(playheadX - 1, 0, 2, H)
      const gradient = ctx.createLinearGradient(playheadX - 16, 0, playheadX + 16, 0)
      gradient.addColorStop(0, 'transparent')
      gradient.addColorStop(0.5, accent + '40')
      gradient.addColorStop(1, 'transparent')
      ctx.fillStyle = gradient
      ctx.fillRect(playheadX - 16, 0, 32, H)
    } else {
      ctx.strokeStyle = '#2a2a3a'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(0, H / 2)
      ctx.lineTo(W, H / 2)
      ctx.stroke()
    }
  }, [deckState.waveform, deckState.waveformLF, deckState.waveformMF, deckState.waveformHF, accent, bg])

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
    seekDeck(deck, ((e.clientX - rect.left) / rect.width) * deckState.duration)
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const trackId = e.dataTransfer.getData('trackId')
    if (!trackId) return
    let track = useStore.getState().tracks.find(t => t.id === trackId)
    if (!track) {
      const rawName = e.dataTransfer.getData('trackName')
      const trackName = rawName || trackId.split('/').pop()?.replace(/\.[^/.]+$/, '') || 'Unknown'
      track = { id: trackId, name: trackName, filePath: trackId, fileUrl: trackId }
    }
    const deckSetter = deck === 'A' ? useStore.getState().setDeckA : useStore.getState().setDeckB
    deckSetter({ track, isLoaded: false })
    audioEngine.initAudio()
    await audioEngine.loadTrack(deck, track.fileUrl, track.name)
  }

  // BPM adjusts with tempo: ±6% range, 0.12 coefficient matches audio engine
  const playbackRate = 1.0 + (deckState.pitch - 0.5) * 0.12
  const rawBPM = deckState.bpm > 0 ? deckState.bpm * playbackRate : 0
  // Show 1 decimal place for precise mixing (e.g. 128.3 BPM)
  const displayBPM = rawBPM > 0 ? rawBPM.toFixed(1) : null

  const remaining = Math.max(0, deckState.duration - deckState.currentTime)

  // Transport buttons (shared for both decks, order is flipped per deck)
  const transportButtons = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
      <PremiumBtn onClick={() => cueDeck(deck)} disabled={!deckState.isLoaded} color="#ccaa00" size={48} label="CUE">CUE</PremiumBtn>
      <PremiumBtn
        onClick={deckState.isPlaying ? () => pauseDeck(deck) : () => playDeck(deck)}
        disabled={!deckState.isLoaded}
        active={deckState.isPlaying}
        color={accent}
        size={48}
        label={deckState.isPlaying ? 'Pause' : 'Play'}
      >
        {deckState.isPlaying ? '⏸' : '▶'}
      </PremiumBtn>
      <PremiumBtn onClick={() => { pauseDeck(deck); seekDeck(deck, 0) }} disabled={!deckState.isLoaded} color="#556688" size={48} label="Stop">■</PremiumBtn>
    </div>
  )

  return (
    <div style={{
      background: '#14141e',
      border: `1px solid ${deckState.isPlaying ? accent + '40' : '#2a2a3a'}`,
      borderRadius: 12,
      padding: '12px 14px',
      display: 'flex',
      flexDirection: 'column',
      flex: 1,
      gap: 8,
      transition: 'border-color 0.3s',
      overflow: 'hidden'
    }}>

      {/* ── ROW 1: Info bar ── */}
      <div style={{ display: 'flex', flexDirection: 'row', gap: 10, alignItems: 'stretch' }}>

        {/* Deck A: Art panel on LEFT */}
        {deck === 'A' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ background: accent, color: '#0a0a10', borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 800, letterSpacing: '0.1em' }}>
                DECK A
              </div>
              {displayBPM && (
                <div style={{ fontSize: 10, color: '#8888aa' }}>
                  <span style={{ color: accent, fontWeight: 700 }}>{displayBPM}</span>
                  <span style={{ marginLeft: 2 }}>BPM</span>
                </div>
              )}
            </div>
            <div style={{ width: 90, height: 90, borderRadius: 8, overflow: 'hidden', border: `1px solid ${accent}44`, background: '#080812', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {deckState.albumArt
                ? <img src={deckState.albumArt} alt="art" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <span style={{ fontSize: 42, fontWeight: 900, color: accent + '30', fontFamily: 'Georgia, serif', userSelect: 'none' }}>K</span>
              }
            </div>
          </div>
        )}

        {/* Deck B: Tempo slider on LEFT */}
        {deck === 'B' && (
          <VerticalTempoSlider value={deckState.pitch} onChange={(v) => audioEngine.setPitch(deck, v)} accent={accent} height={110} />
        )}

        {/* Track name / drop zone — centre, flex:1 */}
        <div
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
          onDragLeave={() => setIsDragOver(false)}
          style={{
            flex: 1, minWidth: 0,
            border: `1px dashed ${isDragOver ? accent : (deckState.track ? accent + '22' : '#3a3a5a')}`,
            borderRadius: 8, padding: '8px 14px',
            background: isDragOver ? `${accent}10` : (deckState.track ? `${accent}06` : '#0c0c18'),
            transition: 'all 0.15s',
            display: 'flex', flexDirection: 'column', justifyContent: 'center',
            minHeight: 90
          }}
        >
          {deckState.track ? (
            <>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#e8e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.4 }}>
                {deckState.track.title ?? deckState.track.name}
              </div>
              {deckState.track.artist && (
                <div style={{ fontSize: 12, color: '#8888aa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 3 }}>
                  {deckState.track.artist}
                </div>
              )}
            </>
          ) : (
            <div style={{ fontSize: 12, color: isDragOver ? accent : '#3a3a5a', textAlign: 'center' }}>
              Drop track → Deck {deck}
            </div>
          )}
        </div>

        {/* Deck A: Tempo slider on RIGHT */}
        {deck === 'A' && (
          <VerticalTempoSlider value={deckState.pitch} onChange={(v) => audioEngine.setPitch(deck, v)} accent={accent} height={110} />
        )}

        {/* Deck B: Art panel on RIGHT */}
        {deck === 'B' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ background: accent, color: '#0a0a10', borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 800, letterSpacing: '0.1em' }}>
                DECK B
              </div>
              {displayBPM && (
                <div style={{ fontSize: 10, color: '#8888aa' }}>
                  <span style={{ color: accent, fontWeight: 700 }}>{displayBPM}</span>
                  <span style={{ marginLeft: 2 }}>BPM</span>
                </div>
              )}
            </div>
            <div style={{ width: 90, height: 90, borderRadius: 8, overflow: 'hidden', border: `1px solid ${accent}44`, background: '#080812', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {deckState.albumArt
                ? <img src={deckState.albumArt} alt="art" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <span style={{ fontSize: 42, fontWeight: 900, color: accent + '30', fontFamily: 'Georgia, serif', userSelect: 'none' }}>K</span>
              }
            </div>
          </div>
        )}
      </div>

      {/* ── ROW 2: Waveform + time + scrubber ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <canvas
          ref={topCanvasRef}
          width={1200}
          height={176}
          style={{ width: '100%', height: 80, borderRadius: 6, cursor: deckState.isLoaded ? 'crosshair' : 'default', display: 'block' }}
          onClick={handleSeek}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ fontSize: 15, fontWeight: 700, fontFamily: 'monospace', color: accent, letterSpacing: 1, flexShrink: 0 }}>
            {formatTime(deckState.currentTime)}
          </div>
          <Scrubber value={deckState.currentTime} max={deckState.duration} onChange={(v) => seekDeck(deck, v)} accent={accent} />
          <div style={{ fontSize: 12, color: '#5a5a7a', fontFamily: 'monospace', flexShrink: 0 }}>
            -{formatTime(remaining)}
          </div>
        </div>
      </div>

      {/* ── ROW 3: Platter + Transport buttons ── */}
      <div style={{
        display: 'flex',
        flexDirection: 'row',
        gap: 12,
        alignItems: 'center',
        justifyContent: deck === 'A' ? 'flex-start' : 'flex-end',
        marginTop: 'auto',
        paddingTop: 4
      }}>
        {deck === 'A' && <Platter isPlaying={deckState.isPlaying} accent={accent} size={120} />}
        {deck === 'A' && transportButtons}
        {deck === 'B' && transportButtons}
        {deck === 'B' && <Platter isPlaying={deckState.isPlaying} accent={accent} size={120} />}
      </div>

    </div>
  )
}
