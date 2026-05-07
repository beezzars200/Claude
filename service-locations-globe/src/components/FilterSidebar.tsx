import type { FilterState, ProviderType, Region, ServiceTier } from '../types'

interface Props {
  filters: FilterState
  onChange: (f: Partial<FilterState>) => void
  totalCount: number
  filteredCount: number
}

const TYPES: ProviderType[] = ['Cloud', 'Colocation', 'Managed Service', 'Connectivity', 'Security']
const REGIONS: Region[] = ['Western Europe', 'Northern Europe', 'Southern Europe', 'Eastern Europe', 'Middle East', 'Africa']
const TIERS: ServiceTier[] = ['Tier 1', 'Tier 2', 'Tier 3']
const STATUSES = ['Active', 'Renewal Due', 'Negotiating']
const SLA_LEVELS = ['Gold', 'Silver', 'Bronze']

const TYPE_COLORS: Record<string, string> = {
  Cloud: '#4f9cf9',
  Colocation: '#a78bfa',
  'Managed Service': '#34d399',
  Connectivity: '#fb923c',
  Security: '#f87171',
}

const STATUS_COLORS: Record<string, string> = {
  Active: '#34d399',
  'Renewal Due': '#fbbf24',
  Negotiating: '#f87171',
}

const SLA_COLORS: Record<string, string> = {
  Gold: '#fbbf24',
  Silver: '#94a3b8',
  Bronze: '#b45309',
}

function toggle<T>(arr: T[], value: T): T[] {
  return arr.includes(value) ? arr.filter(x => x !== value) : [...arr, value]
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{
        fontSize: 10, color: '#4b5563', textTransform: 'uppercase',
        letterSpacing: '0.08em', fontWeight: 600, marginBottom: 8,
      }}>{title}</div>
      {children}
    </div>
  )
}

function Chip({ label, active, color, onClick }: {
  label: string; active: boolean; color?: string; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        fontSize: 11, padding: '4px 9px', borderRadius: 5, marginBottom: 4,
        display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer',
        background: active ? `${color ?? '#4f9cf9'}20` : 'transparent',
        border: `1px solid ${active ? (color ?? '#4f9cf9') + '50' : 'rgba(255,255,255,0.06)'}`,
        color: active ? (color ?? '#4f9cf9') : '#64748b',
        transition: 'all 0.12s',
      }}
    >{label}</button>
  )
}

export default function FilterSidebar({ filters, onChange, totalCount, filteredCount }: Props) {
  const hasFilters =
    filters.types.length > 0 ||
    filters.regions.length > 0 ||
    filters.tiers.length > 0 ||
    filters.contractStatus.length > 0 ||
    filters.slaLevel.length > 0 ||
    filters.search.length > 0

  return (
    <div style={{
      width: 180,
      flexShrink: 0,
      borderRight: '1px solid rgba(255,255,255,0.06)',
      padding: '14px 12px',
      overflowY: 'auto',
      background: '#080c17',
    }}>
      {/* Search */}
      <div style={{ marginBottom: 16 }}>
        <input
          value={filters.search}
          onChange={e => onChange({ search: e.target.value })}
          placeholder="Search providers..."
          style={{
            width: '100%', boxSizing: 'border-box',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 7, padding: '7px 10px',
            color: '#e2e8f0', fontSize: 12, outline: 'none',
          }}
        />
      </div>

      {/* Count */}
      <div style={{
        fontSize: 11, color: '#4b5563', marginBottom: 16,
        display: 'flex', justifyContent: 'space-between',
      }}>
        <span>Showing</span>
        <span style={{ color: filteredCount < totalCount ? '#fbbf24' : '#4f9cf9', fontWeight: 600 }}>
          {filteredCount} / {totalCount}
        </span>
      </div>

      <Section title="Type">
        {TYPES.map(t => (
          <Chip
            key={t} label={t}
            active={filters.types.includes(t)}
            color={TYPE_COLORS[t]}
            onClick={() => onChange({ types: toggle(filters.types, t) })}
          />
        ))}
      </Section>

      <Section title="Region">
        {REGIONS.map(r => (
          <Chip
            key={r} label={r}
            active={filters.regions.includes(r)}
            onClick={() => onChange({ regions: toggle(filters.regions, r) })}
          />
        ))}
      </Section>

      <Section title="Tier">
        {TIERS.map(t => (
          <Chip
            key={t} label={t}
            active={filters.tiers.includes(t)}
            onClick={() => onChange({ tiers: toggle(filters.tiers, t) })}
          />
        ))}
      </Section>

      <Section title="Contract">
        {STATUSES.map(s => (
          <Chip
            key={s} label={s}
            active={filters.contractStatus.includes(s)}
            color={STATUS_COLORS[s]}
            onClick={() => onChange({ contractStatus: toggle(filters.contractStatus, s) })}
          />
        ))}
      </Section>

      <Section title="SLA Level">
        {SLA_LEVELS.map(s => (
          <Chip
            key={s} label={s}
            active={filters.slaLevel.includes(s)}
            color={SLA_COLORS[s]}
            onClick={() => onChange({ slaLevel: toggle(filters.slaLevel, s) })}
          />
        ))}
      </Section>

      {hasFilters && (
        <button
          onClick={() => onChange({ search: '', types: [], regions: [], tiers: [], contractStatus: [], slaLevel: [] })}
          style={{
            width: '100%', fontSize: 11, padding: '6px 0',
            background: 'rgba(248,113,113,0.08)',
            border: '1px solid rgba(248,113,113,0.2)',
            borderRadius: 6, color: '#f87171', cursor: 'pointer',
          }}
        >Clear filters</button>
      )}
    </div>
  )
}
