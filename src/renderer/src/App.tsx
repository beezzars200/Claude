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
          padding: '8px 16px',
          background: '#0a0a10',
          borderBottom: '1px solid #2a2a3a',
          flexShrink: 0,
          height: 48
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #00ff88, #0088ff)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14
            }}
          >
            📻
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, letterSpacing: '0.05em', color: '#e0e0f0' }}>
              RADIO STUDIO
            </div>
            <div style={{ fontSize: 10, color: '#5555aa', letterSpacing: '0.1em' }}>
              PROFESSIONAL BROADCAST
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#5555aa' }}>
          <span>v1.0.0</span>
        </div>
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
            deckAWave={{ waveform: deckA.waveform, waveformLF: deckA.waveformLF, waveformMF: deckA.waveformMF, waveformHF: deckA.waveformHF, currentTime: deckA.currentTime, duration: deckA.duration }}
            deckBWave={{ waveform: deckB.waveform, waveformLF: deckB.waveformLF, waveformMF: deckB.waveformMF, waveformHF: deckB.waveformHF, currentTime: deckB.currentTime, duration: deckB.duration }}
          />
        </div>

        {/* Deck B */}
        <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <Deck deck="B" audioEngine={audioEngine} />
        </div>
      </div>

      {/* Bottom section: Library / File Browser — full width */}
      <div style={{ flex: '0 0 300px', padding: '0 8px 8px 8px', minHeight: 0 }}>
        <Library audioEngine={audioEngine} />
      </div>
    </div>
  )
}
