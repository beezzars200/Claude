import { useRef, useEffect, useCallback, useState, useMemo } from 'react'
import GlobeGL from 'react-globe.gl'
import { feature } from 'topojson-client'
import type { Topology } from 'topojson-specification'
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
  Gold: 0.7,
  Silver: 0.5,
  Bronze: 0.36,
}

export default function Globe({ providers, selected, onSelect, highlighted }: Props) {
  const globeRef = useRef<any>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
  const [countries, setCountries] = useState<{ features: object[] }>({ features: [] })

  // Load bundled TopoJSON country data — no CDN dependency
  useEffect(() => {
    import('world-atlas/countries-110m.json').then((module) => {
      const topo = module.default as unknown as Topology
      const geo = feature(topo, topo.objects.countries as any)
      setCountries(geo as any)
    })
  }, [])

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

  useEffect(() => {
    if (!globeRef.current) return
    globeRef.current.pointOfView({ lat: 30, lng: 20, altitude: 2.2 }, 0)
  }, [dimensions])

  useEffect(() => {
    if (!globeRef.current || !selected) return
    globeRef.current.pointOfView(
      { lat: selected.lat, lng: selected.lng, altitude: 1.4 },
      900,
    )
  }, [selected])

  const points: GlobePoint[] = useMemo(
    () => providers.map(p => ({ lat: p.lat, lng: p.lng, provider: p })),
    [providers],
  )

  const getPointColor = useCallback(
    (d: object) => {
      const p = (d as GlobePoint).provider
      if (selected?.id === p.id) return '#ffffff'
      if (highlighted.size > 0 && !highlighted.has(p.id)) return 'rgba(80,90,120,0.4)'
      return TYPE_COLORS[p.type] ?? '#6b7280'
    },
    [selected, highlighted],
  )

  const getPointRadius = useCallback(
    (d: object) => {
      const p = (d as GlobePoint).provider
      const base = SLA_SIZE[p.slaLevel] ?? 0.4
      return selected?.id === p.id ? base * 1.7 : base
    },
    [selected],
  )

  const getPointAltitude = useCallback(
    (d: object) => {
      const p = (d as GlobePoint).provider
      return selected?.id === p.id ? 0.04 : 0.015
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
    const color = TYPE_COLORS[p.type] ?? '#6b7280'
    return `
      <div style="
        background: rgba(6,10,20,0.94);
        border: 1px solid ${color}55;
        border-left: 3px solid ${color};
        border-radius: 6px;
        padding: 9px 13px;
        font-family: system-ui, -apple-system, sans-serif;
        color: #e2e8f0;
        font-size: 12px;
        pointer-events: none;
        min-width: 170px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.6);
      ">
        <div style="font-weight: 700; font-size: 13px; margin-bottom: 3px; color: #f8fafc;">${p.name}</div>
        <div style="color: ${color}; font-size: 11px; margin-bottom: 3px;">${p.type}</div>
        <div style="color: #94a3b8;">${p.city}, ${p.country}</div>
        <div style="margin-top: 5px; display: flex; gap: 8px; font-size: 10px; color: #64748b;">
          <span>${p.slaLevel} SLA</span>
          <span>·</span>
          <span>${p.tier}</span>
          <span>·</span>
          <span style="color: ${p.contractStatus === 'Active' ? '#34d399' : p.contractStatus === 'Renewal Due' ? '#fbbf24' : '#f87171'}">${p.contractStatus}</span>
        </div>
      </div>
    `
  }, [])

  // Subtle land fill so land vs ocean is readable, border gives sharp definition at any zoom
  const getPolygonCapColor = useCallback(() => 'rgba(30, 60, 95, 0.38)', [])
  const getPolygonSideColor = useCallback(() => 'rgba(0,0,0,0)', [])
  const getPolygonStrokeColor = useCallback(() => 'rgba(80, 160, 240, 0.65)', [])

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      {dimensions.width > 0 && (
        <GlobeGL
          ref={globeRef}
          width={dimensions.width}
          height={dimensions.height}
          backgroundColor="rgba(0,0,0,0)"

          globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"

          atmosphereColor="#1a4a7a"
          atmosphereAltitude={0.22}

          // Vector country borders — sharp at every zoom level
          polygonsData={countries.features}
          polygonAltitude={0.001}
          polygonCapColor={getPolygonCapColor}
          polygonSideColor={getPolygonSideColor}
          polygonStrokeColor={getPolygonStrokeColor}

          // Provider pins
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
        background: 'rgba(6,10,20,0.88)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 9,
        padding: '11px 14px',
        fontSize: 11,
        color: '#94a3b8',
        backdropFilter: 'blur(12px)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
      }}>
        <div style={{ fontWeight: 600, marginBottom: 7, color: '#e2e8f0', fontSize: 12 }}>Provider Type</div>
        {Object.entries(TYPE_COLORS).map(([type, color]) => (
          <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: color,
              boxShadow: `0 0 6px ${color}88`,
              display: 'inline-block', flexShrink: 0,
            }} />
            {type}
          </div>
        ))}
        <div style={{
          borderTop: '1px solid rgba(255,255,255,0.07)',
          marginTop: 9, paddingTop: 7,
          color: '#64748b', fontSize: 10,
        }}>
          Pin size = SLA Gold › Silver › Bronze
        </div>
      </div>
    </div>
  )
}
