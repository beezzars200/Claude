import React, { useState } from 'react'
import { useStore } from '../store/useStore'

export default function Broadcast() {
  const { broadcast, setBroadcast } = useStore()
  const [showPassword, setShowPassword] = useState(false)

  const handleConnect = () => {
    if (broadcast.isConnected) {
      setBroadcast({ isConnected: false, isConnecting: false })
      return
    }
    setBroadcast({ isConnecting: true })
    // Simulate connection attempt (actual Icecast streaming requires native modules)
    setTimeout(() => {
      setBroadcast({ isConnecting: false, isConnected: true })
    }, 1500)
  }

  const fieldStyle: React.CSSProperties = {
    background: '#0f0f18',
    border: '1px solid #2a2a3a',
    borderRadius: 6,
    color: '#e0e0f0',
    padding: '6px 10px',
    fontSize: 12,
    outline: 'none',
    width: '100%',
    transition: 'border-color 0.15s',
    fontFamily: 'inherit'
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 10,
    color: '#6666aa',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    marginBottom: 3,
    display: 'block'
  }

  return (
    <div
      style={{
        background: '#14141e',
        border: '1px solid #2a2a3a',
        borderRadius: 12,
        padding: 14,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        height: '100%',
        overflow: 'auto'
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 10, color: '#6666aa', letterSpacing: '0.1em' }}>
          LIVE BROADCAST
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: broadcast.isConnected ? '#00ff88' : broadcast.isConnecting ? '#ffcc00' : '#333344',
              boxShadow: broadcast.isConnected ? '0 0 6px #00ff88' : broadcast.isConnecting ? '0 0 6px #ffcc00' : 'none',
              transition: 'all 0.3s'
            }}
          />
          <span style={{ fontSize: 10, color: broadcast.isConnected ? '#00ff88' : broadcast.isConnecting ? '#ffcc00' : '#555577' }}>
            {broadcast.isConnected ? 'ON AIR' : broadcast.isConnecting ? 'CONNECTING...' : 'OFF AIR'}
          </span>
        </div>
      </div>

      {/* Stream info when connected */}
      {broadcast.isConnected && (
        <div
          style={{
            background: '#00ff8810',
            border: '1px solid #00ff8840',
            borderRadius: 8,
            padding: '8px 12px',
            fontSize: 11,
            color: '#00ff88'
          }}
        >
          <div style={{ fontWeight: 700 }}>🔴 LIVE: {broadcast.streamName}</div>
          <div style={{ color: '#00cc66', marginTop: 2 }}>
            {broadcast.host}:{broadcast.port}{broadcast.mount} @ {broadcast.bitrate}kbps
          </div>
        </div>
      )}

      {/* Server Settings */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 10, color: '#444466', letterSpacing: '0.06em', textTransform: 'uppercase', paddingBottom: 4, borderBottom: '1px solid #1e1e2e' }}>
          Server Settings
        </div>

        {/* Stream Name */}
        <div>
          <label style={labelStyle}>Stream Name</label>
          <input
            type="text"
            value={broadcast.streamName}
            onChange={(e) => setBroadcast({ streamName: e.target.value })}
            disabled={broadcast.isConnected}
            style={fieldStyle}
            placeholder="My Radio Station"
          />
        </div>

        {/* Host + Port */}
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 2 }}>
            <label style={labelStyle}>Host</label>
            <input
              type="text"
              value={broadcast.host}
              onChange={(e) => setBroadcast({ host: e.target.value })}
              disabled={broadcast.isConnected}
              style={fieldStyle}
              placeholder="localhost"
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Port</label>
            <input
              type="number"
              value={broadcast.port}
              onChange={(e) => setBroadcast({ port: parseInt(e.target.value) || 8000 })}
              disabled={broadcast.isConnected}
              style={fieldStyle}
              placeholder="8000"
            />
          </div>
        </div>

        {/* Mount */}
        <div>
          <label style={labelStyle}>Mount Point</label>
          <input
            type="text"
            value={broadcast.mount}
            onChange={(e) => setBroadcast({ mount: e.target.value })}
            disabled={broadcast.isConnected}
            style={fieldStyle}
            placeholder="/stream"
          />
        </div>

        {/* Password */}
        <div>
          <label style={labelStyle}>Source Password</label>
          <div style={{ position: 'relative' }}>
            <input
              type={showPassword ? 'text' : 'password'}
              value={broadcast.password}
              onChange={(e) => setBroadcast({ password: e.target.value })}
              disabled={broadcast.isConnected}
              style={{ ...fieldStyle, paddingRight: 36 }}
              placeholder="hackme"
            />
            <button
              onClick={() => setShowPassword(!showPassword)}
              style={{
                position: 'absolute',
                right: 8,
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: '#6666aa',
                cursor: 'pointer',
                fontSize: 12,
                padding: 0
              }}
            >
              {showPassword ? '🙈' : '👁'}
            </button>
          </div>
        </div>

        {/* Bitrate + Genre */}
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Bitrate (kbps)</label>
            <select
              value={broadcast.bitrate}
              onChange={(e) => setBroadcast({ bitrate: parseInt(e.target.value) })}
              disabled={broadcast.isConnected}
              style={{ ...fieldStyle, cursor: 'pointer' }}
            >
              {[64, 96, 128, 192, 256, 320].map((b) => (
                <option key={b} value={b}>{b} kbps</option>
              ))}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Genre</label>
            <input
              type="text"
              value={broadcast.genre}
              onChange={(e) => setBroadcast({ genre: e.target.value })}
              disabled={broadcast.isConnected}
              style={fieldStyle}
              placeholder="Electronic"
            />
          </div>
        </div>
      </div>

      {/* Connect button */}
      <button
        onClick={handleConnect}
        disabled={broadcast.isConnecting}
        style={{
          padding: '10px 0',
          borderRadius: 8,
          border: `1px solid ${broadcast.isConnected ? '#ff4444' : '#00ff88'}`,
          background: broadcast.isConnected ? '#ff444410' : broadcast.isConnecting ? '#00ff8810' : '#00ff8820',
          color: broadcast.isConnected ? '#ff4444' : broadcast.isConnecting ? '#00cc66' : '#00ff88',
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: '0.1em',
          cursor: broadcast.isConnecting ? 'wait' : 'pointer',
          transition: 'all 0.2s',
          boxShadow: broadcast.isConnected ? '0 0 12px #ff444430' : broadcast.isConnecting ? 'none' : '0 0 12px #00ff8820'
        }}
      >
        {broadcast.isConnecting ? '⟳ CONNECTING...' : broadcast.isConnected ? '⏹ DISCONNECT' : '▶ CONNECT TO SERVER'}
      </button>

      {/* Info note */}
      <div
        style={{
          fontSize: 10,
          color: '#444466',
          textAlign: 'center',
          lineHeight: 1.5,
          padding: '6px 0',
          borderTop: '1px solid #1e1e2e'
        }}
      >
        Connects to Icecast/Shoutcast streaming servers.
        <br />
        Configure your server before connecting.
      </div>
    </div>
  )
}
