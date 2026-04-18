import React from 'react'
import { useStore } from './store/useStore'
import { useAudioEngine } from './hooks/useAudioEngine'
import Deck from './components/Deck'
import Mixer from './components/Mixer'
import Library from './components/Library'

export default function App() {
  const { deckA, deckB } = useStore()
  const audioEngine = useAudioEngine()

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        background: '#0f0f14',
        overflow: 'hidden'
      }}
    >
      {/* Header */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 20px',
          background: 'linear-gradient(90deg, #06060e 0%, #0a0a16 50%, #06060e 100%)',
          borderBottom: '1px solid #1a1a2a',
          flexShrink: 0,
          height: 44
        }}
      >
        {/* Left: Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 30, height: 30, borderRadius: '50%',
            background: 'linear-gradient(135deg, #00ff99 0%, #0088ff 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 12px rgba(0,200,140,0.5)',
            fontSize: 15, flexShrink: 0
          }}>📻</div>
          <div>
            <div style={{ fontWeight: 900, fontSize: 14, letterSpacing: '0.18em', color: '#f0f0ff', lineHeight: 1 }}>RADIO STUDIO</div>
            <div style={{ fontSize: 9, color: '#333366', letterSpacing: '0.22em', marginTop: 1 }}>PROFESSIONAL BROADCAST</div>
          </div>
        </div>

        {/* Center: Deck A/B status pills */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {[{d: deckA, c: '#00ff99', label: 'A'}, {d: deckB, c: '#0099ff', label: 'B'}].map(({d, c, label}) => (
            <div key={label} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: d.isPlaying ? c+'18' : '#0c0c18',
              border: `1px solid ${d.isPlaying ? c+'55' : '#1e1e2e'}`,
              borderRadius: 20, padding: '3px 10px', transition: 'all 0.3s'
            }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: d.isPlaying ? c : '#2a2a3a', boxShadow: d.isPlaying ? `0 0 6px ${c}` : 'none', transition: 'all 0.3s' }} />
              <span style={{ fontSize: 10, fontWeight: 700, color: d.isPlaying ? c : '#2a2a4a', letterSpacing: '0.1em' }}>DECK {label}</span>
              {d.bpm > 0 && <span style={{ fontSize: 9, color: d.isPlaying ? c+'88' : '#1e1e3a', fontFamily: 'monospace' }}>{Math.round(d.bpm)}</span>}
            </div>
          ))}
        </div>

        {/* Right: Version */}
        <div style={{ fontSize: 10, color: '#22224a', letterSpacing: '0.1em' }}>v1.0.0</div>
      </header>

      {/* Top section: Decks + Mixer */}
      <div
        style={{
          display: 'flex',
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
          padding: '8px 8px 4px 8px',
          gap: 8,
          alignItems: 'stretch'
        }}
      >
        {/* Deck A */}
        <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <Deck deck="A" audioEngine={audioEngine} />
        </div>

        {/* Mixer */}
        <div style={{ flex: '0 0 280px', display: 'flex', flexDirection: 'column' }}>
          <Mixer
            audioEngine={audioEngine}
            getAnalyserData={audioEngine.getAnalyserData}
            setEQ={audioEngine.setEQ}
            deckAEQ={{ low: deckA.eqLow, mid: deckA.eqMid, high: deckA.eqHigh }}
            deckBEQ={{ low: deckB.eqLow, mid: deckB.eqMid, high: deckB.eqHigh }}
            deckAVolume={deckA.volume}
            deckBVolume={deckB.volume}
            deckAWave={{ waveform: deckA.waveform, waveformLF: deckA.waveformLF, waveformMF: deckA.waveformMF, waveformHF: deckA.waveformHF, currentTime: deckA.currentTime, duration: deckA.duration, bpm: deckA.bpm, beatPhase: deckA.beatPhase, pitch: deckA.pitch }}
            deckBWave={{ waveform: deckB.waveform, waveformLF: deckB.waveformLF, waveformMF: deckB.waveformMF, waveformHF: deckB.waveformHF, currentTime: deckB.currentTime, duration: deckB.duration, bpm: deckB.bpm, beatPhase: deckB.beatPhase, pitch: deckB.pitch }}
          />
        </div>

        {/* Deck B */}
        <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <Deck deck="B" audioEngine={audioEngine} />
        </div>
      </div>

      {/* Bottom section: Library */}
      <div style={{ flex: '0 0 260px', padding: '0 8px 8px 8px', minHeight: 0 }}>
        <Library audioEngine={audioEngine} />
      </div>
    </div>
  )
}
