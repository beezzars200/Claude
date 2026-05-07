import { useRef, useEffect, useCallback, useState } from 'react'
import GlobeGL from 'react-globe.gl'
import type { ServiceProvider } from '../types'

interface GlobePoint {
  lat: number
  lng: number
  provider: ServiceProvider
}

interface Props {
  providers: ServiceProvider[]
  selected: ServiceProvider | null
  onSelect: (provider: ServiceProvider | null) => void
  highlighted: Set<string>
}

const TYPE_COLORS: Record<string, string> = {
  Cloud: '#4f9cf9',
  Colocation: '#a78bfa',
  'Managed Service': '#34d399',
  Connectivity: '#fb923c',
  Security: '#f87171',
}

const SLA_SIZE: Record<string, number> = {
  Gold: 0.6,
  Silver: 0.45,
  Bronze: 0.32,
}

export default function Globe({ providers, selected, onSelect, highlighted }: Props) {
  const globeRef = useRef<any>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const update = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        })
      }
    }
    update()
    const ro = new ResizeObserver(update)
    if (containerRef.current) ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  // Initial camera position centred on EMEA
  useEffect(() => {
    if (!globeRef.current) return
    globeRef.current.pointOfView({ lat: 30, lng: 20, altitude: 2.2 }, 0)
  }, [dimensions])

  // Fly to selected provider
  useEffect(() => {
    if (!globeRef.current || !selected) return
    globeRef.current.pointOfView(
      { lat: selected.lat, lng: selected.lng, altitude: 1.6 },
      800,
    )
  }, [selected])

  const points: GlobePoint[] = providers.map(p => ({ lat: p.lat, lng: p.lng, provider: p }))

  const getPointColor = useCallback(
    (d: object) => {
      const point = d as GlobePoint
      const p = point.provider
      if (selected?.id === p.id) return '#ffffff'
      if (highlighted.size > 0 && !highlighted.has(p.id)) return '#2a3040'
      return TYPE_COLORS[p.type] ?? '#6b7280'
    },
    [selected, highlighted],
  )

  const getPointRadius = useCallback(
    (d: object) => {
      const point = d as GlobePoint
      const base = SLA_SIZE[point.provider.slaLevel] ?? 0.4
      return selected?.id === point.provider.id ? base * 1.6 : base
    },
    [selected],
  )

  const getPointAltitude = useCallback(
    (d: object) => {
      const point = d as GlobePoint
      return selected?.id === point.provider.id ? 0.03 : 0.01
    },
    [selected],
  )

  const handlePointClick = useCallback(
    (point: object) => {
      const p = (point as GlobePoint).provider
      onSelect(selected?.id === p.id ? null : p)
    },
    [selected, onSelect],
  )

  const getLabel = useCallback((d: object) => {
    const p = (d as GlobePoint).provider
    return `
      <div style="
        background: rgba(10,14,26,0.92);
        border: 1px solid rgba(255,255,255,0.12);
        border-radius: 6px;
        padding: 8px 12px;
        font-family: system-ui, sans-serif;
        color: #e2e8f0;
        font-size: 12px;
        pointer-events: none;
        min-width: 160px;
      ">
        <div style="font-weight: 600; font-size: 13px; margin-bottom: 4px; color: #f8fafc;">${p.name}</div>
        <div style="color: ${TYPE_COLORS[p.type]}; margin-bottom: 2px;">${p.type}</div>
        <div style="color: #94a3b8;">${p.city}, ${p.country}</div>
        <div style="margin-top: 4px; color: #64748b; font-size: 11px;">SLA: ${p.slaLevel} · ${p.tier}</div>
      </div>
    `
  }, [])

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      {dimensions.width > 0 && (
        <GlobeGL
          ref={globeRef}
          width={dimensions.width}
          height={dimensions.height}
          backgroundColor="rgba(0,0,0,0)"
          globeImageUrl="//unpkg.com/three-globe/example/img/earth-dark.jpg"
          bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
          atmosphereColor="#1e3a5f"
          atmosphereAltitude={0.18}
          pointsData={points}
          pointLat={(d: object) => (d as GlobePoint).lat}
          pointLng={(d: object) => (d as GlobePoint).lng}
          pointColor={getPointColor}
          pointRadius={getPointRadius}
          pointAltitude={getPointAltitude}
          pointLabel={getLabel}
          onPointClick={handlePointClick}
          pointsMerge={false}
          enablePointerInteraction
        />
      )}

      {/* Legend */}
      <div style={{
        position: 'absolute',
        bottom: 20,
        left: 20,
        background: 'rgba(10,14,26,0.85)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 8,
        padding: '10px 14px',
        fontSize: 11,
        color: '#94a3b8',
        backdropFilter: 'blur(8px)',
      }}>
        <div style={{ fontWeight: 600, marginBottom: 6, color: '#e2e8f0', fontSize: 12 }}>Provider Type</div>
        {Object.entries(TYPE_COLORS).map(([type, color]) => (
          <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: color, display: 'inline-block', flexShrink: 0,
            }} />
            {type}
          </div>
        ))}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', marginTop: 8, paddingTop: 6, fontWeight: 600, color: '#e2e8f0', fontSize: 12 }}>
          Size = SLA Tier
        </div>
      </div>
    </div>
  )
}
