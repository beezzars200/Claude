import type { ServiceProvider } from '../types'

interface Props {
  providers: ServiceProvider[]
  selected: ServiceProvider | null
  onSelect: (provider: ServiceProvider | null) => void
  onHover: (ids: Set<string>) => void
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

const TYPE_COLORS: Record<string, string> = {
  Cloud: '#4f9cf9',
  Colocation: '#a78bfa',
  'Managed Service': '#34d399',
  Connectivity: '#fb923c',
  Security: '#f87171',
}

function fmt(n: number) {
  if (n >= 1_000_000) return `£${(n / 1_000_000).toFixed(1)}M`
  return `£${(n / 1_000).toFixed(0)}K`
}

export default function MatrixTable({ providers, selected, onSelect, onHover }: Props) {
  return (
    <div style={{
      height: '100%',
      overflowY: 'auto',
      fontSize: 12,
    }}>
      <table style={{
        width: '100%',
        borderCollapse: 'collapse',
        tableLayout: 'fixed',
      }}>
        <colgroup>
          <col style={{ width: '22%' }} />
          <col style={{ width: '14%' }} />
          <col style={{ width: '14%' }} />
          <col style={{ width: '16%' }} />
          <col style={{ width: '10%' }} />
          <col style={{ width: '11%' }} />
          <col style={{ width: '13%' }} />
        </colgroup>
        <thead>
          <tr style={{
            position: 'sticky', top: 0, zIndex: 1,
            background: '#0f1422',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
          }}>
            {['Provider', 'Type', 'Region', 'Country / City', 'Tier', 'SLA', 'Value'].map(h => (
              <th key={h} style={{
                padding: '10px 12px',
                textAlign: 'left',
                color: '#64748b',
                fontWeight: 600,
                fontSize: 11,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {providers.map((p, i) => {
            const isSelected = selected?.id === p.id
            return (
              <tr
                key={p.id}
                onClick={() => onSelect(isSelected ? null : p)}
                onMouseEnter={() => onHover(new Set([p.id]))}
                onMouseLeave={() => onHover(new Set())}
                style={{
                  cursor: 'pointer',
                  background: isSelected
                    ? 'rgba(79,156,249,0.12)'
                    : i % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent',
                  borderLeft: isSelected ? '2px solid #4f9cf9' : '2px solid transparent',
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                  transition: 'background 0.15s',
                }}
              >
                <td style={{ padding: '9px 12px', color: '#e2e8f0', fontWeight: isSelected ? 600 : 400 }}>
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.name}
                  </div>
                </td>
                <td style={{ padding: '9px 12px' }}>
                  <span style={{
                    color: TYPE_COLORS[p.type],
                    background: `${TYPE_COLORS[p.type]}18`,
                    padding: '2px 7px',
                    borderRadius: 4,
                    fontSize: 11,
                    whiteSpace: 'nowrap',
                  }}>{p.type}</span>
                </td>
                <td style={{ padding: '9px 12px', color: '#94a3b8' }}>
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.region}
                  </div>
                </td>
                <td style={{ padding: '9px 12px', color: '#94a3b8' }}>
                  {p.city}, {p.country}
                </td>
                <td style={{ padding: '9px 12px', color: '#64748b' }}>{p.tier}</td>
                <td style={{ padding: '9px 12px' }}>
                  <span style={{
                    color: SLA_COLORS[p.slaLevel],
                    fontWeight: 600,
                    fontSize: 11,
                  }}>{p.slaLevel}</span>
                </td>
                <td style={{ padding: '9px 12px', color: '#e2e8f0', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {fmt(p.annualValue)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {providers.length === 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          height: 120, color: '#4b5563', fontSize: 13,
        }}>
          No providers match the current filters
        </div>
      )}
    </div>
  )
}
