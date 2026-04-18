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
    syncDeck: (deck: 'A' | 'B') => void
    nudgeDeck: (deck: 'A' | 'B', direction: 1 | -1) => void
    stopNudge: (deck: 'A' | 'B') => void
    setFilter: (deck: 'A' | 'B', type: 'lp' | 'hp', value: number) => void
    setEcho: (deck: 'A' | 'B', params: { time?: number; feedback?: number; wet?: number }) => void
    setReverb: (deck: 'A' | 'B', params: { size?: number; wet?: number }) => void
    setFlanger: (deck: 'A' | 'B', params: { rate?: number; depth?: number; wet?: number }) => void
    setLoopIn: (deck: 'A' | 'B') => void
    setLoopOut: (deck: 'A' | 'B') => void
    toggleLoop: (deck: 'A' | 'B') => void
    exitLoop: (deck: 'A' | 'B') => void
    setBeatLoop: (deck: 'A' | 'B', beats: number) => void
    loopHalve: (deck: 'A' | 'B') => void
    loopDouble: (deck: 'A' | 'B') => void
    reloop: (deck: 'A' | 'B') => void
    beatSync: (deck: 'A' | 'B') => void
  }
}

const ACCENT = { A: '#00ff99', B: '#0099ff' }
const BG = { A: '#070710', B: '#070710' }
const HOT_CUE_COLORS = ['#ff3355', '#2299ff', '#ffaa00', '#cc44ff']

function formatTime(seconds: number): string {
  if (!seconds || isNaN(seconds)) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

// ----- Jog Wheel -----

function JogWheel({ isPlaying, currentTime, accent, deck }: {
  isPlaying: boolean; currentTime: number; accent: string; deck: 'A' | 'B'
}) {
  const SIZE = 130, OUTER_R = 63, RING_W = 13
  const PLATTER_R = OUTER_R - RING_W, CENTER_R = 24
  const angle = (currentTime * 198) % 360
  const glowClass = isPlaying ? (deck === 'A' ? 'jog-playing-a' : 'jog-playing-b') : undefined
  return (
    <div className={glowClass} style={{ position: 'relative', width: SIZE, height: SIZE, flexShrink: 0, borderRadius: '50%' }}>
      <svg width={SIZE} height={SIZE} style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
        <defs>
          <radialGradient id={`og-${deck}`} cx="38%" cy="32%"><stop offset="0%" stopColor="#282838" /><stop offset="100%" stopColor="#12121e" /></radialGradient>
          <radialGradient id={`pg-${deck}`} cx="40%" cy="35%"><stop offset="0%" stopColor="#1a1a2a" /><stop offset="100%" stopColor="#090912" /></radialGradient>
        </defs>
        <circle cx={SIZE/2} cy={SIZE/2} r={OUTER_R} fill={`url(#og-${deck})`} stroke={isPlaying ? accent + '66' : '#252538'} strokeWidth="2" />
        {Array.from({ length: 60 }, (_, i) => {
          const a = (i / 60) * Math.PI * 2, bright = i % 5 === 0
          return <line key={i}
            x1={SIZE/2 + Math.cos(a)*(PLATTER_R+2)} y1={SIZE/2 + Math.sin(a)*(PLATTER_R+2)}
            x2={SIZE/2 + Math.cos(a)*(OUTER_R-1)}   y2={SIZE/2 + Math.sin(a)*(OUTER_R-1)}
            stroke={bright ? '#3c3c54' : '#1e1e2c'} strokeWidth={bright ? 2 : 1.5} />
        })}
        <circle cx={SIZE/2} cy={SIZE/2} r={PLATTER_R} fill={`url(#pg-${deck})`} stroke="#161624" strokeWidth="1" />
      </svg>
      <div style={{
        position: 'absolute', top: SIZE/2-PLATTER_R, left: SIZE/2-PLATTER_R,
        width: PLATTER_R*2, height: PLATTER_R*2, borderRadius: '50%',
        zIndex: 2, pointerEvents: 'none', transform: `rotate(${angle}deg)`, willChange: 'transform'
      }}>
        <svg width={PLATTER_R*2} height={PLATTER_R*2}>
          {[0.88, 0.74, 0.60].map((r, i) => <circle key={i} cx={PLATTER_R} cy={PLATTER_R} r={PLATTER_R*r} fill="none" stroke="#13131e" strokeWidth="1" />)}
          <line x1={PLATTER_R} y1={CENTER_R+4} x2={PLATTER_R} y2={PLATTER_R-CENTER_R-4} stroke={accent} strokeWidth="2.5" strokeLinecap="round" />
          <circle cx={PLATTER_R} cy={CENTER_R+7} r={3} fill={accent} />
        </svg>
      </div>
      <div style={{
        position: 'absolute', top: SIZE/2-CENTER_R, left: SIZE/2-CENTER_R,
        width: CENTER_R*2, height: CENTER_R*2, borderRadius: '50%', zIndex: 3,
        background: 'radial-gradient(circle at 35% 30%, #22223a, #080812)',
        border: `1.5px solid ${accent}44`, display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: `inset 0 2px 8px rgba(0,0,0,0.95)${isPlaying ? `, 0 0 10px ${accent}44` : ''}`
      }}>
        <span style={{ fontFamily: 'monospace', fontSize: 15, fontWeight: 900, color: accent, textShadow: `0 0 8px ${accent}99` }}>{deck}</span>
      </div>
    </div>
  )
}

// ----- LED Hardware Display -----

function LedDisplay({ value, accent, label, size = 'lg' }: { value: string; accent: string; label: string; size?: 'sm' | 'lg' }) {
  const isLg = size === 'lg'
  return (
    <div style={{
      background: '#030307', border: `1px solid ${accent}1e`, borderRadius: 6,
      padding: isLg ? '5px 12px 4px' : '3px 8px 3px',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1,
      boxShadow: `inset 0 2px 12px rgba(0,0,0,0.95), 0 0 10px ${accent}0a`, flexShrink: 0
    }}>
      <div style={{
        fontFamily: '"Courier New", Courier, monospace', fontWeight: 700, lineHeight: 1,
        fontSize: isLg ? 26 : 16, letterSpacing: '0.1em',
        color: accent, textShadow: `0 0 8px ${accent}aa, 0 0 18px ${accent}33`
      }}>{value || (isLg ? '---' : '--')}</div>
      <div style={{ fontSize: 7, color: '#333355', letterSpacing: '0.16em', fontWeight: 700 }}>{label}</div>
    </div>
  )
}

// ----- Beat LEDs -----

function BeatLEDs({ beat, accent }: { beat: number; accent: string }) {
  return (
    <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexShrink: 0 }}>
      {[1,2,3,4].map(b => {
        const on = b === beat, isBar = b === 1
        return <div key={b} style={{
          width: isBar ? 10 : 7, height: isBar ? 10 : 7, borderRadius: '50%',
          background: on ? (isBar ? accent : accent+'cc') : (isBar ? accent+'1e' : accent+'12'),
          boxShadow: on ? `0 0 ${isBar?12:8}px ${accent}${isBar?'dd':'88'}` : 'none',
          transition: 'background 0.04s, box-shadow 0.04s', flexShrink: 0
        }} />
      })}
    </div>
  )
}

// ----- Hot Cue Pads -----

function HotCuePads({ disabled, currentTime, seekDeck, deck }: {
  disabled: boolean; currentTime: number; seekDeck: (d: 'A'|'B', t: number) => void; deck: 'A'|'B'
}) {
  const [cues, setCues] = useState<(number|null)[]>([null,null,null,null])
  return (
    <div style={{ display: 'flex', gap: 4, flex: 1 }}>
      {HOT_CUE_COLORS.map((color, i) => {
        const has = cues[i] !== null
        return <button key={i} disabled={disabled}
          onClick={() => has ? seekDeck(deck, cues[i]!) : setCues(p => { const n=[...p]; n[i]=currentTime; return n })}
          onContextMenu={e => { e.preventDefault(); if(has) setCues(p => { const n=[...p]; n[i]=null; return n }) }}
          title={has ? `Jump to cue ${i+1} • right-click to clear` : `Set cue ${i+1}`}
          style={{
            flex: 1, height: 28, borderRadius: 5,
            border: `1px solid ${has ? color+'cc' : color+'33'}`,
            background: has ? `linear-gradient(145deg,${color}cc,${color}77)` : 'linear-gradient(145deg,#12121e,#0a0a16)',
            color: has ? '#060610' : color+'aa',
            fontSize: 11, fontWeight: 900, letterSpacing: '0.06em',
            cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.3 : 1,
            boxShadow: has ? `0 0 12px ${color}55, inset 0 1px 0 rgba(255,255,255,0.18)` : 'none',
            transition: 'all 0.1s'
          }}>{i+1}</button>
      })}
    </div>
  )
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
          width: 46, height: 46, borderRadius: '50%',
          background: 'radial-gradient(circle at 33% 28%, #3a3a52, #1e1e2c 45%, #0e0e18)',
          border: `2px solid ${value === 0.5 ? '#2e2e48' : accent + 'cc'}`,
          position: 'relative', cursor: 'ns-resize',
          boxShadow: value === 0.5
            ? '0 3px 10px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.06)'
            : `0 3px 10px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.08), 0 0 12px ${accent}22`,
          userSelect: 'none'
        }}
        onMouseDown={onMouseDown}
      >
        {/* Indicator line with gradient: transparent at base, accent at tip */}
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          width: 2, height: 16,
          background: `linear-gradient(to top, transparent 0%, ${value === 0.5 ? '#5a5a7a' : accent} 100%)`,
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

// ----- Premium Button -----

function PremiumBtn({ onClick, disabled = false, active = false, color, size = 46, children, label }: {
  onClick: () => void; disabled?: boolean; active?: boolean; color: string; size?: number; children: React.ReactNode; label?: string
}) {
  const [pressed, setPressed] = useState(false)
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      style={{
        width: size, height: size, borderRadius: 8,
        border: `1px solid ${active ? color : pressed ? color + '99' : color + '55'}`,
        background: active
          ? `linear-gradient(145deg, ${color}dd, ${color}88)`
          : pressed
            ? `linear-gradient(145deg, #16162a, #0e0e1a)`
            : 'linear-gradient(145deg, #1e1e2a, #12121a)',
        color: active ? '#08080e' : color,
        fontSize: typeof children === 'string' && children.length > 2 ? 11 : 16,
        fontWeight: 700, letterSpacing: '0.04em',
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.3 : 1,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, transition: 'all 0.08s',
        boxShadow: active
          ? `0 0 14px ${color}55, inset 0 1px 0 rgba(255,255,255,0.18), 0 2px 4px rgba(0,0,0,0.8)`
          : pressed
            ? `inset 0 2px 4px rgba(0,0,0,0.9), 0 1px 2px rgba(0,0,0,0.6)`
            : 'inset 0 1px 0 rgba(255,255,255,0.06), inset 0 -1px 0 rgba(0,0,0,0.5), 0 3px 8px rgba(0,0,0,0.7)'
      }}>
      {children}
    </button>
  )
}

// ----- Vertical Tempo Slider (±16%, 0.1% display resolution) -----

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

  // ±16% range, 0.32 coefficient matches audio engine setPitch
  const pct = (value - 0.5) * 32
  const atCenter = Math.abs(pct) < 0.05
  const displayStr = atCenter ? '±0.0%' : `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`
  const capW = 48, capH = 24, trackW = 10

  // Pixel-based cap position — prevents cap from clipping outside container at extremes
  const capTopPx = capH / 2 + (1 - value) * (height - capH)

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

        {/* Tick marks at ±4%, ±8%, ±12% */}
        {[-12, -8, -4, 4, 8, 12].map(t => {
          const pos = (1 - (t / 32 + 0.5)) * 100
          return (
            <div key={t} style={{
              position: 'absolute', right: 2,
              top: `${pos}%`, transform: 'translateY(-50%)',
              width: t % 8 === 0 ? 7 : 5, height: 1,
              background: t % 8 === 0 ? '#4a4a6a' : '#3a3a5a'
            }} />
          )
        })}

        {/* Fader cap — pixel-based to stay within container at extremes */}
        <div style={{
          position: 'absolute',
          left: '50%', top: capTopPx,
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

// ----- Mini Knob (for effects) -----

function MiniKnob({ label, value, onChange, accent, format }: {
  label: string; value: number; onChange: (v: number) => void; accent: string; format?: (v: number) => string
}) {
  const startY = useRef<number | null>(null)
  const startVal = useRef(value)
  const rotation = -135 + value * 270
  const display = format ? format(value) : `${Math.round(value * 100)}%`

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    startY.current = e.clientY; startVal.current = value
    const onMove = (me: MouseEvent) => {
      if (startY.current === null) return
      onChange(Math.max(0, Math.min(1, startVal.current + (startY.current - me.clientY) / 80)))
    }
    const onUp = () => { startY.current = null; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
      <div
        onMouseDown={onMouseDown}
        onDoubleClick={() => onChange(0.5)}
        style={{
          width: 28, height: 28, borderRadius: '50%',
          background: 'radial-gradient(circle at 35% 35%, #222232, #0e0e18)',
          border: `1.5px solid ${accent}66`,
          position: 'relative', cursor: 'ns-resize', userSelect: 'none', flexShrink: 0
        }}
      >
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          width: 1.5, height: 9, background: accent,
          borderRadius: 1, transformOrigin: '50% 100%',
          transform: `translate(-50%, -100%) rotate(${rotation}deg)`
        }} />
      </div>
      <div style={{ fontSize: 8, color: accent + 'cc', fontFamily: 'monospace', textAlign: 'center', minWidth: 28 }}>{display}</div>
      <div style={{ fontSize: 7, color: '#555577', letterSpacing: '0.06em', textAlign: 'center' }}>{label}</div>
    </div>
  )
}

// ----- Effect Card -----

function EffectCard({ label, enabled, onToggle, accent, children }: {
  label: string; enabled: boolean; onToggle: () => void; accent: string; children: React.ReactNode
}) {
  return (
    <div style={{
      flex: 1, background: enabled ? `${accent}0d` : '#0c0c18',
      border: `1px solid ${enabled ? accent + '55' : '#222232'}`,
      borderRadius: 8, padding: '6px 8px',
      display: 'flex', flexDirection: 'column', gap: 5,
      transition: 'border-color 0.15s, background 0.15s'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <div
          onClick={onToggle}
          style={{
            width: 8, height: 8, borderRadius: '50%', cursor: 'pointer', flexShrink: 0,
            background: enabled ? accent : '#2a2a3a',
            boxShadow: enabled ? `0 0 7px ${accent}` : 'none',
            transition: 'all 0.15s'
          }}
        />
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', color: enabled ? accent : '#4a4a6a', transition: 'color 0.15s' }}>
          {label}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 4, justifyContent: 'space-around' }}>
        {children}
      </div>
    </div>
  )
}

// ----- Filter Knob -----

function FilterKnob({ type, value, onChange, accent }: {
  type: 'lp' | 'hp'; value: number; onChange: (v: number) => void; accent: string
}) {
  const startY = useRef<number | null>(null)
  const startVal = useRef(value)
  const isActive = value > 0.02

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    startY.current = e.clientY
    startVal.current = value
    const onMove = (me: MouseEvent) => {
      if (startY.current === null) return
      onChange(Math.max(0, Math.min(1, startVal.current + (startY.current - me.clientY) / 100)))
    }
    const onUp = () => {
      startY.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  // Compute display frequency
  let freqDisplay = 'OFF'
  if (isActive) {
    if (type === 'lp') {
      const f = 20000 * Math.pow(200 / 20000, value)
      freqDisplay = f >= 1000 ? `${(f / 1000).toFixed(1)}k` : `${Math.round(f)}Hz`
    } else {
      const f = 20 * Math.pow(400, value)
      freqDisplay = f >= 1000 ? `${(f / 1000).toFixed(1)}k` : `${Math.round(f)}Hz`
    }
  }

  const rotation = -135 + value * 270

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <div style={{ fontSize: 8, color: '#6666aa', letterSpacing: '0.08em', fontWeight: 700 }}>
        {type === 'lp' ? 'LP' : 'HP'}
      </div>
      <div
        onMouseDown={onMouseDown}
        onDoubleClick={() => onChange(0)}
        title={`${type === 'lp' ? 'Low-pass' : 'High-pass'} filter — double-click to reset`}
        style={{
          width: 36, height: 36, borderRadius: '50%',
          background: isActive
            ? `radial-gradient(circle at 35% 35%, ${accent}44, #12121a)`
            : 'radial-gradient(circle at 35% 35%, #1e1e2e, #0e0e18)',
          border: `2px solid ${isActive ? accent : '#2a2a3a'}`,
          position: 'relative', cursor: 'ns-resize',
          boxShadow: isActive
            ? `0 0 10px ${accent}44, inset 0 1px 0 rgba(255,255,255,0.06)`
            : 'inset 0 1px 0 rgba(255,255,255,0.03)',
          userSelect: 'none', flexShrink: 0,
          transition: 'border-color 0.2s, box-shadow 0.2s'
        }}
      >
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          width: 2, height: 11,
          background: isActive ? accent : '#3a3a5a',
          borderRadius: 1,
          transformOrigin: '50% 100%',
          transform: `translate(-50%, -100%) rotate(${rotation}deg)`,
          transition: 'background 0.2s'
        }} />
      </div>
      <div style={{
        fontSize: 9, fontFamily: 'monospace', fontWeight: 700,
        color: isActive ? accent : '#3a3a5a',
        minWidth: 36, textAlign: 'center',
        transition: 'color 0.2s'
      }}>
        {freqDisplay}
      </div>
    </div>
  )
}

// ----- Nudge Button -----

function NudgeBtn({ deck, direction, audioEngine, disabled }: {
  deck: 'A' | 'B'; direction: 1 | -1;
  audioEngine: { nudgeDeck: (d: 'A' | 'B', dir: 1 | -1) => void; stopNudge: (d: 'A' | 'B') => void }
  disabled: boolean
}) {
  return (
    <button
      onMouseDown={() => audioEngine.nudgeDeck(deck, direction)}
      onMouseUp={() => audioEngine.stopNudge(deck)}
      onMouseLeave={() => audioEngine.stopNudge(deck)}
      disabled={disabled}
      title={direction === -1 ? 'Nudge back (hold)' : 'Nudge forward (hold)'}
      style={{
        width: 32, height: 48, borderRadius: 6,
        border: '1px solid #3a3a5a',
        background: 'linear-gradient(145deg, #1a1a28, #10101a)',
        color: disabled ? '#3a3a5a' : '#8888cc',
        fontSize: 13, fontWeight: 700,
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, userSelect: 'none',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 2px 6px rgba(0,0,0,0.6)'
      }}
    >
      {direction === -1 ? '«' : '»'}
    </button>
  )
}

// ----- Main Deck Component -----

export default function Deck({ deck, audioEngine }: DeckProps) {
  const { playDeck, pauseDeck, cueDeck, seekDeck } = audioEngine
  const deckState = useStore((s) => (deck === 'A' ? s.deckA : s.deckB))
  const accent = ACCENT[deck]
  const bg = BG[deck]

  const [isDragOver, setIsDragOver] = useState(false)
  const [lpfValue, setLpfValue] = useState(0)
  const [hpfValue, setHpfValue] = useState(0)
  const [echo, setEchoState] = useState({ enabled: false, time: 0.33, feedback: 0.47, wet: 0 })
  const [reverb, setReverbState] = useState({ enabled: false, size: 0.4, wet: 0 })
  const [flanger, setFlangerState] = useState({ enabled: false, rate: 0.28, depth: 0.5, wet: 0 })
  const [activeBeatLoop, setActiveBeatLoop] = useState<number | null>(null)

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

    // Background gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, H)
    bgGrad.addColorStop(0, bg)
    bgGrad.addColorStop(1, '#030308')
    ctx.fillStyle = bgGrad
    ctx.fillRect(0, 0, W, H)

    const { waveform, waveformLF, waveformMF, waveformHF } = deckState
    const dur = durationRef.current
    const currentT = currentTimeRef.current

    // Draw beat grid FIRST (before waveform bars)
    if (deckState.bpm > 0 && deckState.beatPhase >= 0 && dur > 0) {
      const effectiveBPM = deckState.bpm * (1.0 + (deckState.pitch - 0.5) * 0.32)
      const beatInterval = 60 / effectiveBPM
      const beatPhase = deckState.beatPhase

      // Find first beat at or after 0
      const firstBeatIndex = Math.ceil(-beatPhase / beatInterval)
      const maxBeats = Math.ceil(dur / beatInterval) + 2

      for (let n = firstBeatIndex; n <= firstBeatIndex + maxBeats; n++) {
        const beatTime = beatPhase + n * beatInterval
        if (beatTime < 0 || beatTime > dur) continue
        const x = Math.floor((beatTime / dur) * W)
        const beatInBar = ((n % 4) + 4) % 4  // 0=bar, 1=beat, 2=half-bar, 3=beat

        if (beatInBar === 0) {
          // Bar line: full height, accent + '44'
          ctx.fillStyle = accent + '44'
          ctx.fillRect(x, 0, 1, H)
          // Bar number label
          const barNum = Math.floor(n / 4) + 1
          ctx.fillStyle = accent + 'aa'
          ctx.font = '9px monospace'
          ctx.fillText(String(barNum), x + 2, 10)
        } else if (beatInBar === 2) {
          // Half-bar line: lower 50%, accent + '1e'
          ctx.fillStyle = accent + '1e'
          ctx.fillRect(x, Math.floor(H * 0.5), 1, Math.ceil(H * 0.5))
        } else {
          // Beat tick: lower 30%, accent + '12'
          ctx.fillStyle = accent + '12'
          ctx.fillRect(x, Math.floor(H * 0.7), 1, Math.ceil(H * 0.3))
        }
      }
    }

    if (waveform && waveform.length > 0) {
      const numPoints = waveform.length
      const progress = dur > 0 ? currentT / dur : 0
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

      // Loop region overlay with IN/OUT labels
      const loopStart = deckState.loopStart
      const loopEnd = deckState.loopEnd
      if (loopEnd > loopStart && dur > 0) {
        const lx1 = (loopStart / dur) * W
        const lx2 = (loopEnd / dur) * W
        ctx.fillStyle = deckState.loopActive ? accent + '22' : accent + '0f'
        ctx.fillRect(lx1, 0, lx2 - lx1, H)
        // IN marker
        ctx.fillStyle = deckState.loopActive ? accent + 'cc' : accent + '55'
        ctx.fillRect(lx1, 0, 2, H)
        // IN label
        ctx.fillStyle = deckState.loopActive ? accent : accent + '88'
        ctx.font = 'bold 9px monospace'
        ctx.fillText('IN', lx1 + 4, H - 4)
        // OUT marker
        ctx.fillStyle = deckState.loopActive ? accent + 'cc' : accent + '55'
        ctx.fillRect(lx2 - 2, 0, 2, H)
        // OUT label
        ctx.fillStyle = deckState.loopActive ? accent : accent + '88'
        ctx.font = 'bold 9px monospace'
        const outLabelW = 24
        ctx.fillText('OUT', Math.max(0, lx2 - outLabelW - 4), H - 4)
      }

      // Playhead
      const playheadX = Math.floor(progress * W)
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(playheadX - 1, 0, 2, H)
      const phGrad = ctx.createLinearGradient(playheadX - 20, 0, playheadX + 20, 0)
      phGrad.addColorStop(0, 'transparent')
      phGrad.addColorStop(0.5, accent + '40')
      phGrad.addColorStop(1, 'transparent')
      ctx.fillStyle = phGrad
      ctx.fillRect(playheadX - 20, 0, 40, H)
    } else {
      ctx.strokeStyle = '#2a2a3a'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(0, H / 2)
      ctx.lineTo(W, H / 2)
      ctx.stroke()
    }

    // Vignette: dark edges
    const vigLeft = ctx.createLinearGradient(0, 0, 40, 0)
    vigLeft.addColorStop(0, 'rgba(2,2,6,0.7)')
    vigLeft.addColorStop(1, 'rgba(2,2,6,0)')
    ctx.fillStyle = vigLeft
    ctx.fillRect(0, 0, 40, H)
    const vigRight = ctx.createLinearGradient(W - 40, 0, W, 0)
    vigRight.addColorStop(0, 'rgba(2,2,6,0)')
    vigRight.addColorStop(1, 'rgba(2,2,6,0.7)')
    ctx.fillStyle = vigRight
    ctx.fillRect(W - 40, 0, 40, H)
  }, [deckState.waveform, deckState.waveformLF, deckState.waveformMF, deckState.waveformHF, deckState.loopActive, deckState.loopStart, deckState.loopEnd, deckState.bpm, deckState.beatPhase, deckState.pitch, accent, bg])

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

  // BPM adjusts with tempo: ±16% range, 0.32 coefficient matches audio engine
  const playbackRate = 1.0 + (deckState.pitch - 0.5) * 0.32
  const rawBPM = deckState.bpm > 0 ? deckState.bpm * playbackRate : 0
  const displayBPM = rawBPM > 0 ? Math.round(rawBPM).toString() : null

  // Bar:Beat position (e.g. "3.2" = bar 3, beat 2)
  const { barBeatDisplay, currentBeat } = (() => {
    if (deckState.bpm <= 0 || deckState.beatPhase < 0) return { barBeatDisplay: null, currentBeat: 0 }
    const effectiveBPM = deckState.bpm * playbackRate
    const beatInterval = 60 / effectiveBPM
    const beatsFromPhase = (deckState.currentTime - deckState.beatPhase) / beatInterval
    const totalBeats = Math.floor(beatsFromPhase)
    const bar = Math.floor(totalBeats / 4) + 1
    const beat = ((totalBeats % 4) + 4) % 4 + 1
    return { barBeatDisplay: `${bar}.${beat}`, currentBeat: beat }
  })()

  const remaining = Math.max(0, deckState.duration - deckState.currentTime)

  const otherDeckBPM = useStore((s) => (deck === 'A' ? s.deckB : s.deckA).bpm)

  const deckPlayingClass = deckState.isPlaying ? (deck === 'A' ? 'deck-playing-a' : 'deck-playing-b') : undefined
  const ledStripClass = deckState.isPlaying ? (deck === 'A' ? 'led-strip-playing-a' : 'led-strip-playing-b') : undefined

  // shared art panel
  const artPanel = (
    <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
      <div style={{ background: accent, color: '#060610', borderRadius: 5, padding: '2px 10px', fontSize: 11, fontWeight: 900, letterSpacing: '0.12em', alignSelf: 'stretch', textAlign: 'center' }}>
        DECK {deck}
      </div>
      <div style={{ width: 64, height: 64, borderRadius: 8, overflow: 'hidden', border: `1px solid ${accent}44`, background: '#06060e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {deckState.albumArt
          ? <img src={deckState.albumArt} alt="art" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <span style={{ fontSize: 28, fontWeight: 900, color: accent+'28', fontFamily: 'Georgia,serif', userSelect: 'none' }}>♫</span>
        }
      </div>
    </div>
  )

  // shared LED display group
  const displayGroup = (
    <div style={{ display: 'flex', gap: 5, alignItems: 'stretch', flexShrink: 0 }}>
      <LedDisplay value={displayBPM || '---'} accent={accent} label="BPM" size="lg" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <LedDisplay value={formatTime(deckState.currentTime)} accent={accent} label="ELAPSED" size="sm" />
        <LedDisplay value={barBeatDisplay || '-.-'} accent={accent} label="BAR.BEAT" size="sm" />
      </div>
    </div>
  )

  return (
    <div className={deckPlayingClass} style={{
      background: 'linear-gradient(180deg, #0e0e1c 0%, #09090f 100%)',
      border: `1px solid ${deckState.isPlaying ? accent + '44' : '#181826'}`,
      borderRadius: 14, padding: '0 0 10px 0',
      display: 'flex', flexDirection: 'column', flex: 1, gap: 0,
      overflow: 'hidden',
      boxShadow: deckState.isPlaying ? `0 0 28px ${accent}1a, 0 4px 20px rgba(0,0,0,0.8)` : '0 4px 20px rgba(0,0,0,0.7)'
    }}>
      {/* ── LED TOP STRIP ── */}
      <div className={ledStripClass} style={{
        height: deckState.isPlaying ? 3 : 2,
        background: deckState.isPlaying
          ? `linear-gradient(90deg, transparent 0%, ${accent}55 10%, ${accent} 50%, ${accent}55 90%, transparent 100%)`
          : `linear-gradient(90deg, transparent, #1e1e2e 50%, transparent)`,
        borderRadius: '14px 14px 0 0',
        boxShadow: deckState.isPlaying ? `0 0 14px ${accent}88` : 'none',
        marginBottom: 8, flexShrink: 0, transition: 'height 0.3s'
      }} />

      <div style={{ padding: '0 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>

      {/* ── ROW 1: Info ── */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {deck === 'A' && artPanel}
        {/* Track drop zone */}
        <div
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
          onDragLeave={() => setIsDragOver(false)}
          style={{
            flex: 1, minWidth: 0,
            border: `1px dashed ${isDragOver ? accent : (deckState.track ? accent+'22' : '#2a2a3e')}`,
            borderRadius: 8, padding: '8px 12px',
            background: isDragOver ? accent+'0e' : (deckState.track ? accent+'06' : '#0a0a14'),
            transition: 'all 0.15s', display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: 74
          }}
        >
          {deckState.track ? (
            <>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#eaeaf8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.35 }}>
                {deckState.track.title ?? deckState.track.name}
              </div>
              {deckState.track.artist && (
                <div style={{ fontSize: 11, color: '#6666aa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 3 }}>
                  {deckState.track.artist}
                </div>
              )}
            </>
          ) : (
            <div style={{ fontSize: 12, color: isDragOver ? accent : '#2e2e48', textAlign: 'center' }}>
              Drop track → Deck {deck}
            </div>
          )}
        </div>
        {displayGroup}
        {deck === 'B' && artPanel}
      </div>

      {/* ── ROW 2: Waveform ── */}
      <canvas
        ref={topCanvasRef}
        width={1200} height={220}
        style={{ width: '100%', height: 110, borderRadius: 7, cursor: deckState.isLoaded ? 'crosshair' : 'default', display: 'block', border: `1px solid ${accent}18` }}
        onClick={handleSeek}
      />

      {/* ── ROW 3: Scrubber ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'monospace', color: accent, letterSpacing: 1, flexShrink: 0 }}>{formatTime(deckState.currentTime)}</span>
        <Scrubber value={deckState.currentTime} max={deckState.duration} onChange={(v) => seekDeck(deck, v)} accent={accent} />
        <span style={{ fontSize: 11, color: '#3a3a5a', fontFamily: 'monospace', flexShrink: 0 }}>-{formatTime(remaining)}</span>
      </div>

      {/* ── ROW 4: Jog Wheel + Tempo Slider + Controls ── */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        {deck === 'A' && <JogWheel isPlaying={deckState.isPlaying} currentTime={deckState.currentTime} accent={accent} deck={deck} />}
        <VerticalTempoSlider value={deckState.pitch} onChange={(v) => audioEngine.setPitch(deck, v)} accent={accent} height={118} />
        {/* Right column: beat LEDs, hot cues, filters */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
          {/* Beat LEDs + Hot cues */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <BeatLEDs beat={currentBeat} accent={accent} />
            <HotCuePads disabled={!deckState.isLoaded} currentTime={deckState.currentTime} seekDeck={seekDeck} deck={deck} />
          </div>
          {/* Separator */}
          <div style={{ height: 1, background: `${accent}14`, borderRadius: 1 }} />
          {/* Filters */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 8, color: '#333355', letterSpacing: '0.1em', fontWeight: 700, flexShrink: 0 }}>FILTER</span>
            <FilterKnob type="lp" value={lpfValue} onChange={v => { setLpfValue(v); audioEngine.setFilter(deck, 'lp', v) }} accent={accent} />
            <FilterKnob type="hp" value={hpfValue} onChange={v => { setHpfValue(v); audioEngine.setFilter(deck, 'hp', v) }} accent={accent} />
          </div>
        </div>
        {deck === 'B' && <JogWheel isPlaying={deckState.isPlaying} currentTime={deckState.currentTime} accent={accent} deck={deck} />}
      </div>

      {/* ── ROW 3: Effects ── */}
      <div style={{ display: 'flex', gap: 6 }}>
        <EffectCard
          label="ECHO" enabled={echo.enabled} accent={accent}
          onToggle={() => {
            const next = !echo.enabled
            const wet = next ? 0.45 : 0
            setEchoState(s => ({ ...s, enabled: next, wet }))
            audioEngine.setEcho(deck, { wet })
          }}
        >
          <MiniKnob label="TIME" value={echo.time} accent={accent}
            format={v => `${(0.05 + v * 0.75).toFixed(2)}s`}
            onChange={v => { setEchoState(s => ({ ...s, time: v })); audioEngine.setEcho(deck, { time: v }) }} />
          <MiniKnob label="FDBK" value={echo.feedback} accent={accent}
            onChange={v => { setEchoState(s => ({ ...s, feedback: v })); audioEngine.setEcho(deck, { feedback: v }) }} />
          <MiniKnob label="WET" value={echo.wet} accent={accent}
            onChange={v => { setEchoState(s => ({ ...s, wet: v, enabled: v > 0.01 })); audioEngine.setEcho(deck, { wet: v }) }} />
        </EffectCard>

        <EffectCard
          label="REVERB" enabled={reverb.enabled} accent={accent}
          onToggle={() => {
            const next = !reverb.enabled
            const wet = next ? 0.4 : 0
            setReverbState(s => ({ ...s, enabled: next, wet }))
            audioEngine.setReverb(deck, { wet })
          }}
        >
          <MiniKnob label="SIZE" value={reverb.size} accent={accent}
            onChange={v => { setReverbState(s => ({ ...s, size: v })); audioEngine.setReverb(deck, { size: v }) }} />
          <MiniKnob label="WET" value={reverb.wet} accent={accent}
            onChange={v => { setReverbState(s => ({ ...s, wet: v, enabled: v > 0.01 })); audioEngine.setReverb(deck, { wet: v }) }} />
        </EffectCard>

        <EffectCard
          label="FLANGER" enabled={flanger.enabled} accent={accent}
          onToggle={() => {
            const next = !flanger.enabled
            const wet = next ? 0.5 : 0
            setFlangerState(s => ({ ...s, enabled: next, wet }))
            audioEngine.setFlanger(deck, { wet })
          }}
        >
          <MiniKnob label="RATE" value={flanger.rate} accent={accent}
            format={v => `${(0.05 + v * 7.95).toFixed(1)}Hz`}
            onChange={v => { setFlangerState(s => ({ ...s, rate: v })); audioEngine.setFlanger(deck, { rate: v }) }} />
          <MiniKnob label="DEPTH" value={flanger.depth} accent={accent}
            onChange={v => { setFlangerState(s => ({ ...s, depth: v })); audioEngine.setFlanger(deck, { depth: v }) }} />
          <MiniKnob label="WET" value={flanger.wet} accent={accent}
            onChange={v => { setFlangerState(s => ({ ...s, wet: v, enabled: v > 0.01 })); audioEngine.setFlanger(deck, { wet: v }) }} />
        </EffectCard>
      </div>

      {/* ── ROW 4: Loop ── */}
      {(() => {
        // Beat loop sizes: [label, beats] — beats = number of quarter-note beats
        const beatLoops: [string, number][] = [
          ['1/8', 0.5], ['1/4', 1], ['1/2', 2], ['1', 4],
          ['2', 8], ['4', 16], ['8', 32], ['16', 64]
        ]
        const hasLoop = deckState.loopEnd > deckState.loopStart
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {/* Beat loop buttons */}
            <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
              <div style={{ fontSize: 8, color: '#444466', letterSpacing: '0.1em', fontWeight: 700, flexShrink: 0, width: 28 }}>LOOP</div>
              {beatLoops.map(([label, beats]) => {
                const isActive = deckState.loopActive && activeBeatLoop === beats
                return (
                  <button
                    key={label}
                    onClick={() => {
                      if (!deckState.isLoaded) return
                      if (isActive) {
                        audioEngine.exitLoop(deck)
                        setActiveBeatLoop(null)
                      } else {
                        audioEngine.setBeatLoop(deck, beats)
                        setActiveBeatLoop(beats)
                      }
                    }}
                    disabled={!deckState.isLoaded}
                    style={{
                      flex: 1, height: 26, borderRadius: 5,
                      border: `1px solid ${isActive ? accent : accent + '33'}`,
                      background: isActive
                        ? `linear-gradient(145deg, ${accent}cc, ${accent}77)`
                        : 'linear-gradient(145deg, #1a1a28, #10101a)',
                      color: isActive ? '#080810' : accent + 'bb',
                      fontSize: 10, fontWeight: 700,
                      cursor: deckState.isLoaded ? 'pointer' : 'not-allowed',
                      opacity: deckState.isLoaded ? 1 : 0.3,
                      boxShadow: isActive ? `0 0 8px ${accent}44` : 'none',
                      transition: 'all 0.1s'
                    }}
                  >
                    {label}
                  </button>
                )
              })}
            </div>

            {/* IN / OUT / LOOP / RELOOP / ½ / ×2 */}
            <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
              <div style={{ width: 28, flexShrink: 0 }} />
              {/* IN */}
              <button
                onClick={() => audioEngine.setLoopIn(deck)}
                disabled={!deckState.isLoaded}
                title="Set loop in point"
                style={{
                  flex: 1, height: 24, borderRadius: 5,
                  border: `1px solid #886633`,
                  background: 'linear-gradient(145deg, #1e1a10, #12100a)',
                  color: '#cc9944', fontSize: 9, fontWeight: 700,
                  cursor: deckState.isLoaded ? 'pointer' : 'not-allowed',
                  opacity: deckState.isLoaded ? 1 : 0.3
                }}
              >IN</button>

              {/* OUT */}
              <button
                onClick={() => audioEngine.setLoopOut(deck)}
                disabled={!deckState.isLoaded}
                title="Set loop out point"
                style={{
                  flex: 1, height: 24, borderRadius: 5,
                  border: `1px solid #886633`,
                  background: 'linear-gradient(145deg, #1e1a10, #12100a)',
                  color: '#cc9944', fontSize: 9, fontWeight: 700,
                  cursor: deckState.isLoaded ? 'pointer' : 'not-allowed',
                  opacity: deckState.isLoaded ? 1 : 0.3
                }}
              >OUT</button>

              {/* LOOP toggle */}
              <button
                onClick={() => {
                  if (!hasLoop) return
                  audioEngine.toggleLoop(deck)
                  if (deckState.loopActive) setActiveBeatLoop(null)
                }}
                disabled={!deckState.isLoaded || !hasLoop}
                title={deckState.loopActive ? 'Exit loop' : 'Enable loop'}
                style={{
                  flex: 1.3, height: 24, borderRadius: 5,
                  border: `1px solid ${deckState.loopActive ? accent : accent + '44'}`,
                  background: deckState.loopActive
                    ? `linear-gradient(145deg, ${accent}cc, ${accent}77)`
                    : 'linear-gradient(145deg, #1a1a28, #10101a)',
                  color: deckState.loopActive ? '#080810' : accent + '99',
                  fontSize: 9, fontWeight: 700,
                  cursor: (deckState.isLoaded && hasLoop) ? 'pointer' : 'not-allowed',
                  opacity: (deckState.isLoaded && hasLoop) ? 1 : 0.3,
                  boxShadow: deckState.loopActive ? `0 0 8px ${accent}44` : 'none',
                  transition: 'all 0.1s'
                }}
              >LOOP</button>

              {/* RELOOP */}
              <button
                onClick={() => { audioEngine.reloop(deck); setActiveBeatLoop(activeBeatLoop) }}
                disabled={!deckState.isLoaded || !hasLoop}
                title="Jump to loop start"
                style={{
                  flex: 1.3, height: 24, borderRadius: 5,
                  border: `1px solid #558866`,
                  background: 'linear-gradient(145deg, #101a14, #0a100e)',
                  color: '#44bb77', fontSize: 9, fontWeight: 700,
                  cursor: (deckState.isLoaded && hasLoop) ? 'pointer' : 'not-allowed',
                  opacity: (deckState.isLoaded && hasLoop) ? 1 : 0.3
                }}
              >RELOOP</button>

              {/* ½ */}
              <button
                onClick={() => audioEngine.loopHalve(deck)}
                disabled={!deckState.isLoaded || !hasLoop}
                title="Halve loop length"
                style={{
                  flex: 1, height: 24, borderRadius: 5,
                  border: `1px solid #445577`,
                  background: 'linear-gradient(145deg, #10121e, #0a0c14)',
                  color: '#6688cc', fontSize: 9, fontWeight: 700,
                  cursor: (deckState.isLoaded && hasLoop) ? 'pointer' : 'not-allowed',
                  opacity: (deckState.isLoaded && hasLoop) ? 1 : 0.3
                }}
              >½</button>

              {/* ×2 */}
              <button
                onClick={() => audioEngine.loopDouble(deck)}
                disabled={!deckState.isLoaded || !hasLoop}
                title="Double loop length"
                style={{
                  flex: 1, height: 24, borderRadius: 5,
                  border: `1px solid #445577`,
                  background: 'linear-gradient(145deg, #10121e, #0a0c14)',
                  color: '#6688cc', fontSize: 9, fontWeight: 700,
                  cursor: (deckState.isLoaded && hasLoop) ? 'pointer' : 'not-allowed',
                  opacity: (deckState.isLoaded && hasLoop) ? 1 : 0.3
                }}
              >×2</button>
            </div>

            {/* Loop point display */}
            {hasLoop && (
              <div style={{ display: 'flex', gap: 6, paddingLeft: 31, fontSize: 9, color: '#555577', fontFamily: 'monospace' }}>
                <span style={{ color: '#cc9944' }}>IN {formatTime(deckState.loopStart)}</span>
                <span>→</span>
                <span style={{ color: '#cc9944' }}>OUT {formatTime(deckState.loopEnd)}</span>
                <span style={{ color: accent + '88' }}>({(deckState.loopEnd - deckState.loopStart).toFixed(2)}s)</span>
              </div>
            )}
          </div>
        )
      })()}

      {/* ── TRANSPORT ── */}
      <div style={{ display: 'flex', gap: 5, alignItems: 'center', justifyContent: deck === 'A' ? 'flex-start' : 'flex-end', paddingTop: 4 }}>
        <NudgeBtn deck={deck} direction={-1} audioEngine={audioEngine} disabled={!deckState.isPlaying} />
        {deck === 'A' && <>
          <PremiumBtn onClick={() => cueDeck(deck)} disabled={!deckState.isLoaded} color="#ddbb00" size={48} label="CUE">CUE</PremiumBtn>
          <PremiumBtn onClick={deckState.isPlaying ? () => pauseDeck(deck) : () => playDeck(deck)} disabled={!deckState.isLoaded} active={deckState.isPlaying} color={accent} size={52} label={deckState.isPlaying ? 'Pause' : 'Play'}>{deckState.isPlaying ? '⏸' : '▶'}</PremiumBtn>
          <PremiumBtn onClick={() => { pauseDeck(deck); seekDeck(deck, 0) }} disabled={!deckState.isLoaded} color="#445566" size={48} label="Stop">■</PremiumBtn>
          <PremiumBtn onClick={() => audioEngine.beatSync(deck)} disabled={!deckState.isLoaded || !deckState.bpm || !otherDeckBPM} color="#9966ff" size={48} label="Beat Sync">SYNC</PremiumBtn>
        </>}
        {deck === 'B' && <>
          <PremiumBtn onClick={() => audioEngine.beatSync(deck)} disabled={!deckState.isLoaded || !deckState.bpm || !otherDeckBPM} color="#9966ff" size={48} label="Beat Sync">SYNC</PremiumBtn>
          <PremiumBtn onClick={() => { pauseDeck(deck); seekDeck(deck, 0) }} disabled={!deckState.isLoaded} color="#445566" size={48} label="Stop">■</PremiumBtn>
          <PremiumBtn onClick={deckState.isPlaying ? () => pauseDeck(deck) : () => playDeck(deck)} disabled={!deckState.isLoaded} active={deckState.isPlaying} color={accent} size={52} label={deckState.isPlaying ? 'Pause' : 'Play'}>{deckState.isPlaying ? '⏸' : '▶'}</PremiumBtn>
          <PremiumBtn onClick={() => cueDeck(deck)} disabled={!deckState.isLoaded} color="#ddbb00" size={48} label="CUE">CUE</PremiumBtn>
        </>}
        <NudgeBtn deck={deck} direction={1} audioEngine={audioEngine} disabled={!deckState.isPlaying} />
      </div>

      </div>
    </div>
  )
}
