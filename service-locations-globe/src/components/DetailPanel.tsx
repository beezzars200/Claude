import { X, MapPin, Building2, Shield, BadgeDollarSign, Calendar, User } from 'lucide-react'
import type { ServiceProvider } from '../types'

interface Props {
  provider: ServiceProvider
  onClose: () => void
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
  if (n >= 1_000_000) return `£${(n / 1_000_000).toFixed(2)}M`
  return `£${(n / 1_000).toFixed(0)}K`
}

function Row({ icon, label, value, valueColor }: {
  icon: React.ReactNode
  label: string
  value: string
  valueColor?: string
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 14 }}>
      <div style={{ color: '#4b5563', marginTop: 1, flexShrink: 0 }}>{icon}</div>
      <div>
        <div style={{ fontSize: 10, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 1 }}>{label}</div>
        <div style={{ fontSize: 13, color: valueColor ?? '#e2e8f0' }}>{value}</div>
      </div>
    </div>
  )
}

export default function DetailPanel({ provider: p, onClose }: Props) {
  return (
    <div style={{
      position: 'absolute',
      top: 12,
      right: 12,
      width: 280,
      background: 'rgba(10,14,26,0.95)',
      border: '1px solid rgba(255,255,255,0.10)',
      borderRadius: 12,
      backdropFilter: 'blur(16px)',
      padding: '16px 18px',
      zIndex: 10,
      color: '#e2e8f0',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div>
          <div style={{
            fontSize: 14, fontWeight: 700, color: '#f8fafc', lineHeight: 1.3, marginBottom: 4,
          }}>{p.name}</div>
          <span style={{
            fontSize: 11,
            color: TYPE_COLORS[p.type],
            background: `${TYPE_COLORS[p.type]}18`,
            padding: '2px 8px',
            borderRadius: 4,
          }}>{p.type}</span>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#64748b', padding: 2, marginTop: -2,
          }}
        >
          <X size={16} />
        </button>
      </div>

      <Row icon={<MapPin size={14} />} label="Location" value={`${p.city}, ${p.country}`} />
      <Row icon={<Building2 size={14} />} label="Region" value={p.region} />
      <Row icon={<Shield size={14} />} label="SLA Level" value={p.slaLevel} valueColor={SLA_COLORS[p.slaLevel]} />
      <Row icon={<Shield size={14} />} label="Contract" value={p.contractStatus} valueColor={STATUS_COLORS[p.contractStatus]} />
      <Row icon={<BadgeDollarSign size={14} />} label="Annual Value" value={fmt(p.annualValue)} valueColor="#4f9cf9" />
      <Row icon={<Calendar size={14} />} label="Partner Since" value={String(p.since)} />
      <Row icon={<User size={14} />} label="Account Manager" value={p.accountManager} />

      <div style={{ marginTop: 4 }}>
        <div style={{ fontSize: 10, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Services</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {p.services.map(s => (
            <span key={s} style={{
              fontSize: 11, padding: '2px 8px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 4, color: '#94a3b8',
            }}>{s}</span>
          ))}
        </div>
      </div>
    </div>
  )
}
