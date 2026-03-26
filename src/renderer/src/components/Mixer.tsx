import React, { useRef } from 'react'
import { useStore } from '../store/useStore'

interface MixerProps {
  audioEngine: {
    updateCrossfader: (value: number) => void
    updateMasterVolume: (value: number) => void
  }
}

function VUMeter({ level, color }: { level: number; color: string }) {
  const bars = 12
  const lit = Math.round(level * bars)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
      {Array.from({ length: bars }, (_, i) => {
        const idx = bars - 1 - i
        const isLit = idx < lit
        const isRed = idx >= bars - 2
        const isYellow = idx >= bars - 4 && idx < bars - 2
        const barColor = isLit ? (isRed ? '#ff3366' : isYellow ? '#ffcc00' : color) : '#1e1e2a'
        return (
          <div
            key={i}
            style={{
              width: 10,
              height: 4,
              borderRadius: 1,
              background: barColor,
              boxShadow: isLit && !isRed && !isYellow ? `0 0 4px ${color}60` : 'none',
              transition: 'background 0.05s'
            }}
          />
        )
      })}
    </div>
  )
}

export default function Mixer({ audioEngine }: MixerProps) {
  const { updateCrossfader, updateMasterVolume } = audioEngine
  const { crossfader, masterVolume, deckA, deckB } = useStore()

  // Simple VU level estimate from volume + play state
  const levelA = deckA.isPlaying ? deckA.volume * 0.85 : 0
  const levelB = deckB.isPlaying ? deckB.volume * 0.85 : 0

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

      {/* VU Meters */}
      <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'flex-end', gap: 6 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <VUMeter level={levelA} color="#00ff88" />
          <div style={{ fontSize: 9, color: '#00ff88', letterSpacing: '0.06em' }}>A</div>
        </div>

        {/* Master Volume */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <div style={{ fontSize: 9, color: '#8888aa', letterSpacing: '0.06em' }}>MST</div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={masterVolume}
            onChange={(e) => updateMasterVolume(parseFloat(e.target.value))}
            style={{
              writingMode: 'vertical-lr' as const,
              direction: 'rtl' as const,
              height: 90,
              width: 20,
              accentColor: '#ffffff',
              cursor: 'pointer'
            } as React.CSSProperties}
          />
          <div style={{ fontSize: 9, color: '#e0e0f0' }}>{Math.round(masterVolume * 100)}%</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <VUMeter level={levelB} color="#0088ff" />
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
        <div style={{ position: 'relative' }}>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={crossfader}
            onChange={(e) => updateCrossfader(parseFloat(e.target.value))}
            style={{
              width: '100%',
              accentColor: crossfader < 0.5 ? '#00ff88' : crossfader > 0.5 ? '#0088ff' : '#ffffff',
              cursor: 'pointer'
            }}
          />
          {/* Center marker */}
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 1,
              height: 12,
              background: '#3a3a5a',
              pointerEvents: 'none'
            }}
          />
        </div>
        <div style={{ textAlign: 'center', fontSize: 10, color: '#6666aa' }}>
          {crossPercent < 50 ? `A ${100 - crossPercent * 2}%` : crossPercent > 50 ? `B ${(crossPercent - 50) * 2}%` : 'CENTER'}
        </div>
      </div>
    </div>
  )
}
