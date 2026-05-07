import { useState, useMemo, useCallback } from 'react'
import { Globe2, Table2, MessageSquare } from 'lucide-react'
import Globe from './components/Globe'
import MatrixTable from './components/MatrixTable'
import ChatPanel from './components/ChatPanel'
import FilterSidebar from './components/FilterSidebar'
import DetailPanel from './components/DetailPanel'
import { providers } from './data/providers'
import type { FilterState, ServiceProvider } from './types'

type View = 'globe' | 'matrix'

const DEFAULT_FILTERS: FilterState = {
  search: '',
  types: [],
  regions: [],
  tiers: [],
  contractStatus: [],
  slaLevel: [],
}

export default function App() {
  const [view, setView] = useState<View>('globe')
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS)
  const [selected, setSelected] = useState<ServiceProvider | null>(null)
  const [highlighted, setHighlighted] = useState<Set<string>>(new Set())
  const [chatOpen, setChatOpen] = useState(true)

  const updateFilters = useCallback((patch: Partial<FilterState>) => {
    setFilters(prev => ({ ...prev, ...patch }))
  }, [])

  const filteredProviders = useMemo(() => {
    return providers.filter(p => {
      if (filters.search) {
        const q = filters.search.toLowerCase()
        if (!p.name.toLowerCase().includes(q) &&
            !p.city.toLowerCase().includes(q) &&
            !p.country.toLowerCase().includes(q)) return false
      }
      if (filters.types.length > 0 && !filters.types.includes(p.type)) return false
      if (filters.regions.length > 0 && !filters.regions.includes(p.region)) return false
      if (filters.tiers.length > 0 && !filters.tiers.includes(p.tier)) return false
      if (filters.contractStatus.length > 0 && !filters.contractStatus.includes(p.contractStatus)) return false
      if (filters.slaLevel.length > 0 && !filters.slaLevel.includes(p.slaLevel)) return false
      return true
    })
  }, [filters])

  const filteredIds = useMemo(() => new Set(filteredProviders.map(p => p.id)), [filteredProviders])

  // Merge filter-derived highlights with hover highlights
  const effectiveHighlight = useMemo(() => {
    if (highlighted.size > 0) return highlighted
    // Dim unfiltered providers when filters are active
    const hasActiveFilter =
      filters.types.length > 0 ||
      filters.regions.length > 0 ||
      filters.tiers.length > 0 ||
      filters.contractStatus.length > 0 ||
      filters.slaLevel.length > 0 ||
      filters.search.length > 0
    return hasActiveFilter ? filteredIds : new Set<string>()
  }, [highlighted, filters, filteredIds])

  const handleChatFilter = useCallback((patch: Partial<FilterState>) => {
    if (Object.keys(patch).length > 0) {
      setFilters(prev => ({ ...prev, ...patch }))
    }
  }, [])

  const handleChatHighlight = useCallback((ids: Set<string>) => {
    setHighlighted(ids)
    setTimeout(() => setHighlighted(new Set()), 4000)
  }, [])

  return (
    <div style={{
      width: '100vw', height: '100vh',
      background: '#0a0e1a',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      color: '#e2e8f0',
      overflow: 'hidden',
    }}>
      {/* Top bar */}
      <div style={{
        height: 48,
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        gap: 16,
        background: 'rgba(8,12,23,0.95)',
        backdropFilter: 'blur(8px)',
        flexShrink: 0,
        WebkitAppRegion: 'drag' as any,
      }}>
        {/* Logo / title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, WebkitAppRegion: 'no-drag' as any }}>
          <Globe2 size={16} color="#4f9cf9" />
          <span style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc', letterSpacing: '-0.01em' }}>
            EMEA Service Locations
          </span>
          <span style={{
            fontSize: 10, padding: '1px 7px',
            background: 'rgba(79,156,249,0.12)',
            border: '1px solid rgba(79,156,249,0.2)',
            borderRadius: 10, color: '#4f9cf9',
          }}>PROTOTYPE</span>
        </div>

        {/* View switcher */}
        <div style={{
          display: 'flex', gap: 2,
          background: 'rgba(255,255,255,0.04)',
          borderRadius: 8, padding: 3,
          WebkitAppRegion: 'no-drag' as any,
          marginLeft: 'auto',
        }}>
          {([['globe', Globe2, 'Globe'], ['matrix', Table2, 'Matrix']] as const).map(([v, Icon, label]) => (
            <button
              key={v}
              onClick={() => setView(v)}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '4px 12px', borderRadius: 6,
                background: view === v ? 'rgba(79,156,249,0.18)' : 'transparent',
                border: view === v ? '1px solid rgba(79,156,249,0.3)' : '1px solid transparent',
                color: view === v ? '#4f9cf9' : '#64748b',
                fontSize: 12, cursor: 'pointer',
              }}
            >
              <Icon size={13} />
              {label}
            </button>
          ))}
        </div>

        {/* Chat toggle */}
        <button
          onClick={() => setChatOpen(o => !o)}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '4px 12px', borderRadius: 6,
            background: chatOpen ? 'rgba(52,211,153,0.12)' : 'rgba(255,255,255,0.04)',
            border: chatOpen ? '1px solid rgba(52,211,153,0.25)' : '1px solid rgba(255,255,255,0.08)',
            color: chatOpen ? '#34d399' : '#64748b',
            fontSize: 12, cursor: 'pointer',
            WebkitAppRegion: 'no-drag' as any,
          }}
        >
          <MessageSquare size={13} />
          AI Assistant
        </button>

        {/* Provider count */}
        <div style={{ fontSize: 11, color: '#4b5563', marginLeft: 8 }}>
          <span style={{ color: '#64748b' }}>{filteredProviders.length}</span>
          <span> / {providers.length} providers</span>
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Filter sidebar */}
        <FilterSidebar
          filters={filters}
          onChange={updateFilters}
          totalCount={providers.length}
          filteredCount={filteredProviders.length}
        />

        {/* Centre content area */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          {view === 'globe' ? (
            <>
              <Globe
                providers={filteredProviders}
                selected={selected}
                onSelect={setSelected}
                highlighted={effectiveHighlight}
              />
              {selected && (
                <DetailPanel
                  provider={selected}
                  onClose={() => setSelected(null)}
                />
              )}
            </>
          ) : (
            <div style={{ height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div style={{
                padding: '10px 16px',
                borderBottom: '1px solid rgba(255,255,255,0.05)',
                fontSize: 11, color: '#4b5563',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <Table2 size={12} />
                <span>Provider Matrix</span>
                {selected && (
                  <span style={{ color: '#4f9cf9' }}>
                    · Selected: {selected.name}
                  </span>
                )}
              </div>
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <MatrixTable
                  providers={filteredProviders}
                  selected={selected}
                  onSelect={setSelected}
                  onHover={setHighlighted}
                />
              </div>
            </div>
          )}
        </div>

        {/* Chat panel */}
        {chatOpen && (
          <div style={{
            width: 320,
            flexShrink: 0,
            borderLeft: '1px solid rgba(255,255,255,0.06)',
            display: 'flex',
            flexDirection: 'column',
          }}>
            <ChatPanel
              onFilter={handleChatFilter}
              onHighlight={handleChatHighlight}
              onSelect={setSelected}
            />
          </div>
        )}
      </div>
    </div>
  )
}
